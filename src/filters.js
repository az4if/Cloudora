// Keeps the ad-block lists fresh: every few days the server downloads the public lists, compiles them in a temp folder
// and only swaps them into public/adblock/ if the result looks sane. Browsers pick the new files up the next time the
// service worker restarts. Turn off with CLOUDORA_FILTER_UPDATE=0; change the age limit with CLOUDORA_FILTER_DAYS (default 7).
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, copyFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DAY = 864e5;
const REQUIRED = ["net.json", "cosmetic.json", "generic.css", "res.json", "info.json"];

// is the compiled list older than `days`? Unknown or unreadable counts as stale.
export function isStale(info, days, now = Date.now()) {
  const t = Date.parse(info && info.built);
  return !Number.isFinite(t) || now - t >= days * DAY;
}

// a fresh build replaces the old one only if it isn't suspiciously smaller (truncated or empty downloads)
export function checkBuild(next, prev) {
  if (!next || !Number.isFinite(next.network) || !Number.isFinite(next.cosmetic)) return "the new build has no rule counts";
  if (next.network < 20000) return `the new build has only ${next.network} network rules`;
  if (prev && Number.isFinite(prev.network) && next.network < prev.network * 0.6) return `the new build has far fewer rules (${next.network} vs ${prev.network})`;
  if (prev && Number.isFinite(prev.cosmetic) && next.cosmetic < prev.cosmetic * 0.5) return `the new build has far fewer page rules (${next.cosmetic} vs ${prev.cosmetic})`;
  return "";
}

const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const swap = (from, to) => { const tmp = `${to}.new-${process.pid}`; copyFileSync(from, tmp); renameSync(tmp, to); }; // same folder, so the rename is atomic

// install a compiled folder into the live one; throws if it doesn't pass the checks
export function install(builtDir, liveDir) {
  for (const f of REQUIRED) if (!existsSync(join(builtDir, f))) throw new Error("missing " + f);
  const next = readJson(join(builtDir, "info.json")), prev = readJson(join(liveDir, "info.json"));
  const bad = checkBuild(next, prev); if (bad) throw new Error(bad);
  JSON.parse(readFileSync(join(builtDir, "net.json"), "utf8")); JSON.parse(readFileSync(join(builtDir, "cosmetic.json"), "utf8")); // must parse
  mkdirSync(join(liveDir, "res"), { recursive: true });
  const resDir = join(builtDir, "res");
  if (existsSync(resDir)) for (const f of readdirSync(resDir)) swap(join(resDir, f), join(liveDir, "res", f));
  for (const f of ["res.json", "generic.css", "cosmetic.json", "net.json", "info.json"]) swap(join(builtDir, f), join(liveDir, f)); // info.json last
  return next;
}

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; const add = (d) => { out = (out + d).slice(-2000); };
    p.stdout.on("data", add); p.stderr.on("data", add);
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("timed out")); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error(`build exited with ${code}: ${out.trim().split("\n").slice(-2).join(" | ")}`)); });
  });
}

// one refresh attempt; resolves to the new info on success, null when nothing was due, and throws on failure
export async function refresh({ root, liveDir, days = 7, force = false }) {
  if (!force && !isStale(readJson(join(liveDir, "info.json")), days)) return null;
  const work = mkdtempSync(join(tmpdir(), "cloudora-filters-"));
  try {
    cpSync(join(root, "adblock-src"), join(work, "src"), { recursive: true });
    await run(process.execPath, [join(root, "scripts", "build-filters.mjs"), "--download", "--strict", "--src", join(work, "src"), "--out", join(work, "out")], 5 * 60e3);
    return install(join(work, "out"), liveDir);
  } finally { rmSync(work, { recursive: true, force: true }); }
}

export function startFilterUpdates({ root, liveDir, log = console.log }) {
  if (process.env.CLOUDORA_FILTER_UPDATE === "0") return () => {};
  const days = Number(process.env.CLOUDORA_FILTER_DAYS) > 0 ? Number(process.env.CLOUDORA_FILTER_DAYS) : 7;
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    try { const i = await refresh({ root, liveDir, days }); if (i) log(`[cloudora] ad-block lists updated (${i.network} network rules, built ${i.built})`); }
    catch (e) { log("[cloudora] ad-block list update skipped:", e.message); }
    finally { busy = false; }
  };
  const first = setTimeout(tick, 30e3), every = setInterval(tick, DAY);
  first.unref(); every.unref();
  return () => { clearTimeout(first); clearInterval(every); };
}
