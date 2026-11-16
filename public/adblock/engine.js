// Cloudora ad-block engine. Loaded by the service worker (importScripts) and by pages.
// Network matching follows Adblock Plus / uBlock Origin filter syntax (||host^, |, *, ^, $options, @@ exceptions).
(function (g) {
  "use strict";
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const T = { script: 1, image: 2, stylesheet: 4, xmlhttprequest: 8, subdocument: 16, media: 32, font: 64, object: 128, ping: 256, websocket: 512, other: 1024, document: 2048, popup: 4096 };
  const F_HOST = 1, F_START = 2, F_END = 4, F_REGEX = 8, F_CASE = 16, F_3P = 128, F_1P = 256;
  const TOKEN = /[a-z0-9%]{3,}/g;
  const SLDS = new Set(["co", "com", "org", "net", "gov", "edu", "ac", "or", "ne", "go", "gob", "mil"]);

  const hostOf = (url) => { const m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^/?#@]*@)?(\[[^\]]+\]|[^/?#:]+)/i.exec(url); return m ? m[1].toLowerCase() : ""; };
  function regDomain(h) {
    if (!h || /^[\d.]+$/.test(h) || h.includes(":")) return h;
    const p = h.split(".");
    if (p.length <= 2) return h;
    const tld = p[p.length - 1], sld = p[p.length - 2];
    return (tld.length === 2 && SLDS.has(sld) ? p.slice(-3) : p.slice(-2)).join(".");
  }
  function domMatch(host, list) {
    for (const d of list) {
      if (d.endsWith(".*")) { const n = d.slice(0, -2); if (host === n || host.startsWith(n + ".") || host.includes("." + n + ".") || host.endsWith("." + n)) return true; continue; }
      if (host === d || (host.length > d.length && host.endsWith(d) && host[host.length - d.length - 1] === ".")) return true;
    }
    return false;
  }
  function optsOk(flags, mask, inc, exc, deny, type, third, docHost, host) {
    if (!(mask & type)) return false;
    if (flags & F_3P && !third) return false;
    if (flags & F_1P && third) return false;
    if (inc && (!docHost || !domMatch(docHost, inc))) return false;
    if (exc && docHost && domMatch(docHost, exc)) return false;
    if (deny && domMatch(host, deny)) return false;
    return true;
  }
  function compile(row) {
    const flags = row[1];
    if (flags & F_REGEX) { try { return new RegExp(row[0], flags & F_CASE ? "" : "i"); } catch { return null; } }
    let s = "";
    for (const c of row[0]) {
      if (c === "*") s += ".*";
      else if (c === "^") s += "(?:[^\\w.%-]|$)";
      else s += /[.+?${}()|[\]\\\/]/.test(c) ? "\\" + c : c;
    }
    if (flags & F_HOST) s = "^[a-z][a-z0-9+.\\-]*:\\/\\/(?:[^\\/?#]*\\.)?" + s;
    else if (flags & F_START) s = "^" + s;
    if (flags & F_END) s += "$";
    try { return new RegExp(s); } catch { return null; }
  }

  class RuleSet {
    constructor(d) { this.d = d; this.rx = new Array(d.rules.length); }
    find(url, lc, host, tokens, type, third, docHost) {
      const d = this.d;
      // 1. hostname rules (||host^)
      for (let h = host; h; ) {
        if (own(d.hosts, h) && (type & 2047)) return {};
        if (own(d.hostRules, h)) for (const r of d.hostRules[h]) if (optsOk(r[0], r[1], r[2], r[3], r[4], type, third, docHost, host)) return { redirect: r[5] };
        const i = h.indexOf("."); if (i < 0) break; h = h.slice(i + 1);
      }
      // 2. token-indexed pattern rules, then rules without a usable token
      for (const t of tokens) if (own(d.buckets, t)) { const r = this.scan(d.buckets[t], url, lc, host, type, third, docHost); if (r) return r; }
      return this.scan(d.generic, url, lc, host, type, third, docHost);
    }
    scan(list, url, lc, host, type, third, docHost) {
      const rules = this.d.rules;
      for (const idx of list) {
        const r = rules[idx];
        if (!optsOk(r[1], r[2], r[3], r[4], r[5], type, third, docHost, host)) continue;
        let rx = this.rx[idx];
        if (rx === undefined) rx = this.rx[idx] = compile(r);
        if (rx && rx.test(r[1] & (F_CASE | F_REGEX) ? url : lc)) return { redirect: r[6] };
      }
      return null;
    }
  }

  class Net {
    constructor(d, res) {
      this.blk = new RuleSet(d); this.exc = new RuleSet(d.exc); this.imp = new RuleSet(d.imp);
      this.res = res || {}; this.built = d.built;
    }
    // type: one of T keys. docHost: hostname of the page making the request ("" for top-level).
    match(url, type, docHost) {
      const t = T[type] || T.other;
      const lc = url.toLowerCase(), host = hostOf(lc);
      if (!host) return null;
      const third = !!docHost && regDomain(host) !== regDomain(docHost);
      const tokens = [...new Set(lc.match(TOKEN) || [])].slice(0, 96);
      const hit = this.imp.find(url, lc, host, tokens, t, third, docHost);
      if (hit) return { redirect: null };
      const b = this.blk.find(url, lc, host, tokens, t, third, docHost);
      if (!b) return null;
      if (this.exc.find(url, lc, host, tokens, t, third, docHost)) return null;
      return { redirect: b.redirect ? String(b.redirect).split(":")[0] : null };
    }
    resource(name) { return this.res[name] || null; }
  }

  // ---------- cosmetic filtering ----------
  class Cosmetic {
    constructor(d) {
      this.d = d;
      this.exGeneric = Object.keys(d.hosts).filter((k) => k[0] === "~").map((k) => [k.slice(1).split("|"), d.hosts[k]]);
    }
    chain(host) {
      const out = [], p = host.split(".");
      for (let i = 0; i < p.length - 1; i++) out.push(p.slice(i).join("."));
      return out;
    }
    entities(host) {
      const p = host.split("."), out = [];
      for (let i = 0; i < p.length - 1; i++) for (const cut of [1, 2]) { const q = p.slice(i, p.length - cut); if (q.length) out.push(q.join(".")); }
      return out;
    }
    forHost(host) {
      const d = this.d, chain = this.chain(host), ents = this.entities(host);
      const sel = new Set(), unhide = new Set();
      for (const h of chain) {
        if (own(d.hosts, h)) for (const s of d.hosts[h]) sel.add(s);
        if (own(d.unhide, h)) for (const s of d.unhide[h]) unhide.add(s);
      }
      for (const e of ents) {
        if (own(d.ents, e)) for (const s of d.ents[e]) sel.add(s);
      }
      for (const [ex, list] of this.exGeneric) if (!domMatch(host, ex)) for (const s of list) sel.add(s);
      let css = "";
      for (const s of sel) if (!unhide.has(s)) css += s + "{display:none!important}\n";
      for (const s of unhide) css += s + "{display:revert!important}\n";
      // scriptlets
      const calls = [], off = new Set();
      for (const h of [...chain, ...ents.map((e) => e + ".*")]) if (own(d.scriptletUnhide, h)) for (const n of d.scriptletUnhide[h]) off.add(n);
      const idx = new Set();
      for (const h of [...chain, ...ents.map((e) => e + ".*"), "*"]) if (own(d.scriptlets, h)) for (const i of d.scriptlets[h]) idx.add(i);
      for (const i of idx) {
        const [args, exc] = d.scriptletRules[i];
        if (exc && domMatch(host, exc)) continue;
        if (off.has(args[0])) continue;
        calls.push(args);
      }
      return { css, calls };
    }
  }

  g.CloudoraBlock = { T, hostOf, regDomain, domMatch, Net, Cosmetic };
})(typeof self !== "undefined" ? self : globalThis);
