// Compiles ad-block filter lists (EasyList, EasyPrivacy, uBlock filters...) into the compact files
// Cloudora's service worker and pages load from /adblock/.
//
//   node scripts/build-filters.mjs              compile adblock-src/*.txt
//   node scripts/build-filters.mjs --download   refresh adblock-src/ from the public mirrors first
//
// Lists are © their authors (GPLv3 / CC BY-SA); see adblock-src/ headers.
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "adblock-src");
const OUT = join(root, "public", "adblock");
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, "res"), { recursive: true });

const LISTS = [
  ["easylist.txt", "https://ublockorigin.github.io/uAssetsCDN/thirdparties/easylist.txt"],
  ["easyprivacy.txt", "https://ublockorigin.github.io/uAssetsCDN/thirdparties/easyprivacy.txt"],
  ["ublock-filters.txt", "https://ublockorigin.github.io/uAssetsCDN/filters/filters.min.txt"],
  ["ublock-privacy.txt", "https://ublockorigin.github.io/uAssetsCDN/filters/privacy.min.txt"],
  ["ublock-badware.txt", "https://ublockorigin.github.io/uAssetsCDN/filters/badware.min.txt"],
  ["ublock-unbreak.txt", "https://ublockorigin.github.io/uAssetsCDN/filters/unbreak.min.txt"],
  ["ublock-quick-fixes.txt", "https://ublockorigin.github.io/uAssetsCDN/filters/quick-fixes.min.txt"],
];

if (process.argv.includes("--download")) {
  for (const [file, url] of LISTS) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const text = await r.text();
      if (text.length < 5000) throw new Error("suspiciously small");
      writeFileSync(join(SRC, file), text);
      console.log("downloaded", file, (text.length / 1024) | 0, "KB");
    } catch (e) { console.warn("kept bundled", file, "-", e.message); }
  }
}

// ---------- network rules ----------
const T = { script: 1, image: 2, stylesheet: 4, xmlhttprequest: 8, subdocument: 16, media: 32, font: 64, object: 128, ping: 256, websocket: 512, other: 1024, document: 2048, popup: 4096 };
const DEFAULT = 2047;
const TYPE_ALIAS = { css: "stylesheet", xhr: "xmlhttprequest", frame: "subdocument", doc: "document", beacon: "ping", "object-subrequest": "object", popunder: "popup" };
// flags
const F_HOST = 1, F_START = 2, F_END = 4, F_REGEX = 8, F_CASE = 16, F_EXC = 32, F_IMP = 64, F_3P = 128, F_1P = 256;
const UNSUPPORTED = new Set(["removeparam", "urlskip", "csp", "replace", "header", "method", "ipaddress", "uritransform", "rewrite", "permissions", "reason", "to", "strict1p", "strict3p", "cname", "inline-script", "inline-font", "generichide", "ghide", "elemhide", "ehide", "specifichide", "shide", "queryprune", "redirect-rule", "extension", "empty", "mp4", "1p-only"]);

const rules = [];         // [pattern, flags, typeMask, domains|0, notDomains|0, denyallow|0, redirect|0]
const badfilters = new Set();
const cosmetic = { generic: new Set(), hosts: new Map(), unhide: new Map(), genericUnhide: new Set(), ents: new Map() };
const scriptlets = new Map(); // host|'*' -> [[name,...args]]
const scriptletUnhide = new Map();
const stats = { net: 0, skipped: 0, cosmetic: 0, scriptlet: 0 };

const PROCEDURAL = /:(?:has-text|contains|-abp-[a-z-]+|matches-css(?:-before|-after)?|matches-media|matches-path|matches-attr|matches-property|min-text-length|watch-attr|nth-ancestor|upward|xpath|remove|style|others|not\(:|-js-[a-z-]+|if|if-not|has-text)\b|^\^|\[\$/;

function addTo(map, key, val) { let s = map.get(key); if (!s) map.set(key, (s = new Set())); s.add(val); }

function parseDomains(list) {
  const inc = [], exc = [];
  for (let d of list.split("|")) {
    d = d.trim().toLowerCase();
    if (!d || d.includes("/") || d.startsWith("/")) continue;
    if (d.startsWith("~")) exc.push(d.slice(1)); else inc.push(d);
  }
  return [inc, exc];
}

function parseNetwork(raw) {
  let line = raw, exception = false;
  if (line.startsWith("@@")) { exception = true; line = line.slice(2); }
  let pattern = line, optStr = "";
  const i = line.lastIndexOf("$");
  if (i >= 0 && /^[a-z0-9~_\-=|.,*:+\/\s]+$/i.test(line.slice(i + 1)) && !(line.startsWith("/") && line.slice(i + 1) === "/")) {
    // a '$' that ends a regex (".../$") is not an option marker; everything else is
    pattern = line.slice(0, i); optStr = line.slice(i + 1);
  }
  let flags = exception ? F_EXC : 0, mask = 0, negMask = 0, inc = [], exc = [], deny = [], redirect = 0, badfilter = false;
  if (optStr) {
    for (let opt of optStr.split(",")) {
      opt = opt.trim(); if (!opt) continue;
      const neg = opt.startsWith("~"); if (neg) opt = opt.slice(1);
      let [k, v] = [opt, ""]; const eq = opt.indexOf("="); if (eq > 0) { k = opt.slice(0, eq); v = opt.slice(eq + 1); }
      k = k.toLowerCase(); k = TYPE_ALIAS[k] || k;
      if (k in T) { if (neg) negMask |= T[k]; else mask |= T[k]; }
      else if (k === "third-party" || k === "3p") flags |= neg ? F_1P : F_3P;
      else if (k === "first-party" || k === "1p") flags |= neg ? F_3P : F_1P;
      else if (k === "domain" || k === "from") { const [a, b] = parseDomains(v); inc.push(...a); exc.push(...b); }
      else if (k === "denyallow") deny.push(...v.toLowerCase().split("|").filter(Boolean));
      else if (k === "important") flags |= F_IMP;
      else if (k === "match-case") flags |= F_CASE;
      else if (k === "badfilter") badfilter = true;
      else if (k === "all") mask |= DEFAULT | T.document | T.popup;
      else if (k === "redirect") { if (!exception) redirect = v || 0; }
      else if (k === "other" || k === "xmlhttprequest") mask |= T[k];
      else if (UNSUPPORTED.has(k)) return null;
      else return null;
    }
  }
  if (badfilter) { badfilters.add(raw.replace(/,?badfilter/, "")); return null; }
  let typeMask = mask ? mask : DEFAULT;
  if (negMask) typeMask = (mask || DEFAULT) & ~negMask;
  if (typeMask === T.popup) return null; // popup-only rules: handled by the in-page window.open guard
  if (!pattern && !(inc.length)) return null; // would match everything
  // pattern anchors
  if (pattern.length > 2 && pattern.startsWith("/") && pattern.endsWith("/")) {
    try { new RegExp(pattern.slice(1, -1)); } catch { return null; }
    flags |= F_REGEX; pattern = pattern.slice(1, -1);
    if (!(flags & F_CASE)) flags |= 0; // regex rules are tested case-insensitively
  } else {
    if (pattern.startsWith("||")) { flags |= F_HOST; pattern = pattern.slice(2); }
    else if (pattern.startsWith("|")) { flags |= F_START; pattern = pattern.slice(1); }
    if (pattern.endsWith("|")) { flags |= F_END; pattern = pattern.slice(0, -1); }
    if (!(flags & F_CASE)) pattern = pattern.toLowerCase();
    if (pattern === "*" || pattern === "") { if (!inc.length) return null; }
  }
  return { pattern, flags, typeMask, inc, exc, deny, redirect };
}

// ---------- cosmetic / scriptlet rules ----------
function splitArgs(s) {
  const out = []; let cur = "", q = "", esc = false, depth = 0;
  for (const c of s) {
    if (esc) { cur += c === "," ? "," : "\\" + c; esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (q) { if (c === q) q = ""; cur += c; continue; }
    if ((c === "'" || c === '"') && !cur.trim()) { q = c; cur += c; continue; }
    if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out.map((a) => (/^(['"])[\s\S]*\1$/.test(a) ? a.slice(1, -1) : a));
}

function parseCosmetic(line) {
  const m = /^([^\s#$"'\/]*?)(##|#@#)(.+)$/.exec(line);
  if (!m) return false;
  const [, doms, op, body] = m;
  const unhide = op === "#@#";
  const list = doms ? doms.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean) : [];
  const inc = list.filter((d) => !d.startsWith("~")), exc = list.filter((d) => d.startsWith("~")).map((d) => d.slice(1));
  if (body.startsWith("+js(") && body.endsWith(")")) {
    const args = splitArgs(body.slice(4, -1));
    if (!args[0] || /^trusted-/.test(args[0])) return true;
    const target = scriptlets, un = scriptletUnhide;
    const key = JSON.stringify(args);
    if (unhide) { for (const d of inc.length ? inc : ["*"]) addTo(un, d, args[0]); }
    else {
      const rec = exc.length ? [args, exc] : [args];
      for (const d of inc.length ? inc : ["*"]) { let a = target.get(d); if (!a) target.set(d, (a = new Map())); a.set(key, rec); }
    }
    stats.scriptlet++;
    return true;
  }
  if (PROCEDURAL.test(body)) return true;
  if (body.length > 400) return true;
  stats.cosmetic++;
  if (unhide) {
    if (!inc.length) cosmetic.genericUnhide.add(body);
    else for (const d of inc) addTo(cosmetic.unhide, d, body);
    return true;
  }
  if (!inc.length) { if (exc.length) addTo(cosmetic.hosts, "~" + exc.join("|"), body); else cosmetic.generic.add(body); return true; }
  for (const d of inc) {
    if (d.endsWith(".*")) addTo(cosmetic.ents, d.slice(0, -2), body); else addTo(cosmetic.hosts, d, body);
  }
  return true;
}

// ---------- run ----------
const files = readdirSync(SRC).filter((f) => f.endsWith(".txt")).sort().map((f) => join(SRC, f));
for (const a of process.argv) if (a.startsWith("--extra=")) files.push(a.slice(8)); // e.g. your own rules: --extra=my-rules.txt
const parsed = [];
for (const f of files) {
  for (let line of readFileSync(f, "utf8").split("\n")) {
    line = line.trim();
    if (!line || line[0] === "!" || line.startsWith("[Adblock")) continue;
    if (/#[?$%]#|#@[?$%]#|\$\$/.test(line)) continue;
    if (/^[^\s#$]*#@?#/.test(line) && !line.startsWith("||") && !line.startsWith("@@")) { parseCosmetic(line); continue; }
    if (line.includes("$badfilter")) { badfilters.add(line.replace(/,?badfilter/, "")); continue; }
    parsed.push(line);
  }
}
const seen = new Set();
for (const line of parsed) {
  if (badfilters.has(line)) continue;
  const r = parseNetwork(line);
  if (!r) { stats.skipped++; continue; }
  const key = line;
  if (seen.has(key)) continue; seen.add(key);
  rules.push(r); stats.net++;
}

// token indexing: pick the rarest delimited alphanumeric token of each rule
const tokensOf = (r) => {
  if (r.flags & F_REGEX) return [];
  const p = r.pattern, out = [];
  const re = /[a-z0-9%]{3,}/gi; let m;
  while ((m = re.exec(p))) {
    const s = m.index, e = s + m[0].length;
    const before = s === 0 ? ((r.flags & (F_HOST | F_START)) ? "|" : "*") : p[s - 1];
    const after = e === p.length ? ((r.flags & F_END) ? "|" : (r.flags & F_REGEX) ? "*" : "$") : p[e];
    if (before === "*" || after === "*") continue;
    if (e === p.length && !(r.flags & F_END) && p[e - 1] !== "^") { /* trailing token may be a prefix: unsafe */ continue; }
    out.push(r.flags & F_CASE ? m[0].toLowerCase() : m[0]);
  }
  return out;
};
const freq = new Map();
const cand = rules.map(tokensOf);
for (const ts of cand) for (const t of ts) freq.set(t, (freq.get(t) || 0) + 1);

const HOSTRE = /^[a-z0-9][a-z0-9.-]*\.[a-z0-9-]+$/;
const set0 = () => ({ rules: [], buckets: Object.create(null), generic: [], hosts: Object.create(null), hostRules: Object.create(null) });
const out = { v: 1, built: new Date().toISOString().slice(0, 10), ...set0(), exc: set0(), imp: set0() };
rules.forEach((r, i) => {
  const set = r.flags & F_EXC ? out.exc : r.flags & F_IMP ? out.imp : out;
  const plain = r.typeMask === DEFAULT && !(r.flags & (F_3P | F_1P)) && !r.inc.length && !r.exc.length && !r.deny.length && !r.redirect;
  const hostOnly = (r.flags & F_HOST) && /\^$/.test(r.pattern) && HOSTRE.test(r.pattern.slice(0, -1)) && !(r.flags & F_END);
  // document-only rules go in with their own mask so only top-level navigation can match them
  const row = [r.pattern, r.flags & ~(F_EXC | F_IMP), r.typeMask, r.inc.length ? r.inc : 0, r.exc.length ? r.exc : 0, r.deny.length ? r.deny : 0, r.redirect || 0];
  while (row.length && (row[row.length - 1] === 0)) row.pop();
  if (hostOnly) {
    const h = r.pattern.slice(0, -1);
    if (plain) { set.hosts[h] = 1; return; }
    (set.hostRules[h] ||= []).push(row.slice(2)); // [mask, inc, exc, deny, redirect] + flags below
    set.hostRules[h][set.hostRules[h].length - 1].unshift(r.flags & ~(F_EXC | F_IMP | F_HOST | F_END));
    return;
  }
  const idx = set.rules.length; set.rules.push(row);
  const ts = cand[i];
  if (!ts.length) { set.generic.push(idx); return; }
  let best = ts[0];
  for (const t of ts) { const a = freq.get(t), b = freq.get(best); if (a < b || (a === b && t.length > best.length)) best = t; }
  (set.buckets[best.toLowerCase()] ||= []).push(idx);
});

const sizeOf = (o) => JSON.stringify(o).length;
writeFileSync(join(OUT, "net.json"), JSON.stringify(out));

// cosmetic output (scriptlet rules are stored once and referenced by index from each host)
const SL_RULES = [], SL_INDEX = new Map();
for (const m of scriptlets.values()) for (const [k, rec] of m) if (!SL_INDEX.has(k)) { SL_INDEX.set(k, SL_RULES.length); SL_RULES.push(rec); }
const sets = (m) => Object.fromEntries([...m].map(([k, v]) => [k, [...v]]));
const cosOut = {
  v: 1,
  hosts: sets(cosmetic.hosts),
  unhide: sets(cosmetic.unhide),
  ents: sets(cosmetic.ents),
  scriptletRules: SL_RULES,
  scriptlets: Object.fromEntries([...scriptlets].map(([h, m]) => [h, [...m.keys()].map((k) => SL_INDEX.get(k))])),
  scriptletUnhide: Object.fromEntries([...scriptletUnhide].map(([h, s]) => [h, [...s]])),
};
writeFileSync(join(OUT, "cosmetic.json"), JSON.stringify(cosOut));
// generic hiding rules ship as a static stylesheet (cached once, linked from every page)
const genericCss = [...cosmetic.generic].filter((s) => !cosmetic.genericUnhide.has(s)).map((s) => s + "{display:none!important}").join("\n");
writeFileSync(join(OUT, "generic.css"), genericCss);

// redirect resources
const resSrc = join(SRC, "resources");
const aliasMap = {};
const MIME = { js: "text/javascript", css: "text/css", html: "text/html", txt: "text/plain", json: "application/json", gif: "image/gif", png: "image/png", mp4: "video/mp4", mp3: "audio/mpeg", xml: "text/xml" };
const resFiles = existsSync(resSrc) ? readdirSync(resSrc) : [];
for (const f of resFiles) { copyFileSync(join(resSrc, f), join(OUT, "res", f)); aliasMap[f] = [f, MIME[f.split(".").pop()] || "application/octet-stream"]; }
const rr = existsSync(join(SRC, "redirect-resources.js")) ? readFileSync(join(SRC, "redirect-resources.js"), "utf8") : "";
for (const m of rr.matchAll(/\[\s*'([^']+)'\s*,\s*\{([\s\S]*?)\}\s*\]/g)) {
  const name = m[1], body = m[2];
  const al = [...body.matchAll(/alias:\s*(\[[^\]]*\]|'[^']*')/g)].flatMap((a) => [...a[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  if (aliasMap[name]) for (const a of al) aliasMap[a] = aliasMap[name];
}
Object.assign(aliasMap, {
  noopjs: aliasMap["noop.js"], "noop.js": aliasMap["noop.js"], noopcss: aliasMap["noop.css"], nooptext: aliasMap["noop.txt"], "noop.txt": aliasMap["noop.txt"], noopframe: aliasMap["noop.html"],
  "noopmp3-0.1s": aliasMap["noop-0.1s.mp3"], "noopmp4-1s": aliasMap["noop-1s.mp4"], noopvast2: aliasMap["noop-vast2.xml"], noopvast3: aliasMap["noop-vast3.xml"], noopvast4: aliasMap["noop-vast4.xml"], "1x1-transparent.gif": aliasMap["1x1.gif"],
});
for (const k of Object.keys(aliasMap)) if (!aliasMap[k]) delete aliasMap[k];
writeFileSync(join(OUT, "res.json"), JSON.stringify(aliasMap));

writeFileSync(join(OUT, "info.json"), JSON.stringify({ built: out.built, lists: files.map((f) => f.split("/").pop().replace(/\.txt$/, "")), network: stats.net, cosmetic: stats.cosmetic, scriptlets: stats.scriptlet }));
console.log("rules:", stats, "\nnet.json", (sizeOf(out) / 1024) | 0, "KB; cosmetic.json", (sizeOf(cosOut) / 1024) | 0, "KB");
console.log("generic selectors:", cosmetic.generic.size, "| hosts with selectors:", cosmetic.hosts.size, "| scriptlet hosts:", scriptlets.size, "| plain host blocks:", Object.keys(out.hosts).length, "| token buckets:", Object.keys(out.buckets).length, "| tokenless:", out.generic.length);
