(function (calls) {
  // Cloudora scriptlets: small page-world defences that the filter lists ask for with  site##+js(name, args...)
  "use strict";
  var W = window, noop = function () {}, T = function () { return true; }, F = function () { return false; };
  var rnd = function () { return Math.random().toString(36).slice(2, 10); };
  function toRe(p) {
    if (p === undefined || p === "") return null;
    var neg = false; if (p[0] === "!") { neg = true; p = p.slice(1); }
    var m = /^\/(.+)\/([gimsu]*)$/.exec(p), re;
    try { re = m ? new RegExp(m[1], m[2].replace("g", "")) : new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); } catch (e) { return null; }
    return { test: function (s) { return re.test(String(s)) !== neg; } };
  }
  function valueOf(v) {
    switch (v) {
      case "undefined": return undefined; case "false": return false; case "true": return true; case "null": return null;
      case "noopFunc": return noop; case "trueFunc": return T; case "falseFunc": return F; case "throwFunc": return function () { throw 0; };
      case "emptyStr": case "": return ""; case "emptyArr": return []; case "emptyObj": return {};
      case "yes": case "no": case "on": case "off": case "accept": case "reject": case "allow": case "deny": return v;
      case "noopPromiseResolve": return function () { return Promise.resolve(); };
      case "noopPromiseReject": return function () { return Promise.reject(); };
    }
    if (/^-?\d+(\.\d+)?$/.test(v)) return +v;
    return v;
  }
  // Defines accessors along a dotted path, waiting for parents that don't exist yet.
  function trap(chain, onLeaf) {
    var parts = chain.split(".");
    (function walk(owner, i) {
      var k = parts[i];
      if (i === parts.length - 1) { try { onLeaf(owner, k); } catch (e) {} return; }
      var cur; try { cur = owner[k]; } catch (e) { return; }
      if (cur && (typeof cur === "object" || typeof cur === "function")) return walk(cur, i + 1);
      var held = cur;
      try { Object.defineProperty(owner, k, { configurable: true, get: function () { return held; }, set: function (n) { held = n; if (n && (typeof n === "object" || typeof n === "function")) walk(n, i + 1); } }); } catch (e) {}
    })(W, 0);
  }
  var S = {
    "set-constant": function (chain, v) {
      var val = valueOf(v);
      trap(chain, function (o, k) { Object.defineProperty(o, k, { configurable: true, get: function () { return val; }, set: noop }); });
    },
    "abort-on-property-read": function (chain) {
      var msg = rnd();
      trap(chain, function (o, k) { Object.defineProperty(o, k, { configurable: true, get: function () { throw new ReferenceError(msg); }, set: noop }); });
    },
    "abort-on-property-write": function (chain) {
      var msg = rnd();
      trap(chain, function (o, k) { var v = o[k]; Object.defineProperty(o, k, { configurable: true, get: function () { return v; }, set: function () { throw new ReferenceError(msg); } }); });
    },
    "abort-current-script": function (chain, needle) {
      var re = toRe(needle), msg = rnd();
      var bad = function () { var s = document.currentScript; if (!s || s === W.__cloudoraScript) return false; return !re || re.test(s.textContent || s.src || ""); };
      trap(chain, function (o, k) {
        var v = o[k];
        Object.defineProperty(o, k, { configurable: true, get: function () { if (bad()) throw new ReferenceError(msg); return v; }, set: function (n) { if (bad()) throw new ReferenceError(msg); v = n; } });
      });
    },
    "prevent-window-open": function (pattern, delay, replacement) {
      var re = toRe(pattern), real = W.open;
      W.open = function (u) {
        if (!re || re.test(u || "")) return replacement ? new Proxy(function () {}, { get: function () { return noop; } }) : null;
        return real.apply(this, arguments);
      };
    },
    "prevent-setTimeout": function (needle, delay) { patchTimer("setTimeout", needle, delay); },
    "prevent-setInterval": function (needle, delay) { patchTimer("setInterval", needle, delay); },
    "prevent-addEventListener": function (type, pattern) {
      var tre = toRe(type), pre = toRe(pattern), real = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (t, h) {
        try { if ((!tre || tre.test(t)) && (!pre || pre.test(typeof h === "function" ? h.toString() : h && h.handleEvent ? h.handleEvent.toString() : ""))) return; } catch (e) {}
        return real.apply(this, arguments);
      };
    },
    "prevent-fetch": function () {
      var parts = Array.prototype.slice.call(arguments).join(" ").split(/\s+/).filter(Boolean), real = W.fetch;
      var res = parts.map(function (p) { var m = /^(url|method):(.*)$/.exec(p); return m ? [m[1], toRe(m[2])] : ["url", toRe(p)]; });
      if (!real) return;
      W.fetch = function (input, init) {
        try {
          var url = typeof input === "string" ? input : input && input.url || "", method = (init && init.method || input && input.method || "GET").toUpperCase();
          if (res.every(function (r) { return r[1] && r[1].test(r[0] === "url" ? url : method); })) return Promise.resolve(new Response("", { status: 200 }));
        } catch (e) {}
        return real.apply(this, arguments);
      };
    },
    "prevent-xhr": function () {
      var parts = Array.prototype.slice.call(arguments).join(" ").split(/\s+/).filter(Boolean), P = XMLHttpRequest.prototype, open = P.open, send = P.send;
      var res = parts.map(function (p) { var m = /^(url|method):(.*)$/.exec(p); return m ? [m[1], toRe(m[2])] : ["url", toRe(p)]; });
      P.open = function (m, u) { this.__cl = { m: String(m).toUpperCase(), u: String(u) }; return open.apply(this, arguments); };
      P.send = function () {
        var c = this.__cl, self = this;
        if (c && res.every(function (r) { return r[1] && r[1].test(r[0] === "url" ? c.u : c.m); })) {
          Object.defineProperties(self, { readyState: { value: 4 }, status: { value: 200 }, response: { value: "" }, responseText: { value: "" } });
          setTimeout(function () { ["readystatechange", "load", "loadend"].forEach(function (t) { self.dispatchEvent(new Event(t)); }); }, 1);
          return;
        }
        return send.apply(this, arguments);
      };
    },
    "noeval-if": function (needle) {
      var re = toRe(needle), real = W.eval;
      W.eval = function (s) { if (!re || re.test(s)) return; return real.apply(this, arguments); };
    },
    "noeval": function () { W.eval = noop; },
    "json-prune": function (paths, needles) {
      var real = JSON.parse, list = (paths || "").split(/\s+/).filter(Boolean), need = (needles || "").split(/\s+/).filter(Boolean);
      function get(o, path) { var cur = [o], parts = path.split("."); for (var i = 0; i < parts.length; i++) { var nx = []; cur.forEach(function (c) { if (c == null) return; var p = parts[i]; if (p === "[]" || p === "*") { if (typeof c === "object") Object.keys(c).forEach(function (k) { nx.push(c[k]); }); } else if (typeof c === "object" && p in c) nx.push(c[p]); }); cur = nx; } return cur; }
      function del(o, path) { var parts = path.split("."), last = parts.pop(), cur = [o]; parts.forEach(function (p) { var nx = []; cur.forEach(function (c) { if (c == null || typeof c !== "object") return; if (p === "[]" || p === "*") Object.keys(c).forEach(function (k) { nx.push(c[k]); }); else if (p in c) nx.push(c[p]); }); cur = nx; }); cur.forEach(function (c) { if (c && typeof c === "object") { if (last === "[]" || last === "*") Object.keys(c).forEach(function (k) { delete c[k]; }); else delete c[last]; } }); }
      JSON.parse = function () {
        var r = real.apply(this, arguments);
        try { if (r && typeof r === "object" && (!need.length || need.every(function (n) { return get(r, n).length; }))) list.forEach(function (p) { del(r, p); }); } catch (e) {}
        return r;
      };
    },
    "remove-attr": function (attr, selector) {
      var attrs = (attr || "").split("|"), sel = selector || "[" + attrs[0] + "]";
      var run = function () { try { document.querySelectorAll(sel).forEach(function (n) { attrs.forEach(function (a) { n.removeAttribute(a); }); }); } catch (e) {} };
      run(); new MutationObserver(run).observe(document, { childList: true, subtree: true, attributes: true });
    },
    "remove-class": function (cls, selector) {
      var cs = (cls || "").split("|"), sel = selector || "." + cs.join(",.");
      var run = function () { try { document.querySelectorAll(sel).forEach(function (n) { cs.forEach(function (c) { n.classList.remove(c); }); }); } catch (e) {} };
      run(); new MutationObserver(run).observe(document, { childList: true, subtree: true, attributes: true });
    },
    "nowebrtc": function () {
      var f = function () { return { createDataChannel: noop, close: noop, addEventListener: noop, removeEventListener: noop, setLocalDescription: noop, createOffer: function () { return Promise.resolve({}); } }; };
      ["RTCPeerConnection", "webkitRTCPeerConnection", "mozRTCPeerConnection"].forEach(function (k) { if (W[k]) W[k] = f; });
    },
    "remove-cookie": function (needle) {
      var re = toRe(needle), run = function () { document.cookie.split(";").forEach(function (c) { var n = c.split("=")[0].trim(); if (n && (!re || re.test(n))) document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; }); };
      run(); W.addEventListener("beforeunload", run);
    },
    "set-cookie": function (name, value) { try { document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + "; path=/; SameSite=Lax"; } catch (e) {} },
    "set-local-storage-item": function (k, v) { try { localStorage.setItem(k, String(valueOf(v))); } catch (e) {} },
    "set-session-storage-item": function (k, v) { try { sessionStorage.setItem(k, String(valueOf(v))); } catch (e) {} },
  };
  function patchTimer(name, needle, delay) {
    var re = toRe(needle), real = W[name], d = delay === undefined || delay === "" ? null : +delay;
    W[name] = function (fn, t) {
      try { if ((!re || re.test(typeof fn === "function" ? fn.toString() : fn)) && (d === null || t === d)) return 0; } catch (e) {}
      return real.apply(this, arguments);
    };
  }
  var ALIAS = {
    "set": "set-constant", "aopr": "abort-on-property-read", "aopw": "abort-on-property-write", "acs": "abort-current-script", "abort-current-inline-script": "abort-current-script", "acis": "abort-current-script",
    "nowoif": "prevent-window-open", "window.open-defuser": "prevent-window-open", "nostif": "prevent-setTimeout", "no-setTimeout-if": "prevent-setTimeout", "setTimeout-defuser": "prevent-setTimeout",
    "nosiif": "prevent-setInterval", "no-setInterval-if": "prevent-setInterval", "setInterval-defuser": "prevent-setInterval", "aeld": "prevent-addEventListener", "addEventListener-defuser": "prevent-addEventListener",
    "no-fetch-if": "prevent-fetch", "no-xhr-if": "prevent-xhr", "ra": "remove-attr", "rc": "remove-class", "cookie-remover": "remove-cookie", "set-constant": "set-constant",
  };
  for (var i = 0; i < calls.length; i++) {
    var c = calls[i], name = ALIAS[c[0]] || c[0];
    if (S[name]) { try { S[name].apply(null, c.slice(1)); } catch (e) {} }
  }
})
