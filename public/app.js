"use strict";
const $ = (s) => document.querySelector(s);
const db = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("cloudora:" + k) ?? localStorage.getItem("skyhop:" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("cloudora:" + k, JSON.stringify(v)); } catch {} },
};
const ENGINES = {
  DuckDuckGo: "https://duckduckgo.com/?q=%s",
  Brave: "https://search.brave.com/search?q=%s",
  Bing: "https://www.bing.com/search?q=%s",
  Google: "https://www.google.com/search?q=%s",
};
const DEFAULT_TILES = [
  { title: "DuckDuckGo", url: "https://duckduckgo.com" },
  { title: "Wikipedia", url: "https://www.wikipedia.org" },
  { title: "YouTube", url: "https://www.youtube.com" },
  { title: "Reddit", url: "https://www.reddit.com" },
  { title: "GitHub", url: "https://github.com" },
  { title: "Hacker News", url: "https://news.ycombinator.com" },
];
const ICONS = {
  back: "M15 18l-6-6 6-6", forward: "M9 18l6-6-6-6", reload: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  plus: "M12 5v14M5 12h14", close: "M18 6L6 18M6 6l12 12", sidebar: "M3 5h18v14H3zM9 5v14",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  shield: "M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z", shieldoff: "M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6zM4 4l16 16",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2", dots: "M5 12h.01M12 12h.01M19 12h.01", pin: "M12 17v5M9 3h6l-1 6 3 3H7l3-3z",
  find: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3", up: "M18 15l-6-6-6 6", check: "M20 6L9 17l-5-5", ext: "M14 3h7v7M10 14L21 3M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5", down: "M6 9l6 6 6-6", search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3", globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
};
const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n]}"/></svg>`;
document.querySelectorAll("[data-ic]").forEach((b) => b.insertAdjacentHTML("afterbegin", ic(b.dataset.ic)));

const el = { app: $("#app"), tabs: $("#tablist"), views: $("#views"), home: $("#home"), addr: $("#address"),
  tiles: $("#tiles"), disc: $("#discover"), notice: $("#notice"), status: $("#status"), star: $("#star") };
let tabs = [], active = null, scramjet = null, ready = false, nextId = 1, dragTab = null;
const closed = []; // recently closed tabs, for Reopen closed tab
let engine = db.get("engine", "DuckDuckGo");
const prefs = Object.assign({ adblock: true, allow: [], restore: true, history: true, glow: true, impersonate: true, theme: { mode: "dark", palette: "midnight", h: 222, s: 100 } }, db.get("prefs", {}));
if (prefs.theme.mode === "amoled") prefs.theme.mode = "dark"; // AMOLED is now just Dark
const savePrefs = () => db.set("prefs", prefs);
document.documentElement.classList.toggle("noglow", !prefs.glow);
const PAGE_TITLES = { home: "New tab", anime: "Anime", manga: "Manga", history: "History" };
const AD_CSS = 'ins.adsbygoogle,.adsbygoogle,[id^="google_ads"],[id^="div-gpt-ad"],.ad-banner,.ad-container,.ad-slot,.ad-wrapper,.advertisement,.sponsored-ad,.taboola,[id^="taboola"],[class*="outbrain"],iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="adnxs"],iframe[src*="adsystem"],#ad,#ads,.ads{display:none!important}';
const rawHost = (u) => { try { return new URL(u).hostname; } catch { return ""; } };
const paused = (u) => { const h = rawHost(u); return !!h && prefs.allow.some((d) => h === d || h.endsWith("." + d)); };
// The service worker injects the full filter lists into every page. This is only a safety net for the rare page it could not inject into.
function applyCosmetics(frame, url) {
  try {
    const d = frame.contentDocument; if (!d) return;
    const old = d.getElementById("cloudora-adblock");
    if (!prefs.adblock || (url && paused(url))) return old && old.remove();
    if (old || d.getElementById("cloudora-scriptlets")) return;
    const s = d.createElement("style"); s.id = "cloudora-adblock"; s.textContent = AD_CSS;
    (d.head || d.documentElement).appendChild(s);
  } catch {}
}
const swPost = (msg) => navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage(msg)).catch(() => {});
const syncAdblock = () => { swPost({ cloudora: "adblock", on: prefs.adblock }); swPost({ cloudora: "allow", hosts: prefs.allow }); };

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
function toUrl(q) {
  q = q.trim();
  if (!q) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(q)) return q;
  if (/^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(q) || /^localhost(:\d+)?(\/.*)?$/.test(q)) return "https://" + q;
  return (ENGINES[engine] || ENGINES.DuckDuckGo).replace("%s", encodeURIComponent(q));
}
const fav = (t, cls = "") => `<div class="fav ${cls}">${t ? (host(t)[0] || "?") : "✦"}</div>`;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function boot() {
  if (!navigator.serviceWorker) throw new Error("Service workers need https (or localhost).");
  const { ScramjetController } = $scramjetLoadController();
  scramjet = new ScramjetController({
    files: { wasm: "/scram/scramjet.wasm.wasm", all: "/scram/scramjet.all.js", sync: "/scram/scramjet.sync.js" },
  });
  await scramjet.init(); // must run before the service worker is registered
  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  bareConn = new BareMux.BareMuxConnection("/baremux/worker.js");
  try { serverImpersonate = !!(await (await fetch("/api/config", { cache: "no-store" })).json()).impersonate; } catch {}
  await applyTransport();
  ready = true;
  syncAdblock();
}
// HTTP goes through the server's curl_cffi fetcher (real Chrome/Firefox/Safari TLS fingerprint) when the server has it and the
// setting is on; otherwise through libcurl.js in this browser. WebSockets always use the Wisp tunnel.
let bareConn = null, serverImpersonate = false;
async function applyTransport() {
  const real = serverImpersonate && prefs.impersonate;
  const want = real ? "/transport-impersonate.mjs" : "/libcurl/index.mjs";
  const wisp = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/";
  if ((await bareConn.getTransport()) !== want) await bareConn.setTransport(want, [{ websocket: wisp }]);
  el.status.textContent = "Connected";
  el.status.title = real ? "Requests are sent with a real browser's TLS fingerprint" : "Requests are sent from your browser through the tunnel";
  const row = $("#imp-row"); if (row) row.hidden = !serverImpersonate;
}

function newTab(url, page = "home") {
  const tab = { id: nextId++, url: "", page, title: PAGE_TITLES[page], frame: null, loading: false, pinned: false, zoom: 1, blocked: 0, hits: [], row: document.createElement("div") };
  tab.row.className = "tab";
  tab.row.draggable = true;
  tab.row.addEventListener("click", () => select(tab));
  tab.row.addEventListener("auxclick", (e) => { if (e.button === 1) closeTab(tab); });
  tab.row.addEventListener("contextmenu", (e) => { e.preventDefault(); tabMenu(e.clientX, e.clientY, tab); });
  tab.row.addEventListener("dragstart", (e) => { dragTab = tab; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(tab.id)); });
  tab.row.addEventListener("dragover", (e) => { if (dragTab && dragTab !== tab) { e.preventDefault(); tab.row.classList.add("dragover"); } });
  tab.row.addEventListener("dragleave", () => tab.row.classList.remove("dragover"));
  tab.row.addEventListener("drop", (e) => {
    e.preventDefault(); tab.row.classList.remove("dragover");
    if (!dragTab || dragTab === tab) return;
    tabs.splice(tabs.indexOf(dragTab), 1); tabs.splice(tabs.indexOf(tab), 0, dragTab);
    dragTab.pinned = tab.pinned; tabs.forEach((t) => el.tabs.appendChild(t.row)); dragTab = null; render(); saveSession();
  });
  tab.row.addEventListener("dragend", () => { dragTab = null; });
  tabs.push(tab); el.tabs.appendChild(tab.row);
  select(tab);
  if (url) go(tab, url); else if (page === "home") $("#home-q").focus();
  return tab;
}

function ensureFrame(tab) {
  if (tab.frame) return tab.frame;
  const f = scramjet.createFrame();
  el.views.appendChild(f.frame);
  f.addEventListener("urlchange", (e) => {
    if (e.url !== tab.url) { tab.blocked = 0; tab.hits = []; }
    tab.url = e.url; tab.title = host(e.url); render(); saveSession();
  });
  f.frame.addEventListener("load", () => {
    tab.loading = false;
    try { const t = f.frame.contentDocument.title; if (t) tab.title = t; } catch {}
    applyCosmetics(f.frame, tab.url); applyZoom(tab);
    try { f.frame.contentWindow.addEventListener("keydown", onKey, true); f.frame.contentWindow.addEventListener("pointerdown", closeFloating, true); } catch {}
    histAdd(tab.url, tab.title);
    render(); saveSession();
  });
  return (tab.frame = f);
}

function go(tab, url) {
  if (!ready) { showNotice("Still connecting — try again in a second."); return; }
  const f = ensureFrame(tab);
  tab.url = url; tab.title = host(url); tab.loading = true; tab.lazy = false; tab.blocked = 0; tab.hits = [];
  f.go(url); render();
}

function select(tab) {
  if (active && active !== tab && typeof closeFind === "function") closeFind();
  active = tab;
  if (tab.lazy && ready) go(tab, tab.url); // restored tabs load when you first open them
  render();
}

function closeTab(tab) {
  const i = tabs.indexOf(tab);
  if (tab.url || tab.page !== "home") closed.unshift({ url: tab.url, page: tab.page, title: tab.title, pinned: tab.pinned });
  closed.length = Math.min(closed.length, 15);
  tabs.splice(i, 1); tab.row.remove(); tab.frame?.frame.remove();
  if (!tabs.length) newTab(); else if (tab === active) select(tabs[Math.max(0, i - 1)]);
  saveSession();
}
function reopenTab() {
  const c = closed.shift(); if (!c) return toast("No recently closed tabs");
  const t = c.url ? newTab(c.url) : newTab(null, c.page);
  if (c.pinned) setPinned(t, true);
}
function setPinned(tab, on) {
  tab.pinned = on;
  const pins = tabs.filter((t) => t.pinned && t !== tab);
  tabs.splice(tabs.indexOf(tab), 1);
  tabs.splice(on ? pins.length : tabs.filter((t) => t.pinned).length, 0, tab);
  tabs.forEach((t) => el.tabs.appendChild(t.row)); render(); saveSession();
}

function render() {
  for (const t of tabs) {
    t.row.className = "tab" + (t === active ? " active" : "") + (t.loading ? " loading" : "") + (t.pinned ? " pinned" : "");
    t.row.innerHTML = `${fav(t.url || (t.page !== "home" ? t.page : ""))}<span class="t">${esc(t.title)}</span><span class="pn">${ic("pin")}</span><button class="x" title="Close">${ic("close")}</button>`;
    t.row.querySelector(".x").onclick = (e) => { e.stopPropagation(); closeTab(t); };
    if (t.frame) t.frame.frame.classList.toggle("active", t === active);
  }
  const blank = !active.url;
  el.home.hidden = !(blank && active.page === "home");
  el.disc.hidden = !(blank && active.page !== "home");
  if (!el.home.hidden) renderTiles();
  if (!el.disc.hidden) {
    if (!discKey.startsWith(active.page + "|")) { $("#d-q").value = ""; $("#d-detail").hidden = true; $("#reader").hidden = true; closePlayer(); }
    showDiscover(active.page, $("#d-q").value.trim());
  }
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", blank && b.dataset.page === active.page));
  if (document.activeElement !== el.addr) el.addr.value = active.url;
  el.star.classList.toggle("on", !!active.url && bookmarks().some((b) => b.url === active.url));
  document.title = active.url ? active.title + " · Cloudora" : "Cloudora";
  drawShield();
}

const bookmarks = () => db.get("bookmarks", []);
function renderTiles() {
  const list = bookmarks().length ? bookmarks() : DEFAULT_TILES;
  const custom = bookmarks().length > 0;
  el.tiles.innerHTML = list.map((b, i) => `<div class="tile" data-u="${esc(b.url)}">${custom ? `<button class="rm" data-i="${i}" title="Remove">${ic("close")}</button>` : ""}${fav(b.url)}<span>${esc(b.title)}</span></div>`).join("");
}
el.tiles.addEventListener("click", (e) => {
  const rm = e.target.closest(".rm");
  if (rm) { const l = bookmarks(); l.splice(+rm.dataset.i, 1); db.set("bookmarks", l); render(); return; }
  const t = e.target.closest(".tile");
  if (t) go(active, t.dataset.u);
});
function showNotice(msg) { el.notice.textContent = msg; el.notice.hidden = false; }

$("#bar").addEventListener("submit", (e) => { e.preventDefault(); const u = sgSel >= 0 && sg[sgSel] ? sg[sgSel].url : toUrl(el.addr.value); hideSugg(); if (u) go(active, u); el.addr.blur(); });
$("#home-form").addEventListener("submit", (e) => { e.preventDefault(); const u = toUrl($("#home-q").value); if (u) { $("#home-q").value = ""; go(active, u); } });
el.addr.addEventListener("focus", () => el.addr.select());
$("#back").onclick = () => active.frame?.back();
$("#forward").onclick = () => active.frame?.forward();
$("#reload").onclick = () => { if (active.frame) { active.loading = true; active.frame.reload(); render(); } };
$("#new-tab").onclick = () => newTab();
$("#toggle").onclick = () => el.app.classList.toggle("collapsed");
function toggleBookmark() {
  if (!active.url) return;
  const l = bookmarks(), i = l.findIndex((b) => b.url === active.url);
  if (i >= 0) l.splice(i, 1); else l.push({ url: active.url, title: active.title && active.title !== host(active.url) ? active.title : host(active.url) });
  db.set("bookmarks", l); render(); toast(i >= 0 ? "Bookmark removed" : "Bookmarked");
}
el.star.onclick = toggleBookmark;
function onKey(e) {
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const c = e.code, num = /^Digit([1-9])$/.exec(c);
    const act = e.shiftKey && c === "KeyT" ? reopenTab : c === "KeyT" ? () => newTab() : c === "KeyW" ? () => closeTab(active) : c === "KeyL" ? () => el.addr.focus()
      : c === "KeyF" ? openFind : c === "KeyH" ? () => openPage("history") : c === "KeyD" ? toggleBookmark : c === "KeyR" ? () => $("#reload").click()
      : c === "ArrowLeft" ? () => active.frame?.back() : c === "ArrowRight" ? () => active.frame?.forward()
      : c === "Equal" || c === "NumpadAdd" ? () => zoomBy(1) : c === "Minus" || c === "NumpadSubtract" ? () => zoomBy(-1) : c === "Digit0" || c === "Numpad0" ? () => zoomBy(0)
      : num ? () => { const t = num[1] === "9" ? tabs[tabs.length - 1] : tabs[+num[1] - 1]; if (t) select(t); } : null;
    if (act) { e.preventDefault(); act(); }
  } else if (e.key === "Escape") { if (closeDD()) return; $("#settings").hidden = true; $("#d-detail").hidden = true; $("#reader").hidden = true; closePlayer(); closeFloating(); if (!$("#findbar").hidden) closeFind(); }
}
document.addEventListener("keydown", onKey);

// theme engine: mode (auto/light/dark = true black) + color (preset or any hue from the wheel)
const PRESETS = { midnight: [222, 100], dracula: [265, 90], mocha: [217, 92], sakura: [332, 100], emerald: [155, 65], amber: [38, 95], crimson: [350, 85], cyan: [190, 90] };
const MODES = ["auto", "light", "dark"];
const lightQuery = matchMedia("(prefers-color-scheme: light)");
const resolveMode = () => { const m = prefs.theme.mode; return m === "auto" ? (lightQuery.matches ? "light" : "dark") : m === "light" ? "light" : "dark"; };
const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
function themeVars() {
  const t = prefs.theme, [h, s] = t.palette === "custom" ? [t.h, t.s] : PRESETS[t.palette] || PRESETS.midnight;
  const mode = resolveMode(), tint = s * 0.35, light = mode === "light";
  const v = light ? { bg: hsl(h, 30, 95), side: hsl(h, 30, 92), surface: hsl(h, 30, 98), surface2: hsl(h, 28, 93), border: hsl(h, 20, 83), text: hsl(h, 25, 12), muted: hsl(h, 10, 40) }
    : { bg: "#000", side: "#000", surface: hsl(h, tint * 0.6, 5), surface2: hsl(h, tint * 0.6, 9), border: hsl(h, tint * 0.5, 15), text: "#f2f2f5", muted: hsl(h, 8, 62) };
  v.accent = hsl(h, Math.max(s, 45), light ? 45 : 70); v.accent2 = hsl((h + 45) % 360, Math.max(s, 45), light ? 50 : 74);
  v["on-accent"] = light ? "#fff" : "#0b0b0d"; v["color-scheme"] = light ? "light" : "dark";
  return v;
}
function applyTheme() {
  const v = themeVars(), r = document.documentElement.style;
  for (const k in v) r.setProperty(k === "color-scheme" ? k : "--" + k, v[k]);
  db.set("vars", v);
  document.documentElement.dataset.mode = v["color-scheme"];
  window.setFavicon && setFavicon(v["color-scheme"]);
  const tc = document.querySelector("meta[name=theme-color]"); if (tc) tc.content = v.bg;
  $("#mode-btn").innerHTML = ic(v["color-scheme"] === "light" ? "moon" : "sun");
  $("#mode-btn").title = v["color-scheme"] === "light" ? "Switch to night" : "Switch to day";
}
const setTheme = (patch) => { Object.assign(prefs.theme, patch); savePrefs(); applyTheme(); drawSettings(); };
lightQuery.addEventListener("change", () => prefs.theme.mode === "auto" && applyTheme());
$("#mode-btn").onclick = () => setTheme({ mode: resolveMode() === "light" ? "dark" : "light" });
const toHex = (h, s, l) => { s /= 100; l /= 100; const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join(""); };
function fromHex(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d ? (d / (1 - Math.abs(2 * l - 1))) * 100 : 0 };
}
function drawWheel() {
  const t = prefs.theme, [h, s] = t.palette === "custom" ? [t.h, t.s] : PRESETS[t.palette] || PRESETS.midnight, a = (h * Math.PI) / 180;
  $("#wthumb").style.left = 75 + 61 * Math.sin(a) - 9 + "px"; $("#wthumb").style.top = 75 - 61 * Math.cos(a) - 9 + "px";
  $("#wsat").value = s; $("#wprev").style.background = hsl(h, Math.max(s, 45), 70);
  const hx = toHex(h, Math.max(s, 45), 70); $("#whex").textContent = hx; $("#wnative").value = hx;
}
function drawSettings() {
  const t = prefs.theme;
  $("#modes").innerHTML = MODES.map((m) => `<button type="button" class="${t.mode === m ? "on" : ""}" data-m="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join("");
  $("#themes").innerHTML = Object.entries(PRESETS).map(([n, [h, s]]) => `<button class="sw${t.palette === n ? " on" : ""}" data-t="${n}" title="${n}" style="background:${hsl(h, s, 70)}"></button>`).join("");
  drawWheel();
  document.querySelectorAll(".switch[data-k]").forEach((b) => { b.classList.toggle("on", prefs[b.dataset.k]); b.setAttribute("aria-checked", prefs[b.dataset.k]); });
  $("#allowbox").hidden = !prefs.allow.length;
  $("#allowlist").innerHTML = prefs.allow.map((h, i) => `<button class="chip" data-al="${i}" title="Resume blocking on this site">${esc(h)} ✕</button>`).join("");
  if (filterInfo) $("#filter-info").textContent = filterInfo;
}
$("#modes").addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) setTheme({ mode: b.dataset.m }); });
$("#themes").addEventListener("click", (e) => { const b = e.target.closest(".sw"); if (b) setTheme({ palette: b.dataset.t }); });
const wheelPick = (e) => {
  const r = $("#wheel").getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
  const cur = prefs.theme.palette === "custom" ? prefs.theme.s : (PRESETS[prefs.theme.palette] || PRESETS.midnight)[1];
  prefs.theme = { ...prefs.theme, palette: "custom", h: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, s: cur };
  savePrefs(); applyTheme(); drawWheel(); document.querySelectorAll("#themes .sw").forEach((b) => b.classList.remove("on"));
};
$("#wheel").addEventListener("pointerdown", (e) => { e.currentTarget.setPointerCapture(e.pointerId); wheelPick(e); });
$("#wheel").addEventListener("pointermove", (e) => { if (e.buttons) wheelPick(e); });
$("#wsat").addEventListener("input", (e) => {
  const cur = prefs.theme.palette === "custom" ? prefs.theme.h : (PRESETS[prefs.theme.palette] || PRESETS.midnight)[0];
  prefs.theme = { ...prefs.theme, palette: "custom", h: cur, s: +e.target.value }; savePrefs(); applyTheme(); drawWheel();
});
$("#wnative").addEventListener("input", (e) => { const { h, s } = fromHex(e.target.value); setTheme({ palette: "custom", h, s }); });
document.querySelectorAll(".switch").forEach((b) => (b.onclick = () => {
  const k = b.dataset.k; prefs[k] = !prefs[k]; savePrefs(); drawSettings();
  document.documentElement.classList.toggle("noglow", !prefs.glow);
  if (k === "adblock") { syncAdblock(); tabs.forEach((t) => t.frame && applyCosmetics(t.frame.frame, t.url)); render(); }
  if (k === "restore") persistSession();
  if (k === "impersonate" && ready) applyTransport().then(() => toast("Applies to new requests. Reload open tabs to use it."));
}));
$("#engine").innerHTML = Object.keys(ENGINES).map((n) => `<option${n === engine ? " selected" : ""}>${n}</option>`).join("");
$("#engine").onchange = (e) => { engine = e.target.value; db.set("engine", engine); };
$("#clear-bm").onclick = () => { db.set("bookmarks", []); render(); };
$("#open-settings").onclick = () => { drawSettings(); $("#settings").hidden = false; };
$("#close-settings").onclick = () => ($("#settings").hidden = true);
$("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") e.target.hidden = true; });

// cursor glow on search bars and cards
let raf = 0;
document.addEventListener("pointermove", (e) => {
  if (!prefs.glow || raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    for (const g of document.querySelectorAll(".glow")) {
      const r = g.getBoundingClientRect();
      g.style.setProperty("--mx", e.clientX - r.left + "px"); g.style.setProperty("--my", e.clientY - r.top + "px");
    }
  });
});

// Discover pages. Anime: AniList (+ built-in player when a source API is configured). Manga: MangaDex (read here).
const FIELDS = "id title{romaji english} coverImage{large} averageScore format episodes chapters";
const LIST = `query($t:MediaType,$s:[MediaSort],$q:String){Page(perPage:20){media(type:$t,sort:$s,search:$q,isAdult:false){${FIELDS}}}}`;
const ONE = `query($id:Int){Media(id:$id){${FIELDS} idMal type description genres siteUrl nextAiringEpisode{episode} externalLinks{url site type}}}`;
async function gql(query, variables) {
  const r = await fetch("/api/anilist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (!j.data) throw new Error((j.errors && j.errors[0].message) || "AniList error");
  return j.data;
}
const img = (u) => `/img?u=${encodeURIComponent(u)}`;
// Loading states: a spinner (optionally with text) and shimmering placeholder cards
const spinner = (text = "", cls = "") => `<div class="loading ${cls}" role="status" aria-live="polite"><span class="spin"></span>${text ? `<span>${esc(text)}</span>` : ""}</div>`;
const skeleton = (n = 12) => `<div class="grid">${'<div class="skcard"><i class="sk-img"></i><i class="sk-l"></i><i class="sk-l s"></i></div>'.repeat(n)}</div>`;
// Cover/page images get a shimmer until they arrive (load/error don't bubble, so listen in the capture phase)
for (const type of ["load", "error"]) document.addEventListener(type, (e) => { if (e.target.tagName === "IMG") e.target.classList.add("ok"); }, true);
const mname = (m) => m.title.english || m.title.romaji;
const mmeta = (m) => [m.averageScore && "★ " + m.averageScore, m.format && m.format.replace("_", " "), m.episodes ? m.episodes + " eps" : m.chapters ? m.chapters + " ch" : ""].filter(Boolean).join(" · ");
const card = (m) => `<div class="mcard glow" data-id="${m.id}"><img loading="lazy" alt="" src="${img(m.coverImage.large)}"><b>${esc(mname(m))}</b><small>${esc(mmeta(m))}</small></div>`;
const rowsHtml = (rows, data, render) => rows.map(([h], i) => `<h3>${h}</h3><div class="grid">${render(data[i]).join("") || '<p class="muted">Nothing found.</p>'}</div>`).join("");

const loaders = {
  async anime(q, key) {
    const rows = q ? [["Results", { s: ["SEARCH_MATCH"], q }]] : [["Trending now", { s: ["TRENDING_DESC"] }], ["Most popular", { s: ["POPULARITY_DESC"] }]];
    const data = await Promise.all(rows.map(([, v]) => gql(LIST, { t: "ANIME", ...v })));
    if (key === discKey) $("#d-body").innerHTML = (q ? "" : recentHtml("anime")) + rowsHtml(rows, data, (d) => d.Page.media.map(card));
  },
  async manga(q, key) {
    const rows = q ? [["Results", `/manga?limit=24&title=${encodeURIComponent(q)}&order[relevance]=desc${MDQ}`]]
      : [["Most followed", `/manga?limit=24&order[followedCount]=desc${MDQ}`], ["Recently updated", `/manga?limit=24&order[latestUploadedChapter]=desc${MDQ}`]];
    const data = await Promise.all(rows.map(([, p]) => md(p)));
    if (key === discKey) $("#d-body").innerHTML = (q ? "" : recentHtml("manga")) + rowsHtml(rows, data, (d) => d.data.map(mcard));
  },
};
let discKey = "";
async function showDiscover(page, q = "") {
  const key = page + "|" + q;
  if (key === discKey) return;
  discKey = key;
  $("#d-title").textContent = PAGE_TITLES[page]; $("#d-q").placeholder = "Search " + PAGE_TITLES[page].toLowerCase() + "…";
  $("#d-body").innerHTML = spinner("Loading " + PAGE_TITLES[page].toLowerCase() + "…") + skeleton();
  try { await loaders[page](q, key); }
  catch (err) { if (key === discKey) { discKey = ""; $("#d-body").innerHTML = `<p class="muted">Couldn't load this page (${esc(err.message)}).</p>`; } }
}
$("#d-form").addEventListener("submit", (e) => { e.preventDefault(); showDiscover(active.page, $("#d-q").value.trim()); });

// MangaDex
const MDQ = "&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=en&hasAvailableChapters=true";
async function md(path) {
  const r = await fetch("/api/md" + path), j = await r.json();
  if (!r.ok || j.result === "error") throw new Error((j.errors && j.errors[0].title) || "MangaDex error");
  return j;
}
const mItems = new Map();
const mTitle = (m) => m.attributes.title.en || Object.values(m.attributes.title)[0] || "Untitled";
const mCover = (m) => { const c = m.relationships.find((r) => r.type === "cover_art"); return c && c.attributes ? img(`https://uploads.mangadex.org/covers/${m.id}/${c.attributes.fileName}.256.jpg`) : ""; };
const mcard = (m) => { mItems.set(m.id, m); return `<div class="mcard glow" data-id="${m.id}"><img loading="lazy" alt="" src="${mCover(m)}"><b>${esc(mTitle(m))}</b><small>${esc([m.attributes.status, m.attributes.year].filter(Boolean).join(" · "))}</small></div>`; };
const closeBtn = () => `<button class="ghost dx">${ic("close")}</button>`;
const chLabel = (c) => "Ch. " + (c.attributes.chapter || "?") + (c.attributes.title ? " – " + c.attributes.title : "");
let reading = null;
const badge = (official) => official ? '<span class="badge ok">Official</span>' : '<span class="badge warn">Unofficial</span>';
async function mangaDetail(id) {
  const d = $("#d-detail"), m = mItems.get(id);
  if (!m) return;
  const L = m.attributes.links || {};
  const stores = [["engtl", "Official English"], ["amz", "Amazon"], ["ebj", "eBookJapan"], ["cdj", "CDJapan"]].filter(([k]) => /^https?:\/\//.test(L[k] || ""));
  const chip = (url, text) => `<button class="chip" data-open="${esc(url)}">${esc(text)}</button>`;
  const storeChips = stores.map(([k, n]) => chip(L[k], n)).join("");
  const tags = m.attributes.tags.slice(0, 8).map((t) => `<span class="chip">${esc(t.attributes.name.en || "")}</span>`).join("");
  const desc = (m.attributes.description.en || "No description.").replace(/\[[^\]]*\]|[*_>`#]/g, "").slice(0, 700);
  d.hidden = false;
  d.innerHTML = `<div class="dcard">${closeBtn()}<img alt="" src="${mCover(m)}"><div class="dbody"><h2>${esc(mTitle(m))}</h2><small>${esc([m.attributes.status, m.attributes.year].filter(Boolean).join(" · "))}</small>
    <div class="chips" style="margin-top:8px">${tags}</div><p class="desc">${esc(desc)}</p>
    <h4>Official sources ${badge(true)}</h4><div class="chips" id="mo">${storeChips || spinner("", "sm")}</div>
    <h4>Unofficial sources ${badge(false)}</h4><div class="chips" id="m-unofficial"></div>
    <h4>Read here ${badge(false)}</h4><small class="muted">Community translations hosted on MangaDex.</small><div class="chlist" id="chs">${spinner("Loading chapters…", "sm")}</div>
    <h4>Info</h4><div class="chips">${chip("https://mangadex.org/title/" + m.id, "MangaDex")}${L.al ? chip("https://anilist.co/manga/" + L.al, "AniList") : ""}</div></div></div>`;
  const providers = window.CloudoraMangaProviders;
  if (providers) $("#m-unofficial").innerHTML = providers.servers.map((server) => {
    const url = providers.build(server, { id: m.id, title: mTitle(m) });
    return url ? chip(url, server.name) : "";
  }).join("");
  try {
    const f = await md(`/manga/${id}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc&includeExternalUrl=1&contentRating[]=safe&contentRating[]=suggestive`);
    const seenH = new Set(), seenO = new Set();
    const hosted = f.data.filter((c) => !c.attributes.externalUrl && c.attributes.pages > 0 && !seenH.has(c.attributes.chapter) && seenH.add(c.attributes.chapter)).reverse();
    const ext = f.data.filter((c) => /^https?:\/\//.test(c.attributes.externalUrl || "") && !seenO.has(c.attributes.chapter) && seenO.add(c.attributes.chapter)).slice(0, 24);
    reading = { m, chapters: hosted };
    $("#mo").innerHTML = (storeChips + ext.map((c) => chip(c.attributes.externalUrl, "Read " + chLabel(c))).join("")) || '<span class="muted">No official links listed.</span>';
    $("#chs").innerHTML = hosted.length ? hosted.map((c, i) => `<button class="chip" data-ch="${i}">${esc(chLabel(c))}</button>`).reverse().join("") : '<p class="muted">No English chapters hosted on MangaDex.</p>';
  } catch (err) {
    $("#mo").innerHTML = storeChips || '<span class="muted">No official links listed.</span>';
    $("#chs").innerHTML = `<p class="muted">Couldn't load chapters (${esc(err.message)}).</p>`;
  }
}
async function openChapter(i) {
  const { m, chapters } = reading, c = chapters[i], rd = $("#reader");
  pushRecent("manga", { id: m.id, m, label: chLabel(c) });
  $("#d-detail").hidden = true; rd.hidden = false; rd.scrollTop = 0;
  rd.innerHTML = `<div class="rhead"><button class="ghost" id="r-close">${ic("close")}</button><b>${esc(mTitle(m))} · ${esc(chLabel(c))}</b>
    <button class="btn" data-rn="${i - 1}" ${i < 1 ? "disabled" : ""}>‹ Prev</button><button class="btn" data-rn="${i + 1}" ${i >= chapters.length - 1 ? "disabled" : ""}>Next ›</button></div><div class="rpages">${spinner("Loading pages…")}</div>`;
  try {
    const s = await md(`/at-home/server/${c.id}`);
    $("#reader .rpages").innerHTML = s.chapter.data.map((f) => `<img referrerpolicy="no-referrer" loading="lazy" alt="Loading…" src="${esc(`/api/md-image?u=${encodeURIComponent(`${s.baseUrl}/data/${s.chapter.hash}/${f}`)}`)}">`).join("") +
      `<p class="muted">Pages not showing? <button class="chip" data-open="https://mangadex.org/chapter/${c.id}">Open this chapter on MangaDex</button><br>Manga from MangaDex. Please support the creators.</p>`;
  } catch (err) { $("#reader .rpages").innerHTML = `<p class="muted">Couldn't load this chapter (${esc(err.message)}).</p>`; }
}

// Anime detail (AniList) + built-in player
let streamOn = false, streamOfficial = false, watching = null;
fetch("/api/config").then((r) => r.json()).then((c) => { streamOn = !!c.stream; streamOfficial = !!c.official; }).catch(() => {});

// ---- small styled dropdown (replaces native <select>): one floating menu at a time, keyboard friendly ----
let dd = null;
function closeDD() {
  if (!dd) return false;
  dd.menu.remove(); dd.btn.setAttribute("aria-expanded", "false"); dd.btn.classList.remove("open");
  dd = null; return true;
}
// items: [[value, label, hint?]]; pick(value) runs when one is chosen
function openDD(btn, items, current, pick) {
  if (dd && dd.btn === btn) return closeDD();
  closeDD();
  const m = document.createElement("div"); m.className = "ddmenu"; m.setAttribute("role", "listbox");
  m.innerHTML = items.map(([v, label, hint]) => `<button type="button" role="option" class="ddi${v === current ? " on" : ""}" data-v="${esc(String(v))}" aria-selected="${v === current}"><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ""}${v === current ? ic("check") : ""}</button>`).join("");
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect(), room = innerHeight - r.bottom - 14, up = room < 200 && r.top > room;
  m.style.minWidth = Math.max(r.width, 190) + "px";
  m.style.maxHeight = Math.max(140, Math.min(340, up ? r.top - 14 : room)) + "px";
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + "px";
  m.style[up ? "bottom" : "top"] = (up ? innerHeight - r.top + 6 : r.bottom + 6) + "px";
  btn.setAttribute("aria-expanded", "true"); btn.classList.add("open");
  dd = { btn, menu: m };
  m.addEventListener("click", (e) => { const i = e.target.closest(".ddi"); if (!i) return; const v = items.find(([x]) => String(x) === i.dataset.v)[0]; closeDD(); btn.focus(); pick(v); });
  m.addEventListener("keydown", (e) => {
    const all = [...m.querySelectorAll(".ddi")], at = all.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); all[(at + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length].focus(); }
    else if (e.key === "Home") { e.preventDefault(); all[0].focus(); } else if (e.key === "End") { e.preventDefault(); all[all.length - 1].focus(); }
    else if (e.key === "Escape") { e.stopPropagation(); closeDD(); btn.focus(); }
  });
  (m.querySelector(".ddi.on") || m.querySelector(".ddi"))?.focus();
  m.querySelector(".ddi.on")?.scrollIntoView({ block: "center" });
}
document.addEventListener("pointerdown", (e) => { if (dd && !dd.menu.contains(e.target) && !dd.btn.contains(e.target)) closeDD(); }, true);
document.addEventListener("scroll", (e) => { if (dd && !dd.menu.contains(e.target)) closeDD(); }, true);
addEventListener("resize", closeDD);

// ---- episodes: shown in batches of 100 with a dropdown to pick the batch ----
const BATCH = 100;
const epRange = (b, count) => [b * BATCH + 1, Math.min(count, (b + 1) * BATCH)];
function renderEps() {
  const w = watching; if (!w) return;
  const [a, z] = epRange(w.batch, w.count);
  const html = Array.from({ length: z - a + 1 }, (_, i) => `<button class="chip${a + i === w.last ? " cur" : ""}" data-ep="${a + i}">${a + i}</button>`).join("");
  for (const [list, label] of [["#eps", "#ep-batch-l"], ["#w-eps", "#w-batch-l"]]) {
    const box = $(list); if (!box) continue;
    box.innerHTML = html;
    const l = $(label); if (l) l.textContent = `Episodes ${a} – ${z}`;
    const cur = box.querySelector(".cur"); if (cur) box.scrollTop = Math.max(0, cur.offsetTop - box.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2);
  }
}
function pickBatch(btn) {
  const w = watching, n = Math.ceil(w.count / BATCH);
  openDD(btn, Array.from({ length: n }, (_, b) => { const [a, z] = epRange(b, w.count); return [b, `${a} – ${z}`, w.last >= a && w.last <= z ? "watching" : ""]; }), w.batch, (b) => { w.batch = b; renderEps(); });
}

async function animeDetail(id) {
  const d = $("#d-detail");
  d.hidden = false; d.innerHTML = `<div class="dcard">${closeBtn()}${spinner("Loading details…")}</div>`;
  try {
    const m = (await gql(ONE, { id })).Media;
    const desc = (m.description || "No description.").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    const seen = new Set();
    const links = [...(m.externalLinks || []), { url: m.siteUrl, site: "AniList", type: "INFO" }]
      .filter((l) => l.url && /^https?:\/\//.test(l.url) && l.type !== "SOCIAL" && !seen.has(l.site) && seen.add(l.site)).slice(0, 9);
    const count = Math.min(5000, m.episodes || (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : 0));
    const last = Math.min(count, (db.get("recent:anime", []).find((x) => x.id === id) || {}).ep || 0); // reopen on the batch you were watching
    watching = { id, malId: m.idMal || 0, title: mname(m), count, cover: m.coverImage.large, last, batch: last ? Math.floor((last - 1) / BATCH) : 0 };
    const play = count ? `<h4>Play here ${badge(streamOfficial)}</h4>
      <div class="eprow">${count > BATCH ? `<button type="button" class="dd-btn" id="ep-batch" aria-haspopup="listbox" aria-expanded="false"><span id="ep-batch-l"></span>${ic("down")}</button>` : ""}<small class="muted">${count} episode${count > 1 ? "s" : ""}</small></div>
      <div class="chlist eps" id="eps"></div>` : "";
    d.innerHTML = `<div class="dcard">${closeBtn()}<img alt="" src="${img(m.coverImage.large)}"><div class="dbody">
      <h2>${esc(mname(m))}</h2><small>${esc(mmeta(m))}</small>
      <div class="chips" style="margin-top:8px">${(m.genres || []).map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div>
      <p class="desc">${esc(desc)}</p>${play}<h4>Official sources ${badge(true)}</h4>
      <div class="chips">${links.map((l) => `<button class="chip" data-open="${esc(l.url)}">${esc(l.site)}</button>`).join("")}</div></div></div>`;
    renderEps();
  } catch (err) { d.innerHTML = `<div class="dcard">${closeBtn()}<p class="muted">Couldn't load details (${esc(err.message)}).</p></div>`; }
}

// ---- player ----
// Direct HLS/MP4 sources (from the optional STREAM_API) play in a <video>; embed providers play in an iframe.
// The iframe must NEVER get a sandbox attribute: providers detect it and refuse to play. When the page is
// cross-origin isolated (Chromium) the iframe needs `credentialless`, otherwise the browser blocks the embed.
const ensureHls = () => new Promise((res) => { if (window.Hls) return res(); const s = document.createElement("script"); s.src = "/hls/hls.min.js"; s.onload = s.onerror = res; document.head.appendChild(s); });
const pmsg = (t) => { const m = $("#p-msg"); if (m) m.textContent = t; };
const pload = (text) => { const l = $("#p-load"); if (!l) return; l.hidden = !text; if (text) l.innerHTML = spinner(text); };
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
let player = { items: [], cur: -1 }, embedTimer = 0;
function closePlayer() {
  clearTimeout(embedTimer); closeDD();
  const pl = $("#player"), v = $("#vid"); if (v) { v.pause(); if (v._hls) v._hls.destroy(); }
  pl.hidden = true; pl.innerHTML = "";
}
async function attach(v, src) {
  const pb = $("#p-badge"); if (pb) pb.innerHTML = badge(src.official ?? streamOfficial);
  if (v._hls) { v._hls.destroy(); v._hls = null; }
  const fail = () => { pload(""); pmsg("Couldn't play this source (the host may block cross-site playback). Try another server."); };
  if (src.type === "hls" || /\.m3u8(\?|$)/i.test(src.url)) {
    await ensureHls();
    if (window.Hls && Hls.isSupported()) {
      const h = (v._hls = new Hls());
      h.on(Hls.Events.ERROR, (_, e) => e.fatal && fail());
      h.loadSource(src.url); h.attachMedia(v);
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) v.src = src.url; // Safari / iOS native HLS
    else { pload(""); pmsg("This browser can't play HLS streams."); }
  } else v.src = src.url;
}
function mountEmbed(url) {
  clearTimeout(embedTimer);
  const stage = $("#pstage"); $("#p-embed")?.remove();
  const f = document.createElement("iframe");
  f.id = "p-embed"; f.title = `${watching.title} · Episode ${watching.last}`;
  f.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write";
  f.allowFullscreen = true;
  if (window.crossOriginIsolated) f.setAttribute("credentialless", "");
  f.addEventListener("load", () => { clearTimeout(embedTimer); pload(""); pmsg(""); });
  stage.appendChild(f); // a fresh iframe per server so switching doesn't pile up history entries
  f.src = url;
  pload("Loading player…"); pmsg("");
  embedTimer = setTimeout(() => { pload(""); pmsg("Taking a while. If the player stays blank, pick another server below."); }, 12000);
}
function renderServers() {
  const box = $("#p-servers"); if (!box) return;
  const groups = new Set(player.items.map((x) => x.group)); let last = "", html = "";
  player.items.forEach((it, i) => {
    if (groups.size > 1 && it.group !== last) html += `<div class="sgrp">${esc(it.group)}</div>`;
    last = it.group;
    html += `<button type="button" role="menuitemradio" aria-checked="${i === player.cur}" class="srv${i === player.cur ? " on" : ""}" data-srv="${i}"><span class="dot"></span><span class="st">${esc(it.title)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</button>`;
  });
  box.innerHTML = html;
}
async function useServer(i) {
  const it = player.items[i], v = $("#vid"); if (!it || !v) return;
  player.cur = i; renderServers(); pmsg("");
  $("#p-speed").hidden = it.kind !== "native";
  const tab = $("#p-tab"); tab.hidden = it.kind !== "embed"; tab.dataset.open = it.kind === "embed" ? it.url : "";
  if (it.kind === "embed") {
    v.pause(); v.hidden = true; if (v._hls) { v._hls.destroy(); v._hls = null; }
    $("#p-badge").innerHTML = badge(it.official ?? false);
    if (it.name) db.set("server", it.name);
    mountEmbed(it.url);
  } else {
    clearTimeout(embedTimer); $("#p-embed")?.remove(); v.hidden = false;
    pload("Loading stream…");
    await attach(v, it.src);
  }
}
async function playEpisode(num) {
  const w = watching, pl = $("#player"), key = `progress:${w.id}:${num}`;
  w.last = num; w.batch = Math.floor((num - 1) / BATCH); renderEps();
  pushRecent("anime", { id: w.id, title: w.title, cover: w.cover, label: "Episode " + num, ep: num });
  closeDD(); clearTimeout(embedTimer);
  $("#d-detail").hidden = true; pl.hidden = false; pl.scrollTop = 0;
  const many = w.count > BATCH;
  pl.innerHTML = `<div class="rhead"><button class="btn back" id="p-close">${ic("back")}Back</button><b>${esc(w.title)} · Episode ${num}</b></div>
    <div class="pbody">
      <div class="pstage" id="pstage"><video id="vid" controls playsinline autoplay crossorigin="anonymous" hidden></video><div class="pload" id="p-load">${spinner("Finding sources…")}</div></div>
      <div class="pbar"><span id="p-badge"></span><span class="muted" id="p-msg"></span><span class="grow"></span>
        <div class="seg sm" id="p-speed" hidden>${SPEEDS.map((s) => `<button type="button" data-spd="${s}"${s === 1 ? ' class="on"' : ""}>${s}×</button>`).join("")}</div>
        <button type="button" class="btn" id="p-tab" hidden>${ic("ext")}Open in tab</button>
        <button class="btn" data-pn="${num - 1}" ${num < 2 ? "disabled" : ""}>‹ Prev</button><button class="btn" data-pn="${num + 1}" ${num >= w.count ? "disabled" : ""}>Next ›</button></div>
      <div class="pgrid">
        <div class="pbox"><div class="phead"><h4>Episodes</h4>${many ? `<button type="button" class="dd-btn" id="w-batch" aria-haspopup="listbox" aria-expanded="false"><span id="w-batch-l"></span>${ic("down")}</button>` : ""}<small class="muted">${w.count} total</small></div><div class="chlist eps" id="w-eps"></div></div>
        <div class="pbox"><div class="phead"><h4>Servers</h4></div><div class="srvlist" id="p-servers" role="menu"></div></div>
      </div>
    </div>`;
  renderEps();
  const v = $("#vid"), ids = { anilist: w.id, mal: w.malId, ep: num, lang: "sub" }, api = window.CloudoraVideoProviders;
  const items = [];
  if (streamOn) {
    try {
      const r = await fetch(`/api/stream/sources?anilist_id=${w.id}&episode=${num}`), j = await r.json().catch(() => ({}));
      if (!$("#vid") || watching !== w || w.last !== num) return; // closed or changed episode while we waited
      if (!r.ok) throw new Error(j.error || "source API error " + r.status);
      const all = (j.sources || []).filter((s) => s.url && /^https?:\/\//.test(s.url));
      all.forEach((s, n) => {
        const title = s.label || s.quality || "Source " + (n + 1);
        if (s.type === "embed") items.push({ kind: "embed", group: "Source API", title, sub: "embed", url: s.url, official: s.official ?? streamOfficial });
        else items.push({ kind: "native", group: "Source API", title, sub: (s.type || "").toUpperCase(), src: s });
      });
      (j.subtitles || []).forEach((t, i) => {
        if (!/^https?:\/\//.test(t.url)) return;
        const k = document.createElement("track"); k.kind = "subtitles"; k.src = t.url; k.label = t.label || t.lang || "Subtitles"; k.srclang = t.lang || "en"; k.default = i === 0; v.appendChild(k);
      });
    } catch (err) { if (!api || !api.available(ids).length) { pload(""); return pmsg("Couldn't start playback: " + err.message); } }
  }
  const saved = db.get("server", "");
  const embeds = api ? api.available(ids) : [];
  embeds.sort((a, b) => (b.name === saved) - (a.name === saved)); // last server you used goes first
  for (const s of embeds) { const d = api.describe(s); items.push({ kind: "embed", group: "Embed servers", name: s.name, title: d.title, sub: d.sub, url: api.build(s, ids) }); }
  if (!items.length) { pload(""); return pmsg("No sources found for this episode."); }
  player = { items, cur: -1 };
  let last = 0;
  v.onloadedmetadata = () => { const t = db.get(key, 0); if (t > 10 && t < v.duration - 30) v.currentTime = t; v.playbackRate = +($("#p-speed .on")?.dataset.spd || 1); pload(""); pmsg(""); };
  v.onplaying = () => pload("");
  v.ontimeupdate = () => { if (Date.now() - last > 5000) { last = Date.now(); db.set(key, v.currentTime); } };
  v.onended = () => { db.set(key, 0); if (num < w.count) playEpisode(num + 1); };
  v.onerror = () => { pload(""); pmsg("Couldn't play this source (the host may block cross-site playback). Try another server."); };
  useServer(0);
}

el.disc.addEventListener("click", (e) => {
  const t = e.target, d = $("#d-detail");
  const hd = t.closest("[data-hdel]"); if (hd) { e.stopPropagation(); return histRemove(+hd.dataset.hdel); }
  const gt = t.closest("[data-goto]"); if (gt) return go(active, gt.dataset.goto);
  const open = t.closest("[data-open]"); if (open) { d.hidden = true; return newTab(open.dataset.open); }
  if (t.closest("#p-close")) return closePlayer();
  const eb = t.closest("#ep-batch, #w-batch"); if (eb) return pickBatch(eb);
  const sv = t.closest("[data-srv]"); if (sv) return useServer(+sv.dataset.srv);
  const sp = t.closest("[data-spd]"); if (sp) { $("#vid").playbackRate = +sp.dataset.spd; sp.parentNode.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === sp)); return; }
  const pn = t.closest("[data-pn]"); if (pn) return pn.disabled || playEpisode(+pn.dataset.pn);
  const ep = t.closest("[data-ep]"); if (ep) return playEpisode(+ep.dataset.ep);
  if (t.closest("#r-close")) { $("#reader").hidden = true; return; }
  const rn = t.closest("[data-rn]"); if (rn) return rn.disabled || openChapter(+rn.dataset.rn);
  const ch = t.closest("[data-ch]"); if (ch) return openChapter(+ch.dataset.ch);
  if (t.closest(".dx") || t === d) { d.hidden = true; return; }
  const c = t.closest(".mcard"); if (!c) return;
  if (active.page === "manga") return mangaDetail(c.dataset.id);
  animeDetail(+c.dataset.id);
});
function openPage(p) {
  if (!active.url) { active.page = p; active.title = PAGE_TITLES[p]; render(); } else newTab(null, p);
}
document.querySelectorAll("#nav button").forEach((b) => (b.onclick = () => openPage(b.dataset.page)));

// ---------- browser features: history, address-bar suggestions, tab menu, find, zoom, shield, session ----------
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2200); }

// History
const HIST_MAX = 1000;
const histList = () => db.get("history", []);
function histAdd(url, title) {
  if (!prefs.history || !/^https?:/i.test(url || "")) return;
  const l = histList(), last = l[0];
  if (last && last.url === url) { if (title) last.title = title; last.t = Date.now(); }
  else { l.unshift({ url, title: title || host(url), t: Date.now() }); if (l.length > HIST_MAX) l.length = HIST_MAX; }
  db.set("history", l); refreshDiscover("history");
}
function histRemove(t) { db.set("history", histList().filter((h) => h.t !== t)); refreshDiscover("history", true); }
function refreshDiscover(page, force) { if (discKey.startsWith(page + "|") && (force || active.page === page)) { const k = discKey; discKey = ""; if (!active.url && active.page === page) showDiscover(page, k.slice(page.length + 1)); } }
const dayLabel = (t) => { const d = new Date(t), n = new Date(), y = new Date(n - 864e5); return d.toDateString() === n.toDateString() ? "Today" : d.toDateString() === y.toDateString() ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); };
loaders.history = async (q, key) => {
  const s = q.toLowerCase(), list = histList().filter((h) => !s || (h.title + " " + h.url).toLowerCase().includes(s));
  if (key !== discKey) return;
  if (!list.length) { $("#d-body").innerHTML = `<p class="muted">${q ? "No matches." : prefs.history ? "Nothing here yet. Pages you visit show up here." : "History is turned off in Settings."}</p>`; return; }
  let html = "", day = "";
  for (const h of list.slice(0, 400)) {
    const d = dayLabel(h.t);
    if (d !== day) { day = d; html += `<div class="hday">${esc(d)}</div>`; }
    html += `<div class="hrow" data-goto="${esc(h.url)}">${fav(h.url)}<div class="tx"><b>${esc(h.title)}</b><small>${esc(h.url)}</small></div><span class="tm">${new Date(h.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><button class="rm" data-hdel="${h.t}" title="Remove">${ic("close")}</button></div>`;
  }
  $("#d-body").innerHTML = html + (list.length > 400 ? '<p class="muted">Showing the latest 400.</p>' : "");
};
$("#clear-hist").onclick = () => { db.set("history", []); refreshDiscover("history", true); toast("History cleared"); };

// "Continue watching / reading" rows on the Anime and Manga pages
function pushRecent(kind, entry) {
  const l = db.get("recent:" + kind, []).filter((x) => x.id !== entry.id);
  l.unshift(entry); l.length = Math.min(l.length, 12); db.set("recent:" + kind, l);
  if (discKey.startsWith(kind + "|")) discKey = "";
}
function recentHtml(kind) {
  const l = db.get("recent:" + kind, []); if (!l.length) return "";
  const cards = l.map((x) => {
    if (kind === "manga") { if (!x.m) return ""; mItems.set(x.m.id, x.m); return `<div class="mcard glow" data-id="${esc(x.m.id)}"><img loading="lazy" alt="" src="${mCover(x.m)}"><b>${esc(mTitle(x.m))}</b><small>${esc(x.label)}</small></div>`; }
    return `<div class="mcard glow" data-id="${x.id}"><img loading="lazy" alt="" src="${img(x.cover)}"><b>${esc(x.title)}</b><small>${esc(x.label)}</small></div>`;
  }).join("");
  return `<h3>${kind === "anime" ? "Continue watching" : "Continue reading"}</h3><div class="grid">${cards}</div>`;
}

// Session restore
function persistSession() {
  clearTimeout(persistSession.t);
  db.set("session", prefs.restore ? { active: tabs.indexOf(active), tabs: tabs.map((t) => ({ url: t.url, page: t.page, pinned: t.pinned, title: t.title })) } : null);
}
const saveSession = () => { clearTimeout(persistSession.t); persistSession.t = setTimeout(persistSession, 400); };
addEventListener("pagehide", persistSession);
function restoreSession() {
  const s = db.get("session", null);
  if (!prefs.restore || !s || !Array.isArray(s.tabs) || tabs.length !== 1 || tabs[0].url || tabs[0].page !== "home") return;
  if (!s.tabs.some((x) => x.url || (x.page && x.page !== "home"))) return;
  const first = tabs[0];
  for (const x of s.tabs.slice(0, 30)) {
    const t = newTab(null, PAGE_TITLES[x.page] ? x.page : "home");
    if (x.url && /^https?:/i.test(x.url)) { t.url = x.url; t.title = x.title || host(x.url); t.lazy = true; }
    t.pinned = !!x.pinned;
  }
  first.row.remove(); tabs.splice(tabs.indexOf(first), 1);
  select(tabs[Math.max(0, Math.min(tabs.length - 1, s.active))] || tabs[0]);
}

// Menus (tab right-click, ⋯ button)
function showMenu(x, y, items) {
  const c = $("#ctx"), m = document.createElement("div"); m.className = "menu"; c.innerHTML = "";
  for (const it of items) {
    if (it === "-") { m.insertAdjacentHTML("beforeend", '<div class="msep"></div>'); continue; }
    const b = document.createElement("button"); b.className = "mi"; b.disabled = !!it.off; b.setAttribute("role", "menuitem");
    b.innerHTML = `<span>${esc(it.label)}</span>${it.key ? `<kbd>${esc(it.key)}</kbd>` : ""}`;
    b.onclick = () => { closeFloating(); it.fn(); }; m.appendChild(b);
  }
  c.appendChild(m); c.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + "px"; m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + "px";
}
function closeFloating() { $("#ctx").hidden = true; $("#shield-pop").hidden = true; hideSugg(); }
$("#ctx").addEventListener("pointerdown", (e) => { if (e.target.id === "ctx") closeFloating(); });
$("#ctx").addEventListener("contextmenu", (e) => { e.preventDefault(); if (e.target.id === "ctx") closeFloating(); });
function tabMenu(x, y, tab) {
  const i = tabs.indexOf(tab);
  showMenu(x, y, [
    { label: "Reload", off: !tab.frame, fn: () => { tab.loading = true; tab.frame.reload(); render(); } },
    { label: "Duplicate tab", off: !tab.url, fn: () => newTab(tab.url) },
    { label: tab.pinned ? "Unpin tab" : "Pin tab", fn: () => setPinned(tab, !tab.pinned) },
    { label: "Copy address", off: !tab.url, fn: () => navigator.clipboard?.writeText(tab.url).then(() => toast("Address copied")).catch(() => {}) },
    "-",
    { label: "Close tab", key: "Alt+W", fn: () => closeTab(tab) },
    { label: "Close other tabs", off: tabs.length < 2, fn: () => tabs.filter((t) => t !== tab && !t.pinned).forEach(closeTab) },
    { label: "Close tabs below", off: i >= tabs.length - 1, fn: () => tabs.slice(i + 1).filter((t) => !t.pinned).forEach(closeTab) },
  ]);
}
$("#menu-btn").onclick = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  showMenu(r.right - 230, r.bottom + 6, [
    { label: "New tab", key: "Alt+T", fn: () => newTab() },
    { label: "Reopen closed tab", key: "Alt+Shift+T", off: !closed.length, fn: reopenTab },
    "-",
    { label: "Find in page", key: "Alt+F", off: !active.frame, fn: openFind },
    { label: "Zoom in", key: "Alt +", off: !active.frame, fn: () => zoomBy(1) },
    { label: "Zoom out", key: "Alt −", off: !active.frame, fn: () => zoomBy(-1) },
    { label: "Actual size" + (active.zoom !== 1 ? ` (${Math.round(active.zoom * 100)}%)` : ""), key: "Alt+0", off: !active.frame, fn: () => zoomBy(0) },
    "-",
    { label: "History", key: "Alt+H", fn: () => openPage("history") },
    { label: "Settings", fn: () => $("#open-settings").click() },
  ]);
};

// Find in page + zoom (proxied pages share our origin, so we can reach into the frame)
const fbar = $("#findbar");
function openFind() {
  if (!active.frame) return toast("Open a page first");
  fbar.hidden = false; const q = $("#find-q");
  try { const sel = String(active.frame.frame.contentWindow.getSelection()); if (sel) q.value = sel.slice(0, 100); } catch {}
  q.focus(); q.select();
}
function closeFind() { fbar.hidden = true; try { active.frame?.frame.contentWindow.getSelection().removeAllRanges(); } catch {} }
function doFind(back) {
  const w = active.frame && active.frame.frame.contentWindow, q = $("#find-q").value; if (!w || !q) { $("#find-n").textContent = ""; return; }
  let ok = false; try { ok = w.find(q, false, !!back, true, false, false, false); } catch {}
  $("#find-n").textContent = ok ? "" : "No results";
}
$("#find-q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doFind(e.shiftKey); } });
$("#find-q").addEventListener("input", () => { try { active.frame.frame.contentWindow.getSelection().removeAllRanges(); } catch {} doFind(false); });
$("#find-next").onclick = () => doFind(false); $("#find-prev").onclick = () => doFind(true); $("#find-x").onclick = closeFind;
const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
function applyZoom(tab) { try { if (tab.frame) tab.frame.frame.contentDocument.documentElement.style.zoom = tab.zoom === 1 ? "" : String(tab.zoom); } catch {} }
function zoomBy(d) {
  if (!active.frame) return;
  const one = ZOOMS.indexOf(1), i = ZOOMS.indexOf(active.zoom);
  active.zoom = ZOOMS[d === 0 ? one : Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? one : i) + d))];
  applyZoom(active); toast("Zoom " + Math.round(active.zoom * 100) + "%");
}

// Address-bar suggestions: bookmarks + history + live search suggestions
let sg = [], sgSel = -1, sgSeq = 0, sgTimer = 0;
const sugg = $("#sugg");
function hideSugg() { sugg.hidden = true; sgSel = -1; el.addr.setAttribute("aria-expanded", "false"); }
function drawSugg() {
  if (!sg.length) return hideSugg();
  sugg.innerHTML = sg.map((x, i) => `<div class="sg${i === sgSel ? " on" : ""}" role="option" data-i="${i}">${ic(x.icon)}<span class="tx">${esc(x.text)}</span>${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</div>`).join("");
  sugg.hidden = false; el.addr.setAttribute("aria-expanded", "true");
}
function localMatches(q) {
  const s = q.toLowerCase(), seen = new Set(), out = [];
  for (const b of bookmarks()) if ((b.title + " " + b.url).toLowerCase().includes(s) && !seen.has(b.url)) { seen.add(b.url); out.push({ icon: "star", text: b.title, sub: host(b.url), url: b.url }); }
  for (const h of histList()) { if (out.length >= 5) break; if ((h.title + " " + h.url).toLowerCase().includes(s) && !seen.has(h.url)) { seen.add(h.url); out.push({ icon: "history", text: h.title, sub: host(h.url), url: h.url }); } }
  return out.slice(0, 5);
}
function buildSugg(q, remote) {
  const url = toUrl(q), direct = /^https?:\/\//i.test(url) && url.startsWith("https://") && !url.includes(encodeURIComponent(q)) || /^[a-z][a-z0-9+.-]*:\/\//i.test(q);
  const out = [{ icon: direct ? "globe" : "search", text: q, sub: direct ? "Open" : "Search", url }];
  const seen = new Set([url]);
  for (const x of [...localMatches(q), ...remote.map((t) => ({ icon: "search", text: t, sub: "", url: toUrl(t) }))]) if (!seen.has(x.url)) { seen.add(x.url); out.push(x); }
  return out.slice(0, 9);
}
el.addr.addEventListener("input", () => {
  const q = el.addr.value.trim(); clearTimeout(sgTimer); const seq = ++sgSeq;
  if (!q) { sg = []; return hideSugg(); }
  sg = buildSugg(q, []); sgSel = -1; drawSugg();
  if (q.length < 2 || /^[a-z][a-z0-9+.-]*:\/\//i.test(q)) return;
  sgTimer = setTimeout(async () => {
    try { const r = await (await fetch("/api/suggest?q=" + encodeURIComponent(q))).json(); if (seq === sgSeq && document.activeElement === el.addr) { sg = buildSugg(q, r); sgSel = -1; drawSugg(); } } catch {}
  }, 160);
});
el.addr.addEventListener("keydown", (e) => {
  if (sugg.hidden || !sg.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sgSel = (sgSel + (e.key === "ArrowDown" ? 1 : -1) + sg.length + 1) % (sg.length + 1) - 0; if (sgSel === sg.length) sgSel = -1; drawSugg(); }
  else if (e.key === "Escape") { hideSugg(); el.addr.value = active.url; }
});
el.addr.addEventListener("blur", () => setTimeout(hideSugg, 120));
sugg.addEventListener("mousedown", (e) => {
  e.preventDefault(); const it = e.target.closest(".sg"); if (!it) return;
  const u = sg[+it.dataset.i].url; hideSugg(); el.addr.blur(); go(active, u);
});

// Ad & tracker shield
let filterInfo = "";
fetch("/adblock/info.json").then((r) => r.json()).then((i) => {
  const lists = { easylist: "EasyList", easyprivacy: "EasyPrivacy", "ublock-filters": "uBlock filters" };
  filterInfo = `${Object.values(lists).join(", ")} + more · ${Math.round(i.network / 1000)}k network and ${Math.round((i.cosmetic + i.scriptlets) / 1000)}k page rules · ${i.built}`;
}).catch(() => {});
function drawShield() {
  const b = $("#shield"), off = !prefs.adblock || (!!active.url && paused(active.url));
  b.classList.toggle("off", off);
  b.querySelector(".ico").innerHTML = ic(off ? "shieldoff" : "shield");
  const n = b.querySelector(".n"); n.hidden = off || !active.blocked; n.textContent = active.blocked > 99 ? "99+" : active.blocked;
  b.title = !prefs.adblock ? "Blocker is off" : off ? "Blocker paused on this site" : active.blocked ? `${active.blocked} blocked on this page` : "Ad & tracker blocker";
  if (!$("#shield-pop").hidden) drawShieldPop();
}
function drawShieldPop() {
  const pop = $("#shield-pop"), u = active.url;
  if (!u) { pop.innerHTML = '<b>Ad &amp; tracker blocker</b><small class="muted">Open a page to see what gets blocked on it.</small>'; return; }
  const on = prefs.adblock && !paused(u), by = new Map();
  for (const x of active.hits) { const d = rawHost(x.url).replace(/^www\./, "") || "other"; by.set(d, (by.get(d) || 0) + 1); }
  const rows = [...by].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([d, n]) => `<div><span>${esc(d)}</span><span>${n}</span></div>`).join("");
  pop.innerHTML = `<div class="set"><div><b>${esc(host(u))}</b><small>${!prefs.adblock ? "Turned off in Settings" : on ? "Blocking on this site" : "Paused on this site"}</small></div><button class="switch${on ? " on" : ""}" id="sp-toggle" role="switch" aria-checked="${on}" ${prefs.adblock ? "" : "disabled"}></button></div>
    <div><span class="big">${active.blocked}</span> <span class="muted">blocked on this page</span></div>${rows ? `<div class="hits">${rows}</div>` : ""}
    <small class="muted">${esc(filterInfo || "EasyList, EasyPrivacy and uBlock filters")}</small>`;
}
$("#shield").onclick = (e) => {
  const pop = $("#shield-pop");
  if (!pop.hidden) return (pop.hidden = true);
  closeFloating(); pop.hidden = false; drawShieldPop();
  const r = e.currentTarget.getBoundingClientRect(), w = pop.getBoundingClientRect().width;
  pop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + "px"; pop.style.top = r.bottom + 8 + "px";
};
$("#shield-pop").addEventListener("click", (e) => {
  if (!e.target.closest("#sp-toggle") || !active.url) return;
  const h = rawHost(active.url).replace(/^www\./, "");
  prefs.allow = paused(active.url) ? prefs.allow.filter((d) => !(rawHost(active.url) === d || rawHost(active.url).endsWith("." + d))) : [...prefs.allow, h];
  savePrefs(); syncAdblock(); drawShield();
  setTimeout(() => { if (active.frame) { active.loading = true; active.frame.reload(); render(); } }, 120); // reload so the change applies
});
document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#shield-pop, #shield, #sugg, #address")) $("#shield-pop").hidden = true; });
$("#allowlist").addEventListener("click", (e) => {
  const b = e.target.closest("[data-al]"); if (!b) return;
  prefs.allow.splice(+b.dataset.al, 1); savePrefs(); syncAdblock(); drawSettings(); render();
});
navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => {
  const d = e.data; if (!d || !d.cloudora) return;
  if (d.cloudora === "allow" && Array.isArray(d.hosts)) { prefs.allow = d.hosts; savePrefs(); drawSettings(); render(); }
  else if (d.cloudora === "blocked" && Array.isArray(d.items)) {
    for (const it of d.items) {
      const t = (active.url && rawHost(active.url) === it.doc ? active : tabs.find((x) => x.url && rawHost(x.url) === it.doc)) || active; // frames inside a page report their own host, so fall back to the tab you're looking at
      t.blocked++; if (t.hits.length < 300) t.hits.push(it);
    }
    drawShield();
  }
});

applyTheme();
if (matchMedia("(max-width:720px)").matches) el.app.classList.add("collapsed");
newTab();
boot().then(restoreSession).catch((err) => { el.status.textContent = "Offline"; showNotice("Couldn't start the proxy: " + err.message); console.error(err); });
