import { createServer } from "node:http";
import { createReadStream, statSync, readFileSync } from "node:fs";
import { createGzip, gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const hlsPath = dirname(createRequire(import.meta.url).resolve("hls.js"));
const publicPath = resolve(fileURLToPath(new URL("../public/", import.meta.url)));

// Wisp = the tunnel your browser uses to reach the open internet via THIS server.
logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  dns_servers: ["1.1.1.3", "1.0.0.3"], // Cloudflare family DNS; change if you like
  // hostname_blacklist: [/example\.com/],  // block sites you don't want proxied
});
// For local development/testing only: lets the tunnel reach 127.0.0.1 / LAN hosts. Never enable on a public server.
if (process.env.CLOUDORA_ALLOW_LOCAL === "1") Object.assign(wisp.options, { allow_loopback_ips: true, allow_private_ips: true, allow_direct_ip: true });

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".wasm": "application/wasm",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".map": "application/json", ".webmanifest": "application/manifest+json", ".gif": "image/gif", ".txt": "text/plain", ".xml": "text/xml", ".mp4": "video/mp4", ".mp3": "audio/mpeg",
};
// URL prefix -> folder on disk (first match wins, "/" last)
const MOUNTS = [["/scram/", scramjetPath], ["/libcurl/", libcurlPath], ["/baremux/", baremuxPath], ["/hls/", hlsPath], ["/", publicPath]];

function findFile(pathname) {
  for (const [prefix, root] of MOUNTS) {
    if (!pathname.startsWith(prefix)) continue;
    let full = normalize(join(root, pathname.slice(prefix.length)));
    if (full !== root && !full.startsWith(root + sep)) continue; // block ../ escapes
    try {
      if (statSync(full).isDirectory()) full = join(full, "index.html");
      if (statSync(full).isFile()) return full;
    } catch {}
  }
  return null;
}

// --- AniList data for the Anime/Manga pages (cached, same-origin so the browser needs no CORS) ---
const ANILIST = process.env.ANILIST_URL || "https://graphql.anilist.co";
const cache = new Map();
async function readBody(req, max = 8192) {
  const parts = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > max) throw new Error("too large"); parts.push(c); }
  return Buffer.concat(parts);
}
async function anilist(req, res) {
  const json = { "Content-Type": "application/json" };
  try {
    const body = await readBody(req), key = body.toString();
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) { res.writeHead(200, json); return res.end(hit.data); }
    JSON.parse(key);
    const r = await fetch(ANILIST, { method: "POST", headers: { ...json, Accept: "application/json" }, body });
    const data = await r.text();
    if (r.ok) { if (cache.size > 300) cache.clear(); cache.set(key, { data, exp: Date.now() + 5 * 60e3 }); }
    res.writeHead(r.status, json); res.end(data);
  } catch { res.writeHead(502, json); res.end('{"errors":[{"message":"upstream error"}]}'); }
}
// Generic cached JSON relay (MangaDex and the optional streaming source API)
async function relay(res, url, ttl = 300e3, extra = {}) {
  const json = { "Content-Type": "application/json" };
  try {
    const hit = cache.get(url);
    if (hit && hit.exp > Date.now()) { res.writeHead(200, json); return res.end(hit.data); }
    const r = await fetch(url, { headers: { "User-Agent": "Cloudora/0.3 (self-hosted proxy browser)", Accept: "application/json", ...extra } });
    const data = await r.text();
    if (r.ok && ttl) { if (cache.size > 300) cache.clear(); cache.set(url, { data, exp: Date.now() + ttl }); }
    res.writeHead(r.status, json); res.end(data);
  } catch { res.writeHead(502, json); res.end('{"result":"error","errors":[{"title":"upstream error"}]}'); }
}
const MANGADEX = process.env.MANGADEX_URL || "https://api.mangadex.org";
// Optional streaming source API (set STREAM_API on the server; see README for the JSON contract)
const STREAM_API = (process.env.STREAM_API || "").replace(/\/+$/, "");
const STREAM_HEADERS = process.env.STREAM_API_KEY ? { Authorization: "Bearer " + process.env.STREAM_API_KEY } : {};
const MD_PATH = /^\/(manga|manga\/[0-9a-f-]{36}|manga\/[0-9a-f-]{36}\/feed|at-home\/server\/[0-9a-f-]{36})$/;
// Cover/thumbnail art only, from these hosts
const IMG_HOSTS = ["anilist.co", "mangadex.org"];
const okHost = (h) => IMG_HOSTS.some((d) => h === d || h.endsWith("." + d));
async function image(res, u) {
  try {
    const t = new URL(u);
    if (t.protocol !== "https:" || !okHost(t.hostname)) throw 0;
    const r = await fetch(t);
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/") || !okHost(new URL(r.url).hostname)) throw 0;
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=86400" });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch { res.writeHead(404); res.end(); }
}

// Search-as-you-type suggestions for the address bar (DuckDuckGo's public autocomplete, cached, same-origin)
async function suggest(res, q) {
  const json = { "Content-Type": "application/json" };
  q = q.trim().slice(0, 100);
  if (!q) { res.writeHead(200, json); return res.end("[]"); }
  try {
    const key = "sg:" + q.toLowerCase(), hit = cache.get(key);
    if (hit && hit.exp > Date.now()) { res.writeHead(200, json); return res.end(hit.data); }
    const r = await fetch("https://duckduckgo.com/ac/?type=list&q=" + encodeURIComponent(q), { headers: { "User-Agent": "Cloudora/0.5" }, signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    const data = JSON.stringify((Array.isArray(j[1]) ? j[1] : []).filter((x) => typeof x === "string").slice(0, 6));
    if (cache.size > 300) cache.clear();
    cache.set(key, { data, exp: Date.now() + 10 * 60e3 });
    res.writeHead(200, json); res.end(data);
  } catch { res.writeHead(200, json); res.end("[]"); }
}
// Static files: gzip text assets (the filter lists are big) and let browsers cache them
const gzCache = new Map();
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".wasm", ".svg", ".map", ".txt", ".xml", ".webmanifest"]);
function sendFile(req, res, file) {
  const ext = extname(file), st = statSync(file);
  const headers = { "Content-Type": MIME[ext] || "application/octet-stream", "Last-Modified": st.mtime.toUTCString() };
  if (file.includes(sep + "adblock" + sep)) headers["Cache-Control"] = "public, max-age=3600";
  else if (ext === ".html" || file.endsWith("sw.js")) headers["Cache-Control"] = "no-cache";
  const gz = COMPRESSIBLE.has(ext) && st.size > 1024 && /\bgzip\b/.test(req.headers["accept-encoding"] || "");
  if (req.headers["if-modified-since"] && new Date(req.headers["if-modified-since"]) >= new Date(Math.floor(st.mtimeMs / 1000) * 1000) && headers["Cache-Control"]?.startsWith("public")) { res.writeHead(304, headers); return res.end(); }
  if (gz) headers["Content-Encoding"] = "gzip"; headers["Vary"] = "Accept-Encoding";
  if (req.method === "HEAD") { res.writeHead(200, headers); return res.end(); }
  if (gz && st.size > 200e3) { // big and static: compress once, keep in memory
    let hit = gzCache.get(file);
    if (!hit || hit.m !== st.mtimeMs) gzCache.set(file, (hit = { m: st.mtimeMs, b: gzipSync(readFileSync(file), { level: 9 }) }));
    headers["Content-Length"] = hit.b.length; res.writeHead(200, headers); return res.end(hit.b);
  }
  if (!gz) headers["Content-Length"] = st.size;
  res.writeHead(200, headers);
  gz ? createReadStream(file).pipe(createGzip()).pipe(res) : createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  // Required so the proxy can use SharedArrayBuffer
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/anilist" && req.method === "POST") return anilist(req, res);
  if (u.pathname === "/api/config") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ stream: !!STREAM_API, official: /^(1|true)$/i.test(process.env.STREAM_API_OFFICIAL || "") })); }
  if (STREAM_API && req.method === "GET" && (u.pathname === "/api/stream/episodes" || u.pathname === "/api/stream/sources")) {
    const q = new URLSearchParams();
    for (const k of ["anilist_id", "episode"]) {
      const v = u.searchParams.get(k);
      if (v === null) continue;
      if (!/^\d{1,7}$/.test(v)) { res.writeHead(400); return res.end(); }
      q.set(k, v);
    }
    const eps = u.pathname.endsWith("episodes");
    return relay(res, `${STREAM_API}/${eps ? "episodes" : "sources"}?${q}`, eps ? 60e3 : 0, STREAM_HEADERS);
  }
  if (req.method === "GET" && u.pathname.startsWith("/api/md/")) {
    const p = u.pathname.slice(7);
    if (MD_PATH.test(p)) return relay(res, MANGADEX + p + u.search, p.startsWith("/at-home") ? 0 : 300e3);
    res.writeHead(404); return res.end();
  }
  if (u.pathname === "/img" && req.method === "GET") return image(res, u.searchParams.get("u") || "");
  if (u.pathname === "/api/suggest" && req.method === "GET") return suggest(res, u.searchParams.get("q") || "");
  let file = null;
  try { file = findFile(decodeURIComponent(new URL(req.url, "http://x").pathname)); } catch {}
  if (!file || (req.method !== "GET" && req.method !== "HEAD")) {
    res.writeHead(file ? 405 : 404, { "Content-Type": "text/plain" });
    return res.end(file ? "Method not allowed" : "Not found");
  }
  sendFile(req, res, file);
});

server.on("upgrade", (req, socket, head) => {
  if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
  else socket.end();
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, "0.0.0.0", () => console.log(`Cloudora running: http://localhost:${port}`));

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
