import "./env.js"; // must stay first: loads .env before the other modules read process.env
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
import { upstream, curlCffiAvailable } from "./upstream.js";
import { Impersonator } from "./impersonate.js";
import { startFilterUpdates } from "./filters.js";

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

// Real-browser transport (curl_cffi: Chrome/Firefox/Safari TLS + HTTP/2 fingerprints). Same network policy as Wisp.
const impersonator = new Impersonator({
  dnsServers: wisp.options.dns_servers || [],
  blacklist: wisp.options.hostname_blacklist || [],
  allowLocal: process.env.CLOUDORA_ALLOW_LOCAL === "1",
});
const impersonateOn = impersonator.available();
impersonateOn.then((ok) => { if (ok) impersonator.start().catch((e) => console.warn("[cloudora] real-browser fetcher failed to start:", e.message)); });

const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
// changes whenever the app files do, so open tabs can tell a new version was deployed even if the number didn't change
const buildId = () => { try { return String(Math.max(...["index.html", "app.js", "plugins.js", "style.css", "sw.js"].map((f) => statSync(join(publicPath, f)).mtimeMs)) | 0); } catch { return ""; } };

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

// Small in-memory cache for the address-bar suggestions
const cache = new Map();

// Search-as-you-type suggestions for the address bar (DuckDuckGo's public autocomplete, cached, same-origin)
async function suggest(res, q) {
  const json = { "Content-Type": "application/json" };
  q = q.trim().slice(0, 100);
  if (!q) { res.writeHead(200, json); return res.end("[]"); }
  try {
    const key = "sg:" + q.toLowerCase(), hit = cache.get(key);
    if (hit && hit.exp > Date.now()) { res.writeHead(200, json); return res.end(hit.data); }
    const r = await upstream("https://duckduckgo.com/ac/?type=list&q=" + encodeURIComponent(q), { timeout: 2500 });
    const j = JSON.parse(r.body.toString("utf8"));
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
  if (gz) headers["Content-Encoding"] = "gzip"; headers["Vary"] = "Accept-Encoding, User-Agent";
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

// Cross-origin isolation (COOP+COEP) gives proxied pages SharedArrayBuffer for sync XHR, but it also makes the
// browser refuse every third-party iframe that doesn't send CORP/COEP, which is every video embed. Chromium has
// the `credentialless` iframe attribute (the player sets it) that is exempt from that rule, so isolation stays on
// there. Firefox/Safari have no such attribute, so they are served without isolation and the embeds load.
const canIsolate = (ua = "") => /Chrome\/|Chromium\//.test(ua); // Chrome, Edge, Opera, Brave... (Chrome on iOS says CriOS and is WebKit)

const server = createServer((req, res) => {
  if (canIsolate(req.headers["user-agent"])) {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  }
  res.setHeader("Vary", "User-Agent");
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/proxy") return impersonator.handle(req, res);
  if (u.pathname === "/api/config") return impersonateOn.then((imp) => { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify({ impersonate: imp, version: VERSION, build: buildId() })); });
  if (u.pathname === "/api/health") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: true, adblock: true })); }
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
startFilterUpdates({ root: resolve(fileURLToPath(new URL("..", import.meta.url))), liveDir: join(publicPath, "adblock") });

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { impersonator.stop(); server.close(() => process.exit(0)); });
