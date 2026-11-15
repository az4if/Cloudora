importScripts("/scram/scramjet.all.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Known ad / tracker networks (host and all subdomains). Add your own.
const BLOCK = ("doubleclick.net googlesyndication.com googleadservices.com googletagservices.com adservice.google.com " +
  "google-analytics.com googletagmanager.com adnxs.com adsrvr.org advertising.com amazon-adsystem.com taboola.com " +
  "outbrain.com criteo.com criteo.net rubiconproject.com pubmatic.com openx.net casalemedia.com moatads.com " +
  "scorecardresearch.com quantserve.com hotjar.com adsafeprotected.com yieldmo.com smartadserver.com media.net " +
  "bidswitch.net sharethrough.com 3lift.com indexww.com contextweb.com lijit.com sovrn.com adform.net serving-sys.com " +
  "innovid.com teads.tv popads.net popcash.net propellerads.com exoclick.com juicyads.com trafficjunky.com adcash.com " +
  "mgid.com revcontent.com zedo.com adroll.com bluekai.com demdex.net krxd.net everesttech.net mathtag.com rlcdn.com tapad.com").split(" ");

const idb = (mode, fn) => new Promise((res, rej) => {
  const o = indexedDB.open("cloudora", 1);
  o.onupgradeneeded = () => o.result.createObjectStore("s");
  o.onerror = () => rej(o.error);
  o.onsuccess = () => { const r = fn(o.result.transaction("s", mode).objectStore("s")); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); };
});
let adblock = true;
const ready = idb("readonly", (s) => s.get("adblock")).then((v) => { if (v !== undefined) adblock = v; }).catch(() => {});
self.addEventListener("message", (e) => {
  if (e.data && e.data.cloudora === "adblock") { adblock = !!e.data.on; idb("readwrite", (s) => s.put(adblock, "adblock")).catch(() => {}); }
});

const isAd = (url) => {
  try {
    const host = new URL(decodeURIComponent(new URL(url).pathname.slice((scramjet.config.prefix || "/scramjet/").length))).hostname;
    return BLOCK.some((d) => host === d || host.endsWith("." + d));
  } catch { return false; }
};
async function nested(event) { // is the request coming from inside a proxied page (not Cloudora's own tab frame)?
  const c = event.clientId && (await self.clients.get(event.clientId));
  return !!c && c.url.includes(scramjet.config.prefix || "/scramjet/");
}
const stub = (dest) => dest === "script" ? new Response("", { headers: { "content-type": "text/javascript" } })
  : dest === "style" ? new Response("", { headers: { "content-type": "text/css" } }) : new Response(null, { status: 204 });

async function handle(event) {
  await scramjet.loadConfig();
  if (!scramjet.route(event)) return fetch(event.request);
  await ready;
  const req = event.request;
  if (adblock && isAd(req.url) && (req.mode !== "navigate" || (await nested(event)))) return stub(req.destination);
  return scramjet.fetch(event);
}
self.addEventListener("fetch", (event) => event.respondWith(handle(event)));
