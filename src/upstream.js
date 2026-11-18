// Server-side HTTP client for upstream APIs (AniList, MangaDex, image hosts, the optional source API).
//
// 1. Always sends a real browser User-Agent (not "node"/"Cloudora/x"), because several hosts reject or
//    throttle unknown agents.
// 2. If a host still answers like a bot filter (403/429/503, Cloudflare "Just a moment..."), the request
//    is retried through scripts/curl_fetch.py, which uses curl_cffi to send a real Chrome TLS/HTTP2
//    fingerprint. That needs `python3` + `pip install curl_cffi` on the server and is skipped silently if
//    they are missing.
//
// Env: CURL_CFFI=0 never use it, CURL_CFFI=1 always use it first, unset = fallback only.
//      PYTHON=python3 (binary), CURL_IMPERSONATE=chrome (any curl_cffi target, e.g. chrome131, safari17_0)
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

// Keep in step with a current stable Chrome; curl_cffi sends its own matching UA when it is used.
export const BROWSER_UA = process.env.UPSTREAM_UA
  || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
export const BROWSER_HEADERS = Object.freeze({
  "User-Agent": BROWSER_UA,
  "Accept-Language": "en-US,en;q=0.9",
});

const SCRIPT = fileURLToPath(new URL("../scripts/curl_fetch.py", import.meta.url));
const PYTHON = process.env.PYTHON || "python3";
const MODE = process.env.CURL_CFFI; // "0" | "1" | undefined
const MAX_BODY = 25 * 1024 * 1024;

let cffiReady = null; // Promise<boolean>, checked once
export function curlCffiAvailable() {
  if (MODE === "0") return Promise.resolve(false);
  return (cffiReady ||= new Promise((resolve) => {
    execFile(PYTHON, ["-c", "import curl_cffi"], { timeout: 8000 }, (err) => {
      if (err) console.warn("[cloudora] curl_cffi not available, using plain fetch only (pip install curl_cffi to enable the fallback)");
      resolve(!err);
    });
  }));
}

function viaCurlCffi(url, { method, headers, body, timeout }) {
  return new Promise((resolve, reject) => {
    const child = execFile(PYTHON, [SCRIPT], { timeout: timeout + 5000, maxBuffer: MAX_BODY * 2 }, (err, stdout) => {
      if (err) return reject(err);
      let out;
      try { out = JSON.parse(stdout); } catch { return reject(new Error("bad curl_cffi output")); }
      if (out.error) return reject(new Error(out.error));
      resolve({
        status: out.status,
        ok: out.status >= 200 && out.status < 300,
        url: out.url,
        headers: new Headers(out.headers),
        body: Buffer.from(out.body_b64, "base64"),
        via: "curl_cffi",
      });
    });
    child.stdin.end(JSON.stringify({
      url, method, headers, timeout: timeout / 1000,
      body_b64: body ? Buffer.from(body).toString("base64") : "",
      impersonate: process.env.CURL_IMPERSONATE || "chrome",
    }));
  });
}

async function viaFetch(url, { method, headers, body, timeout }) {
  const r = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeout) });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, ok: r.ok, url: r.url, headers: r.headers, body: buf, via: "fetch" };
}

// Looks like an anti-bot wall rather than a real API answer
function blocked(r) {
  if (r.status === 429 || r.status === 503) return true;
  if (r.status !== 403) return false;
  if (r.headers.get("cf-mitigated") || /cloudflare|ddos-guard|sucuri/i.test(r.headers.get("server") || "")) return true;
  return /just a moment|attention required|cf-browser-verification|captcha/i.test(r.body.subarray(0, 4096).toString("utf8"));
}

// upstream(url, { method, headers, body, timeout }) -> { status, ok, url, headers, body: Buffer, via }
export async function upstream(url, { method = "GET", headers = {}, body, timeout = 15000 } = {}) {
  const opts = { method, headers: { ...BROWSER_HEADERS, ...headers }, body, timeout };
  const useCffi = await curlCffiAvailable();
  if (useCffi && MODE === "1") {
    try { return await viaCurlCffi(url, opts); } catch (e) { console.warn("[cloudora] curl_cffi failed:", e.message); }
  }
  const r = await viaFetch(url, opts);
  if (!blocked(r) || !useCffi || MODE === "1") return r;
  try { return await viaCurlCffi(url, opts); }
  catch (e) { console.warn("[cloudora] curl_cffi fallback failed:", e.message); return r; }
}
