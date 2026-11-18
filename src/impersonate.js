// "Real browser" transport, server side.
//
// The default transport (libcurl.js in the visitor's browser) does its own TLS, so sites see a curl-style
// TLS/HTTP2 fingerprint no matter what headers are sent. This module lets the browser hand each proxied HTTP
// request to the server instead (POST /api/proxy), which fetches it through scripts/curl_proxy.py: curl_cffi
// speaking Chrome/Firefox/Safari's real TLS + HTTP/2 + header order. The profile is picked from the visitor's own
// User-Agent so TLS and headers agree. WebSockets still go through the Wisp tunnel.
//
// Needs python3 + `pip install curl_cffi`; otherwise available() is false and the app keeps using libcurl.js.
// Env: CLOUDORA_IMPERSONATE=0 disables it, IMPERSONATE_PROFILE=chrome|firefox|safari|chrome142... forces a profile.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import net from "node:net";
import { Resolver, promises as dnsp } from "node:dns";
import { fileURLToPath } from "node:url";
import { curlCffiAvailable } from "./upstream.js";

const SCRIPT = fileURLToPath(new URL("../scripts/curl_proxy.py", import.meta.url));
const PYTHON = process.env.PYTHON || "python3";
const MAX_BODY = 32 * 1024 * 1024;
const MAX_INFLIGHT = 96;

// ---- which browser are we pretending to be? matches the visitor's UA so TLS and headers agree ----
export function profileFor(ua = "") {
  if (process.env.IMPERSONATE_PROFILE) return process.env.IMPERSONATE_PROFILE;
  if (/Firefox\/|FxiOS\//.test(ua) && !/Seamonkey/i.test(ua)) return /FxiOS\//.test(ua) ? "safari_ios" : "firefox"; // Firefox on iOS is WebKit
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return "safari_ios";
  if (/Safari\//.test(ua) && /Version\/\d/.test(ua) && !/Chrome\/|Chromium\/|Android/.test(ua)) return "safari";
  return "chrome"; // Chrome, Edge, Opera, Brave, Samsung Internet... all share Chrome's TLS stack
}

// ---- policy: same rules the Wisp tunnel applies (no localhost / private networks / bare IPs) ----
export function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    const m = /^(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/.exec(x); // v4-mapped / compatible
    if (m) return isPrivateIp(m[1]);
    return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || /^ff/.test(x) || x.startsWith("64:ff9b:") || x.startsWith("2001:db8");
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !(n >= 0 && n <= 255))) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && p[2] === 0) || (a === 198 && (b === 18 || b === 19));
}

export class Impersonator {
  constructor({ dnsServers = [], blacklist = [], allowLocal = false } = {}) {
    this.allowLocal = allowLocal;
    this.blacklist = blacklist;
    this.resolver = new Resolver();
    if (dnsServers.length) this.resolver.setServers(dnsServers);
    this.dnsCache = new Map();
    this.token = randomBytes(24).toString("hex");
    this.port = 0;
    this.child = null;
    this.starting = null;
    this.inflight = 0;
    this.enabled = process.env.CLOUDORA_IMPERSONATE !== "0";
    this.failedAt = 0;
  }

  // is the feature usable on this server? (python + curl_cffi present and not disabled)
  async available() { return this.enabled && (await curlCffiAvailable()); }

  async start() {
    if (this.port && this.child && this.child.exitCode === null) return;
    if (Date.now() - this.failedAt < 10_000) throw new Error("fetcher unavailable");
    return (this.starting ||= new Promise((resolve, reject) => {
      const child = spawn(PYTHON, [SCRIPT], { env: { ...process.env, CLOUDORA_TOKEN: this.token }, stdio: ["pipe", "pipe", "inherit"] });
      let buf = "", done = false;
      const fail = (e) => { if (done) return; done = true; this.failedAt = Date.now(); this.starting = null; try { child.kill(); } catch {} reject(e); };
      const timer = setTimeout(() => fail(new Error("fetcher start timeout")), 15_000);
      child.stdout.on("data", (d) => {
        if (done) return;
        buf += d;
        const m = /PORT (\d+)/.exec(buf);
        if (m) { done = true; clearTimeout(timer); this.port = +m[1]; this.child = child; this.starting = null; resolve(); }
      });
      child.on("error", fail);
      child.on("exit", () => { if (this.child === child) { this.child = null; this.port = 0; } fail(new Error("fetcher exited")); });
      process.once("exit", () => { try { child.kill(); } catch {} });
    }));
  }

  stop() { try { this.child?.kill(); } catch {} }

  // resolve a hostname to ONE public address (the fetcher pins it so DNS can't change underneath us)
  async resolve(host) {
    if (this.blacklist.some((re) => re.test(host))) throw new Error("host blocked");
    if (net.isIP(host)) { if (!this.allowLocal) throw new Error("direct IP addresses are blocked"); return host; }
    const hit = this.dnsCache.get(host);
    if (hit && hit.exp > Date.now()) return hit.ip;
    let ips = [];
    if (this.allowLocal) ips = (await dnsp.lookup(host, { all: true })).map((a) => a.address);
    else {
      for (const fn of ["resolve4", "resolve6"]) { try { ips = ips.concat(await this.resolver[fn](host)); } catch {} }
    }
    if (!ips.length) throw new Error("could not resolve " + host);
    if (!this.allowLocal && ips.some(isPrivateIp)) throw new Error("host resolves to a private address");
    const ip = ips.find((i) => net.isIPv4(i)) || ips[0];
    if (this.dnsCache.size > 500) this.dnsCache.clear();
    this.dnsCache.set(host, { ip, exp: Date.now() + 60_000 });
    return ip;
  }

  // POST /api/proxy. Body: [u32 len][JSON {url,method,headers}][request body]. Reply: [u32 len][JSON meta][body stream]
  async handle(req, res) {
    const fail = (code, msg, extra = {}) => { if (!res.headersSent) res.writeHead(code, { "Content-Type": "text/plain", "Cache-Control": "no-store", ...extra }); res.end(msg); };
    if (req.method !== "POST") return fail(405, "POST only");
    if (!(await this.available())) return fail(503, "unavailable", { "x-cloudora-impersonate": "off" });
    if (this.inflight >= MAX_INFLIGHT) return fail(429, "busy");
    this.inflight++;
    let sock = null;
    const done = () => { this.inflight--; sock?.destroy(); };
    res.on("close", done);
    try {
      const chunks = []; let n = 0;
      for await (const c of req) { n += c.length; if (n > MAX_BODY) return fail(413, "too large"); chunks.push(c); }
      const buf = Buffer.concat(chunks);
      if (buf.length < 4) return fail(400, "bad request");
      const jl = buf.readUInt32BE(0);
      if (jl > 256 * 1024 || buf.length < 4 + jl) return fail(400, "bad request");
      const env = JSON.parse(buf.subarray(4, 4 + jl).toString("utf8"));
      const body = buf.subarray(4 + jl);

      const url = new URL(String(env.url));
      if (url.protocol !== "http:" && url.protocol !== "https:") return fail(400, "only http(s)");
      const method = String(env.method || "GET").toUpperCase();
      if (!/^[A-Z]{3,10}$/.test(method)) return fail(400, "bad method");

      // headers: drop hop-by-hop ones, refuse anything that could smuggle a second request/header
      const headers = {}; let ua = "";
      const SKIP = /^(host|connection|keep-alive|content-length|transfer-encoding|upgrade|te|trailer|accept-encoding|proxy-.*|expect)$/i;
      for (const [k, v] of Object.entries(env.headers || {})) {
        const val = Array.isArray(v) ? v.join(", ") : String(v);
        if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(k) || /[\r\n\0]/.test(val)) return fail(400, "bad header");
        if (SKIP.test(k)) continue;
        if (k.toLowerCase() === "user-agent") ua = val;
        headers[k] = val;
      }

      let ip;
      try { ip = await this.resolve(url.hostname.replace(/^\[|\]$/g, "")); }
      catch (e) { return fail(502, e.message); }
      try { await this.start(); } catch { return fail(503, "unavailable", { "x-cloudora-impersonate": "off" }); }

      const meta = Buffer.from(JSON.stringify({ token: this.token, url: url.href, method, headers, ip, profile: profileFor(ua), body_len: body.length }));
      const head = Buffer.alloc(4); head.writeUInt32BE(meta.length);
      if (process.env.CLOUDORA_DEBUG) console.log(`[cloudora] proxy ${method} ${url.origin}${url.pathname} -> ${ip} as ${profileFor(ua)}`);
      sock = net.connect(this.port, "127.0.0.1");
      sock.on("error", () => { if (!res.headersSent) fail(502, "fetcher error"); else res.destroy(); });
      sock.write(Buffer.concat([head, meta, body]));
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
      sock.pipe(res);
    } catch (e) { fail(400, "bad request"); }
  }
}
