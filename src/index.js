import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = resolve(fileURLToPath(new URL("../public/", import.meta.url)));

// Wisp = the tunnel your browser uses to reach the open internet via THIS server.
logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  dns_servers: ["1.1.1.3", "1.0.0.3"], // Cloudflare family DNS; change if you like
  // hostname_blacklist: [/example\.com/],  // block sites you don't want proxied
});

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".wasm": "application/wasm",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".map": "application/json",
};
// URL prefix -> folder on disk (first match wins, "/" last)
const MOUNTS = [["/scram/", scramjetPath], ["/libcurl/", libcurlPath], ["/baremux/", baremuxPath], ["/", publicPath]];

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

const server = createServer((req, res) => {
  // Required so the proxy can use SharedArrayBuffer
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  let file = null;
  try { file = findFile(decodeURIComponent(new URL(req.url, "http://x").pathname)); } catch {}
  if (!file || (req.method !== "GET" && req.method !== "HEAD")) {
    res.writeHead(file ? 405 : 404, { "Content-Type": "text/plain" });
    return res.end(file ? "Method not allowed" : "Not found");
  }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
});

server.on("upgrade", (req, socket, head) => {
  if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
  else socket.end();
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, "0.0.0.0", () => console.log(`Skyhop running: http://localhost:${port}`));

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
