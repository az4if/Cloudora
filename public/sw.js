importScripts("/scram/scramjet.all.js");
importScripts("/adblock/engine.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
const { Net, Cosmetic, domMatch, hostOf } = CloudoraBlock;

// ---------- settings (kept in IndexedDB so they survive the worker being restarted) ----------
const idb = (mode, fn) => new Promise((res, rej) => {
  const o = indexedDB.open("cloudora", 1);
  o.onupgradeneeded = () => o.result.createObjectStore("s");
  o.onerror = () => rej(o.error);
  o.onsuccess = () => { const r = fn(o.result.transaction("s", mode).objectStore("s")); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); };
});
let adblock = true, allow = [], inject = []; // inject: per-site CSS/JS that plugins asked for
const ready = Promise.all([idb("readonly", (s) => s.get("adblock")), idb("readonly", (s) => s.get("allow")), idb("readonly", (s) => s.get("inject"))])
  .then(([a, l, i]) => { if (a !== undefined) adblock = a; if (Array.isArray(l)) allow = l; if (Array.isArray(i)) inject = i; }).catch(() => {});
const save = (k, v) => idb("readwrite", (s) => s.put(v, k)).catch(() => {});

// ---------- filter lists (loaded once per worker start) ----------
let net = null, cos = null, runtimeSrc = "";
const netReady = (async () => {
  try {
    const [d, r] = await Promise.all([fetch("/adblock/net.json").then((x) => x.json()), fetch("/adblock/res.json").then((x) => x.json())]);
    net = new Net(d, r);
  } catch (e) { console.warn("[cloudora] filter lists unavailable", e); }
})();
let cosP = null;
const cosReady = () => cosP || (cosP = (async () => {
  try {
    const [d, rt] = await Promise.all([fetch("/adblock/cosmetic.json").then((x) => x.json()), fetch("/adblock/runtime.js").then((x) => x.text())]);
    cos = new Cosmetic(d); runtimeSrc = rt;
  } catch (e) { console.warn("[cloudora] cosmetic lists unavailable", e); }
})());
// ---------- PWA: the app shell is cached so Cloudora opens offline (sites themselves still need the network) ----------
const SHELL_CACHE = "cloudora-shell";
const SHELL = ["/", "/style.css", "/app.js", "/plugins.js", "/transport-impersonate.mjs", "/site.webmanifest",
  "/icon-192.png", "/icon-512.png", "/icon-maskable-192.png", "/icon-maskable-512.png", "/apple-touch-icon.png",
  "/logo-white.png", "/logo-black.png", "/favicon-black.ico", "/favicon-white.ico", "/favicon-black-32.png", "/favicon-white-32.png"];
const precache = () => caches.open(SHELL_CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).catch(() => {});
self.addEventListener("install", (e) => e.waitUntil(Promise.all([netReady, precache()])));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("cloudora-") && k !== SHELL_CACHE).map((k) => caches.delete(k)))).catch(() => {})));
const isShell = (u) => u.origin === self.location.origin && (SHELL.includes(u.pathname) || u.pathname === "/index.html");
// network first (so updates show up immediately), cached copy when the network is gone
async function shellFetch(event) {
  const req = event.request, cache = await caches.open(SHELL_CACHE);
  const key = req.mode === "navigate" ? "/" : req;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") cache.put(key, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

// ---------- helpers ----------
const prefix = () => scramjet.config.prefix || "/scramjet/";
// Decode a /scramjet/<encoded> URL back to the real address it points at.
function real(url) {
  try { return decodeURIComponent(new URL(url).pathname.slice(prefix().length)); } catch { return ""; }
}
const allowed = (host) => !!host && domMatch(host, allow);
async function ctx(event) { // who is asking? the app's own tab frame, or a page that is itself being proxied?
  const c = event.clientId && (await self.clients.get(event.clientId));
  if (!c || !c.url.includes(prefix())) return { nested: false, doc: "" };
  return { nested: true, doc: hostOf(real(c.url)) };
}
const TYPES = { script: "script", style: "stylesheet", image: "image", font: "font", iframe: "subdocument", frame: "subdocument", audio: "media", video: "media", track: "media", object: "object", embed: "object", worker: "script", sharedworker: "script", serviceworker: "script", document: "document" };
const typeOf = (req) => req.destination === "" ? (req.keepalive ? "ping" : "xmlhttprequest") : TYPES[req.destination] || "other";
const stub = (dest) => dest === "script" ? new Response("", { headers: { "content-type": "text/javascript" } })
  : dest === "style" ? new Response("", { headers: { "content-type": "text/css" } })
  : dest === "image" ? new Response(Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0)), { headers: { "content-type": "image/gif" } })
  : new Response(null, { status: 204 });
async function redirectTo(name, dest) {
  const r = net && net.resource(name);
  if (!r) return stub(dest);
  try { const x = await fetch("/adblock/res/" + r[0]); if (x.ok) return new Response(x.body, { headers: { "content-type": r[1] } }); } catch {}
  return stub(dest);
}

// blocked-request reports go to the app (batched), which shows the count on the shield
let pending = [], flushTimer = 0;
async function toApp(msg) { for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) if (!c.url.includes(prefix())) c.postMessage(msg); }
function report(doc, url, type) {
  pending.push({ doc, url: url.slice(0, 300), type });
  if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = 0; const items = pending; pending = []; toApp({ cloudora: "blocked", items }); }, 300);
}

self.addEventListener("message", (e) => {
  const d = e.data; if (!d || !d.cloudora) return;
  if (d.cloudora === "adblock") { adblock = !!d.on; save("adblock", adblock); }
  else if (d.cloudora === "allow") { allow = Array.isArray(d.hosts) ? d.hosts.slice(0, 500) : []; save("allow", allow); }
  else if (d.cloudora === "inject") { inject = Array.isArray(d.rules) ? d.rules.slice(0, 200) : []; save("inject", inject); }
  else if (d.cloudora === "allow-add" && typeof d.host === "string") { if (!allow.includes(d.host)) allow.push(d.host); save("allow", allow); toApp({ cloudora: "allow", hosts: allow }); }
});

// ---------- HTML injection: hides ad boxes and runs scriptlets before the page's own scripts ----------
const enc = new TextEncoder(), latin1 = new TextDecoder("latin1");
const cat = (a, b, c) => { const o = new Uint8Array(a.length + b.length + (c ? c.length : 0)); o.set(a, 0); o.set(b, a.length); if (c) o.set(c, a.length + b.length); return o; };
function insertAt(buf) { // byte offset just after <head...>, else after <html...>, else before <body, else after the doctype
  const s = latin1.decode(buf), lc = s.toLowerCase();
  for (const tag of ["<head", "<html"]) {
    let i = lc.indexOf(tag);
    while (i >= 0 && /[a-z0-9-]/.test(lc[i + tag.length] || "")) i = lc.indexOf(tag, i + 1);
    if (i >= 0) { const j = lc.indexOf(">", i); if (j >= 0) return j + 1; return -2; }
  }
  const b = lc.indexOf("<body"); if (b >= 0) return b;
  return -1;
}
function injectHead(res, payload) {
  const reader = res.body.getReader();
  let buf = new Uint8Array(0), done = false;
  const body = new ReadableStream({
    async pull(ctrl) {
      if (done) { const r = await reader.read(); return r.done ? ctrl.close() : ctrl.enqueue(r.value); }
      const r = await reader.read();
      if (r.value) buf = cat(buf, r.value);
      const at = insertAt(buf);
      if (at >= 0 || r.done || buf.length > 262144) {
        const p = at >= 0 ? at : 0;
        ctrl.enqueue(cat(buf.subarray(0, p), payload, buf.subarray(p))); buf = null; done = true;
        if (r.done) ctrl.close();
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
const POPUP_GUARD = "(function(){var o=window.open;window.open=function(){try{if(navigator.userActivation&&!navigator.userActivation.isActive)return null}catch(e){}return o.apply(this,arguments)}})();";
// proxied pages: thin scrollbars (no up/down arrow buttons); :where() keeps it weaker than any rule the site sets itself
const SCROLL_TAG = '<style id="cloudora-scroll">:where(*){scrollbar-width:thin}::-webkit-scrollbar-button{display:none;width:0;height:0}</style>';
const SCROLL_CSS = enc.encode(SCROLL_TAG);
// plugin rules: { id, matches: ["*", "example.com", "*.example.com"], css, js }. "example.com" also covers its subdomains.
const siteMatch = (host, p) => { p = String(p).toLowerCase(); if (p === "*") return true; if (p.startsWith("*.")) p = p.slice(2); return host === p || host.endsWith("." + p); };
function pluginTags(host) {
  let out = "";
  for (const r of inject) {
    if (!r || !Array.isArray(r.matches) || !r.matches.some((p) => siteMatch(host, p))) continue;
    const id = String(r.id || "").replace(/[^a-z0-9-]/g, "");
    if (r.css) out += '<style data-cloudora-plugin="' + id + '">' + String(r.css).replace(/<\/style/gi, "<\\/style") + "</style>";
    if (r.js) out += '<script data-cloudora-plugin="' + id + '">try{' + String(r.js).replace(/<\/script/gi, "<\\/script") + "\n}catch(e){console.error('[cloudora plugin " + id + "]',e)}</script>";
  }
  return out;
}
async function decorate(res, pageUrl, scrollOnly = false) {
  const host = hostOf(pageUrl);
  if (!host || res.status !== 200 || !res.body || !/text\/html/i.test(res.headers.get("content-type") || "")) return res;
  const extra = pluginTags(host);
  if (scrollOnly || allowed(host)) return injectHead(res, extra ? cat(SCROLL_CSS, enc.encode(extra)) : SCROLL_CSS);
  await cosReady();
  let css = "", calls = [];
  if (cos) ({ css, calls } = cos.forHost(host));
  let js = POPUP_GUARD;
  if (calls.length && runtimeSrc) js += "try{" + runtimeSrc + "(" + JSON.stringify(calls).replace(/</g, "\\u003c") + ")}catch(e){}";
  const html = SCROLL_TAG + '<link rel="stylesheet" href="' + self.location.origin + '/adblock/generic.css">' +
    (css ? '<style id="cloudora-cosmetic">' + css.replace(/<\//g, "<\\/") + "</style>" : "") +
    '<script id="cloudora-scriptlets">' + js.replace(/<\/script/gi, "<\\/script") + "</script>" + extra;
  return injectHead(res, enc.encode(html));
}

const blockedPage = (url) => new Response(
  '<!doctype html><meta charset=utf-8><title>Blocked</title><meta name=viewport content="width=device-width,initial-scale=1"><body style="font:15px system-ui;background:#0b0b0d;color:#eee;display:grid;place-items:center;height:100vh;margin:0"><div style="max-width:440px;padding:24px"><h2 style="margin:0 0 8px">Blocked by Cloudora</h2><p style="color:#9a9aa5">This address is on a malware / tracking blocklist:</p><p style="word-break:break-all;color:#cfcfd6">' +
  url.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])) + '</p><button onclick="history.back()" style="padding:8px 14px;margin-right:8px">Go back</button><button id=a style="padding:8px 14px">Allow this site</button></div><script>a.onclick=()=>{navigator.serviceWorker.controller.postMessage({cloudora:"allow-add",host:' + JSON.stringify(hostOf(url)) + '});setTimeout(()=>location.reload(),150)}</script>',
  { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });

async function handle(event) {
  await scramjet.loadConfig();
  if (!scramjet.route(event)) {
    const u = new URL(event.request.url);
    if (event.request.method === "GET" && (isShell(u) || (event.request.mode === "navigate" && u.origin === self.location.origin && u.pathname === "/"))) return shellFetch(event);
    return fetch(event.request);
  }
  await ready;
  const req = event.request;
  if (!adblock) {
    const out = await scramjet.fetch(event);
    if (req.mode === "navigate" || req.destination === "document" || req.destination === "iframe" || req.destination === "frame") { try { return await decorate(out, real(req.url), true); } catch {} }
    return out;
  }
  await netReady;
  const target = real(req.url);
  const { nested, doc } = await ctx(event);
  const isNav = req.mode === "navigate" || req.destination === "document" || req.destination === "iframe" || req.destination === "frame";
  if (net && target && !allowed(doc) && !allowed(hostOf(target))) {
    const type = isNav ? (nested ? "subdocument" : "document") : typeOf(req);
    const hit = net.match(target, type, nested ? doc : "");
    if (hit) {
      report(doc || hostOf(target), target, type);
      if (isNav && !nested) return blockedPage(target);
      return hit.redirect ? redirectTo(hit.redirect, req.destination) : stub(req.destination);
    }
  }
  const res = await scramjet.fetch(event);
  if (isNav && target) { try { return await decorate(res, target); } catch (e) { console.warn("[cloudora] inject failed", e); } }
  return res;
}
self.addEventListener("fetch", (event) => event.respondWith(handle(event)));
