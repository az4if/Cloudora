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
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  puzzle: "M19.4 7.9c-.05.3.06.65.29.88l1.57 1.57a2.4 2.4 0 0 1 0 3.4l-1.6 1.6a1 1 0 0 1-.84.28c-.47-.07-.8-.48-.97-.93a2.5 2.5 0 1 0-3.21 3.21c.45.17.86.5.93.97a1 1 0 0 1-.28.84l-1.6 1.6a2.4 2.4 0 0 1-3.4 0l-1.57-1.57a1 1 0 0 0-.88-.29c-.49.07-.84.5-1.02.97a2.5 2.5 0 1 1-3.24-3.24c.46-.18.9-.53.97-1.02a1 1 0 0 0-.29-.88L2 13.4a2.4 2.4 0 0 1 0-3.4l1.53-1.53c.24-.24.58-.35.92-.3.51.08.88.53 1.07 1.01a2.5 2.5 0 1 0 3.26-3.26c-.48-.2-.93-.56-1.01-1.07-.05-.34.06-.68.3-.92L9.6 2.4a2.4 2.4 0 0 1 3.4 0l1.57 1.57c.23.23.56.34.88.29.49-.07.84-.5 1.02-.97a2.5 2.5 0 1 1 3.24 3.24c-.46.18-.9.53-.97 1.02z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  shield: "M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z", shieldoff: "M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6zM4 4l16 16",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2", dots: "M5 12h.01M12 12h.01M19 12h.01", pin: "M12 17v5M9 3h6l-1 6 3 3H7l3-3z",
  find: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3", up: "M18 15l-6-6-6 6", check: "M20 6L9 17l-5-5", info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-5M12 8h.01", palette: "M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .4-2.1 1.5-2.1H17a4 4 0 0 0 4-4c0-4.4-4-10-9-10zM7.5 12h.01M9 7.5h.01M14.5 7.5h.01", ext: "M14 3h7v7M10 14L21 3M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5", down: "M6 9l6 6 6-6", search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3", globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
};
const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n]}"/></svg>`;
document.querySelectorAll("[data-ic]").forEach((b) => b.insertAdjacentHTML("afterbegin", ic(b.dataset.ic)));

const el = { app: $("#app"), tabs: $("#tablist"), views: $("#views"), home: $("#home"), addr: $("#address"),
  tiles: $("#tiles"), disc: $("#discover"), notice: $("#notice"), status: $("#status"), star: $("#star") };
let routing = false, tabs = [], active = null, scramjet = null, ready = false, nextId = 1, dragTab = null;
const closed = []; // recently closed tabs, for Reopen closed tab
let engine = db.get("engine", "DuckDuckGo");
const prefs = Object.assign({ adblock: true, allow: [], restore: true, history: true, glow: true, impersonate: true, toolbar: "auto", addrbar: "auto", theme: { mode: "dark", palette: "midnight", h: 222, s: 100 } }, db.get("prefs", {}));
if (prefs.theme.mode === "amoled") prefs.theme.mode = "dark"; // AMOLED is now just Dark
const savePrefs = () => db.set("prefs", prefs);
document.documentElement.classList.toggle("noglow", !prefs.glow);
const PAGE_TITLES = { home: "New tab", history: "History" }; // plugins add their own pages (see the plugin runtime below)
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
  try { const cfg = await (await fetch("/api/config", { cache: "no-store" })).json(); serverImpersonate = !!cfg.impersonate; if (cfg.version) { $("#ver").textContent = "Version " + cfg.version; coreVer = cfg.version; } } catch {}
  await applyTransport();
  ready = true; netGate.res();
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
  $("#imp-row").hidden = !serverImpersonate;
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
    t.row.innerHTML = `${fav(t.url || (t.page !== "home" ? t.page : ""))}<span class="t">${esc(t.title)}</span><span class="pn">${ic("pin")}</span><button class="x xb" title="Close" aria-label="Close tab">${ic("close")}</button>`;
    t.row.querySelector(".x").onclick = (e) => { e.stopPropagation(); closeTab(t); };
    if (t.frame) t.frame.frame.classList.toggle("active", t === active);
  }
  const blank = !active.url;
  el.home.hidden = !(blank && active.page === "home");
  el.disc.hidden = !(blank && active.page !== "home");
  if (!el.home.hidden) renderTiles();
  if (!el.disc.hidden) {
    if (!routing && !discKey.startsWith(active.page + "|")) { $("#d-q").value = ""; leaveViews(); }
    showDiscover(active.page, $("#d-q").value.trim());
  }
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", blank && b.dataset.page === active.page));
  if (document.activeElement !== el.addr) el.addr.value = active.url;
  el.star.classList.toggle("on", !!active.url && bookmarks().some((b) => b.url === active.url));
  document.title = active.url ? active.title + " · Cloudora" : "Cloudora";
  drawShield();
  syncHash();
}

const bookmarks = () => db.get("bookmarks", []);
const MAX_SC = 30;
function shortcuts() { // the editable list on the home page; first run seeds it from bookmarks (older versions) or the defaults
  let l = db.get("shortcuts", null);
  if (!Array.isArray(l)) { const b = bookmarks(); l = (b.length ? b : DEFAULT_TILES).map(({ title, url }) => ({ title, url })); db.set("shortcuts", l); }
  return l;
}
function renderTiles() {
  const l = shortcuts();
  el.tiles.innerHTML = l.map((b, i) => `<div class="tile" draggable="true" tabindex="0" data-i="${i}" data-u="${esc(b.url)}"><div class="tb"><button type="button" class="rm xb" data-act="menu" title="More" aria-label="More options for ${esc(b.title)}" aria-haspopup="menu">${ic("dots")}</button></div>${fav(b.url)}<span>${esc(b.title)}</span></div>`).join("")
    + (l.length < MAX_SC ? `<button type="button" class="tile add" data-act="add" title="Add shortcut">${ic("plus")}<span>Add</span></button>` : "");
}
let scEdit = -1;
function openShortcut(i) {
  scEdit = i; const b = i >= 0 ? shortcuts()[i] : { title: "", url: "" };
  $("#sc-title").textContent = i >= 0 ? "Edit shortcut" : "Add shortcut";
  $("#sc-name").value = b.title; $("#sc-url").value = b.url;
  $("#sc-del").hidden = i < 0; document.querySelectorAll("#sc-form input").forEach((x) => x.classList.remove("bad"));
  $("#scd").hidden = false; $("#sc-" + (i >= 0 ? "name" : "url")).focus();
}
const closeShortcut = () => { $("#scd").hidden = true; };
function saveShortcut() {
  const u = $("#sc-url"); let raw = u.value.trim(), url = "";
  if (raw) { try { const x = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : "https://" + raw); if (/^https?:$/.test(x.protocol) && x.hostname.includes(".") || x.hostname === "localhost") url = x.href; } catch {} }
  u.classList.toggle("bad", !url); if (!url) return u.focus();
  const title = $("#sc-name").value.trim().slice(0, 40) || host(url), l = shortcuts();
  if (scEdit >= 0) l[scEdit] = { title, url }; else if (l.length < MAX_SC) l.push({ title, url });
  db.set("shortcuts", l); closeShortcut(); renderTiles(); drawSettings();
}
$("#sc-form").addEventListener("submit", (e) => { e.preventDefault(); saveShortcut(); });
$("#sc-cancel").onclick = closeShortcut;
$("#sc-del").onclick = () => { const l = shortcuts(); if (scEdit >= 0) l.splice(scEdit, 1); db.set("shortcuts", l); closeShortcut(); renderTiles(); drawSettings(); toast("Shortcut removed"); };
$("#scd").addEventListener("mousedown", (e) => { if (e.target.id === "scd") closeShortcut(); });
$("#sc-url").addEventListener("input", (e) => e.target.classList.remove("bad"));
el.tiles.addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]"), t = e.target.closest(".tile");
  if (act) {
    e.stopPropagation();
    if (act.dataset.act === "add") return openShortcut(-1);
    const i = +act.closest(".tile").dataset.i, r = act.getBoundingClientRect();
    return showMenu(r.right - 170, r.bottom + 6, [
      { icon: "edit", label: "Edit…", fn: () => openShortcut(i) },
      { icon: "trash", label: "Remove", fn: () => { const l = shortcuts(); l.splice(i, 1); db.set("shortcuts", l); renderTiles(); drawSettings(); toast("Shortcut removed"); } },
    ]);
  }
  if (t && t.dataset.u) go(active, t.dataset.u);
});
el.tiles.addEventListener("keydown", (e) => {
  const t = e.target.closest(".tile[data-u]"); if (!t || e.target !== t) return;
  if (e.key === "Enter") go(active, t.dataset.u);
  else if (e.key === "Delete") { const l = shortcuts(); l.splice(+t.dataset.i, 1); db.set("shortcuts", l); renderTiles(); }
});
let dragI = -1; // drag a shortcut onto another to reorder
el.tiles.addEventListener("dragstart", (e) => { const t = e.target.closest(".tile[data-i]"); if (!t) return; dragI = +t.dataset.i; t.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.dataset.u); });
el.tiles.addEventListener("dragover", (e) => { const t = e.target.closest(".tile[data-i]"); if (dragI < 0 || !t) return; e.preventDefault(); el.tiles.querySelectorAll(".over").forEach((x) => x !== t && x.classList.remove("over")); t.classList.add("over"); });
el.tiles.addEventListener("dragend", () => { dragI = -1; el.tiles.querySelectorAll(".drag,.over").forEach((x) => x.classList.remove("drag", "over")); });
el.tiles.addEventListener("drop", (e) => {
  const t = e.target.closest(".tile[data-i]"); if (dragI < 0 || !t) return; e.preventDefault();
  const to = +t.dataset.i, l = shortcuts();
  if (to !== dragI) { l.splice(to, 0, l.splice(dragI, 1)[0]); db.set("shortcuts", l); }
  dragI = -1; renderTiles();
});
// ---------- PWA: install button, share target / launch URL, offline notice ----------
let installEv = null;
const isStandalone = () => ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"].some((m) => matchMedia(`(display-mode:${m})`).matches) || navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function drawInstall() {
  const can = !!installEv && !isStandalone();
  $("#install-home").hidden = !can; $("#pwa-btn").hidden = !can;
  $("#pwa-info").textContent = isStandalone() ? "You're using the installed app" : can ? "Add it to your desktop or home screen"
    : isIOS ? "In Safari, tap Share, then Add to Home Screen" : "Use your browser's menu: Install app / Add to Home screen";
}
async function installApp() {
  if (!installEv) return;
  const ev = installEv; installEv = null; drawInstall();
  try { ev.prompt(); await ev.userChoice; } catch {}
}
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEv = e; drawInstall(); });
addEventListener("appinstalled", () => { installEv = null; drawInstall(); toast("Cloudora installed"); });
$("#install-home").onclick = $("#pwa-btn").onclick = installApp;
drawInstall();
// Web Share Target / "open with": /?url=... or ?text=... opens that address in a new tab
function launchUrl() {
  const q = new URLSearchParams(location.search); let u = "";
  for (const k of ["url", "text", "title"]) { const m = /https?:\/\/[^\s]+/i.exec(q.get(k) || ""); if (m) { u = m[0]; break; } }
  if (location.search) history.replaceState(history.state, "", location.pathname + location.hash);
  return u;
}
const OFFLINE_MSG = "You're offline. Your shortcuts and settings still work, but websites need a connection.";
function netState() { if (!navigator.onLine) showNotice(OFFLINE_MSG); else if (el.notice.textContent === OFFLINE_MSG) el.notice.hidden = true; }
addEventListener("online", netState); addEventListener("offline", netState); netState();

// ---------- layout: toolbar position (top/bottom) and address bar visibility; "auto" = bottom bar, no address bar on phones ----------
const phoneMQ = matchMedia("(max-width:720px)");
const LAYOUT = { toolbar: ["auto", "top", "bottom"], addrbar: ["auto", "show", "hide"] };
function applyLayout() {
  const phone = phoneMQ.matches;
  if (!LAYOUT.toolbar.includes(prefs.toolbar)) prefs.toolbar = "auto";
  if (!LAYOUT.addrbar.includes(prefs.addrbar)) prefs.addrbar = "auto";
  el.app.dataset.bar = prefs.toolbar === "auto" ? (phone ? "bottom" : "top") : prefs.toolbar;
  el.app.dataset.addr = prefs.addrbar === "auto" ? (phone ? "hide" : "show") : prefs.addrbar;
}
const barBottom = () => el.app.dataset.bar === "bottom";
phoneMQ.addEventListener("change", applyLayout);
applyLayout();
// with the address bar hidden, Alt+L / the menu show it for one entry (the other toolbar buttons step aside)
function openAddress() {
  if (el.app.dataset.addr === "hide") {
    el.app.classList.add("addr-tmp"); el.app.dataset.addr = "show";
    el.addr.addEventListener("blur", () => { el.app.classList.remove("addr-tmp"); applyLayout(); }, { once: true });
  }
  el.addr.focus();
}
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
  const title = active.title && active.title !== host(active.url) ? active.title : host(active.url);
  if (i >= 0) l.splice(i, 1); else { l.push({ url: active.url, title }); const sc = shortcuts(); if (sc.length < MAX_SC && !sc.some((x) => x.url === active.url)) { sc.push({ url: active.url, title }); db.set("shortcuts", sc); } }
  db.set("bookmarks", l); render(); toast(i >= 0 ? "Bookmark removed" : "Bookmarked");
}
el.star.onclick = toggleBookmark;
function onKey(e) {
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const c = e.code, num = /^Digit([1-9])$/.exec(c);
    const act = e.shiftKey && c === "KeyT" ? reopenTab : c === "KeyT" ? () => newTab() : c === "KeyW" ? () => closeTab(active) : c === "KeyL" ? openAddress
      : c === "KeyF" ? openFind : c === "KeyH" ? () => openPage("history") : c === "KeyD" ? toggleBookmark : c === "KeyR" ? () => $("#reload").click()
      : c === "ArrowLeft" ? () => active.frame?.back() : c === "ArrowRight" ? () => active.frame?.forward()
      : c === "Equal" || c === "NumpadAdd" ? () => zoomBy(1) : c === "Minus" || c === "NumpadSubtract" ? () => zoomBy(-1) : c === "Digit0" || c === "Numpad0" ? () => zoomBy(0)
      : num ? () => { const t = num[1] === "9" ? tabs[tabs.length - 1] : tabs[+num[1] - 1]; if (t) select(t); } : null;
    if (act) { e.preventDefault(); act(); }
  } else if (e.key === "Escape") { if (closeDD()) return; if (!$("#pld").hidden) return closePld(false); if (!$("#scd").hidden) return closeShortcut(); if (!$("#settings").hidden) return closeSettings(); closeTop(); closeFloating(); if (!$("#findbar").hidden) closeFind(); }
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
function drawSwatches() { const y = $(".spanes").scrollTop; drawSettings(); $(".spanes").scrollTop = y; }
function drawSettings() {
  const t = prefs.theme;
  $("#modes").innerHTML = MODES.map((m) => `<button type="button" role="radio" aria-checked="${t.mode === m}" class="mt${t.mode === m ? " on" : ""}" data-m="${m}"><span class="mp mp-${m === "auto" ? "auto" : m}"></span>${m[0].toUpperCase() + m.slice(1)}</button>`).join("");
  const sw = Object.entries(PRESETS).map(([n, [h, sat]]) => [n, hsl(h, sat, 70), t.palette === n]);
  if (t.palette === "custom") sw.push(["custom", hsl(t.h, Math.max(t.s, 45), 70), true]);
  $("#themes").innerHTML = sw.map(([n, c, on]) => `<button type="button" class="sw${on ? " on" : ""}" data-t="${n}" title="${n[0].toUpperCase() + n.slice(1)}" aria-label="${n}" aria-pressed="${on}" style="background:${c}">${on ? ic("check") : ""}</button>`).join("");
  drawWheel();
  document.querySelectorAll(".switch[data-k]").forEach((b) => { b.classList.toggle("on", prefs[b.dataset.k]); b.setAttribute("aria-checked", prefs[b.dataset.k]); });
  document.querySelectorAll(".seg[data-k]").forEach((g) => g.querySelectorAll("button").forEach((b) => { const on = prefs[g.dataset.k] === b.dataset.v; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }));
  $("#allowbox").hidden = !prefs.allow.length;
  $("#allowlist").innerHTML = prefs.allow.map((h, i) => `<button class="chip" data-al="${i}" title="Resume blocking on this site">${esc(h)}${ic("close")}</button>`).join("");
  if (filterInfo) $("#filter-info").textContent = filterInfo;
  $("#engine-l").textContent = engine;
  const nh = histList().length, nb = bookmarks().length;
  $("#hist-n").textContent = nh ? `${nh} page${nh > 1 ? "s" : ""} saved` : "Nothing saved";
  $("#bm-n").textContent = nb ? `${nb} bookmark${nb > 1 ? "s" : ""}` : "No bookmarks";
  $("#clear-hist").disabled = !nh; $("#clear-bm").disabled = !nb;
  const ns = shortcuts().length; $("#sc-n").textContent = ns ? `${ns} shortcut${ns > 1 ? "s" : ""}` : "None";
  drawInstall();
}
$("#modes").addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) setTheme({ mode: b.dataset.m }); });
$("#themes").addEventListener("click", (e) => { const b = e.target.closest(".sw"); if (b) setTheme({ palette: b.dataset.t }); });
const wheelPick = (e) => {
  const r = $("#wheel").getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
  const cur = prefs.theme.palette === "custom" ? prefs.theme.s : (PRESETS[prefs.theme.palette] || PRESETS.midnight)[1];
  prefs.theme = { ...prefs.theme, palette: "custom", h: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, s: cur };
  savePrefs(); applyTheme(); drawWheel(); drawSwatches();
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
$("#engine-btn").insertAdjacentHTML("beforeend", ic("down"));
$("#engine-btn").onclick = (e) => openDD(e.currentTarget, Object.keys(ENGINES).map((n) => [n, n]), engine, (n) => { engine = n; db.set("engine", n); $("#engine-l").textContent = n; });
// destructive buttons ask twice: the first click arms the button for 3 seconds
function armed(btn, label, action) {
  btn.onclick = () => {
    if (btn.classList.contains("arm")) { clearTimeout(btn._t); btn.classList.remove("arm"); btn.textContent = label; return action(); }
    btn.classList.add("arm"); btn.textContent = "Click to confirm";
    btn._t = setTimeout(() => { btn.classList.remove("arm"); btn.textContent = label; }, 3000);
  };
}
document.querySelectorAll(".seg[data-k]").forEach((g) => g.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-v]"); if (!b) return;
  prefs[g.dataset.k] = b.dataset.v; savePrefs(); applyLayout(); drawSettings();
}));
armed($("#clear-hist"), "Clear", () => { db.set("history", []); refreshDiscover("history", true); drawSettings(); toast("History cleared"); });
armed($("#reset-sc"), "Reset", () => { db.set("shortcuts", DEFAULT_TILES.map((x) => ({ ...x }))); render(); drawSettings(); toast("Shortcuts reset"); });
armed($("#clear-bm"), "Clear", () => { db.set("bookmarks", []); render(); drawSettings(); toast("Bookmarks cleared"); });
// sections
const PANES = ["appearance", "search", "privacy", "browser", "plugins", "about"];
function showPane(name) {
  if (!PANES.includes(name)) name = "appearance";
  db.set("settingsTab", name);
  document.querySelectorAll("#set-nav [data-tab]").forEach((b) => { const on = b.dataset.tab === name; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
  document.querySelectorAll(".pane").forEach((p) => (p.hidden = p.dataset.pane !== name));
  $(".spanes").scrollTop = 0;
  if (name === "plugins") drawPlugins();
}
$("#set-nav").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) showPane(b.dataset.tab); });
$("#set-nav").addEventListener("keydown", (e) => {
  const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0; if (!d) return;
  e.preventDefault(); const i = PANES.indexOf(db.get("settingsTab", "appearance")), n = PANES[(i + d + PANES.length) % PANES.length];
  showPane(n); document.querySelector(`#set-nav [data-tab="${n}"]`).focus();
});
function openSettings(tab) { drawSettings(); showPane(tab || db.get("settingsTab", "appearance")); $("#settings").hidden = false; document.querySelector("#set-nav [aria-selected=true]").focus(); }
const closeSettings = () => { closeDD(); $("#settings").hidden = true; };
$("#open-settings").onclick = () => openSettings();
$("#close-settings").onclick = closeSettings;
$("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") closeSettings(); });

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

// Loading states: a spinner (optionally with text) and shimmering placeholder cards
const spinner = (text = "", cls = "") => `<div class="loading ${cls}" role="status" aria-live="polite"><span class="spin"></span>${text ? `<span>${esc(text)}</span>` : ""}</div>`;
const skeleton = (n = 12) => `<div class="grid">${'<div class="skcard"><i class="sk-img"></i><i class="sk-l"></i><i class="sk-l s"></i></div>'.repeat(n)}</div>`;
// Cover/page images get a shimmer until they arrive (load/error don't bubble, so listen in the capture phase)
for (const type of ["load", "error"]) document.addEventListener(type, (e) => { if (e.target.tagName === "IMG") e.target.classList.add("ok"); }, true);
const closeBtn = () => `<button type="button" class="xb md dx" title="Close" aria-label="Close">${ic("close")}</button>`;

// Pages: "history" is built in, plugins register more (api.page). A page is { id, title, list(q, ctx), route?(parts, ctx), leave?(), open?(id), action?() }.
const pages = new Map();
let discKey = "", discLoad = Promise.resolve();
function showDiscover(page, q = "") {
  const key = page + "|" + q, pg = pages.get(page);
  if (!pg) return discLoad;
  if (key === discKey) return discLoad;
  discKey = key;
  $("#d-title").textContent = PAGE_TITLES[page]; $("#d-q").placeholder = pg.placeholder || "Search " + PAGE_TITLES[page].toLowerCase() + "…";
  $("#d-form").hidden = pg.search === false;
  $("#d-body").innerHTML = spinner("Loading " + PAGE_TITLES[page].toLowerCase() + "…") + skeleton();
  const ctx = { q, body: $("#d-body"), current: () => key === discKey, render(html) { if (key === discKey) $("#d-body").innerHTML = html; } };
  return (discLoad = (async () => {
    try { await pg.list(q, ctx); }
    catch (err) { if (key === discKey) { discKey = ""; $("#d-body").innerHTML = `<p class="muted">Couldn't load this page (${esc(err.message)}).</p>`; } }
  })());
}
$("#d-form").addEventListener("submit", (e) => { e.preventDefault(); nav(listHash(active.page, $("#d-q").value.trim())); });

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

const clickHandlers = []; // plugins add theirs with api.onClick; a handler returns true when it dealt with the click
el.disc.addEventListener("click", (e) => {
  const t = e.target, d = $("#d-detail");
  for (const h of clickHandlers.slice()) { try { if (h.fn(e) === true) return; } catch (err) { console.error("[cloudora] plugin click handler failed", err); } }
  const hd = t.closest("[data-hdel]"); if (hd) { e.stopPropagation(); return histRemove(+hd.dataset.hdel); }
  const gt = t.closest("[data-goto]"); if (gt) return go(active, gt.dataset.goto);
  const open = t.closest("[data-open]"); if (open) { if (!d.hidden) nav(listHash(active.page), "replace"); return newTab(open.dataset.open); }
  if (t.closest("[data-back]")) return back();
  if (t.closest(".dx") || t === d) return back();
  const c = t.closest(".mcard"); if (!c) return;
  const pg = pages.get(active.page);
  if (pg && pg.open) return pg.open(c.dataset.id);
  nav(`${active.page}/info/${encodeURIComponent(c.dataset.id)}`);
});
// open an address in this tab when it is a blank page, else in a new tab
function openInTab(url) {
  if (!active.url) { active.page = "home"; active.title = "New tab"; go(active, url); } else newTab(url);
}
function openPage(p) {
  const pg = pages.get(p);
  if (pg && pg.action) { try { pg.action(); } catch (err) { console.error(err); toast("That plugin failed: " + err.message); } return; }
  if (!active.url) { active.page = p; active.title = PAGE_TITLES[p]; }
  else newTab(null, p);
  nav(p);
}
// nav buttons: Home, one per plugin page, History
function renderNav() {
  const order = ["home", ...[...pages.values()].filter((x) => !x.builtin && x.nav !== false).map((x) => x.id), "history"];
  $("#nav").innerHTML = order.map((id) => `<button data-page="${esc(id)}">${esc(id === "home" ? "Home" : PAGE_TITLES[id])}</button>`).join("");
  $("#nav").querySelectorAll("button").forEach((b) => (b.onclick = () => openPage(b.dataset.page)));
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", active && !active.url && b.dataset.page === active.page));
}
// logo -> home: a blank tab becomes the home page; from a website, jump to an open home tab (or make one)
$("#brand").onclick = () => {
  if (!active.url) return openPage("home");
  const h = tabs.find((t) => !t.url && t.page === "home");
  if (h) { select(h); nav("home"); } else openPage("home");
};

// ---------- #hash routing ----------
//   #home  #history  #<page>  #<page>/search/<q>  #<page>/<anything else the page's plugin understands>
// The hash is the single source of truth for what a page shows, so reload, back/forward and shared links all work.
function parseHash(h = location.hash) {
  const p = h.replace(/^#\/?/, "").split("/").filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  const page = p[0]; if (!PAGE_TITLES[page]) return null;
  const r = { page, view: "list", q: "", parts: [] };
  if (p[1] === "search" && page !== "home") return { ...r, view: "search", q: p.slice(2).join("/").trim() };
  if (p.length > 1 && pages.get(page) && pages.get(page).route) return { ...r, view: "sub", parts: p.slice(1) };
  return r;
}
const listHash = (page, q = ($("#d-q") ? $("#d-q").value.trim() : "")) => page + (q ? "/search/" + encodeURIComponent(q) : "");
// mode "push" adds a history entry, "replace" swaps the current one. history.state.i counts the entries this app pushed.
function nav(h, mode = "push") {
  if ("#" + h === location.hash) mode = "replace";
  const i = ((history.state && history.state.i) || 0) + (mode === "push" ? 1 : 0);
  history[mode === "push" ? "pushState" : "replaceState"]({ i }, "", "#" + h);
  return applyRoute();
}
function back(page = active.page) { if (((history.state && history.state.i) || 0) > 0) history.back(); else nav(listHash(page), "replace"); }
function closeTop() {
  if (active.url || ($("#player").hidden && $("#reader").hidden && $("#d-detail").hidden)) return false;
  back(); return true;
}
// keep the address of a blank tab at #<its page> (and clear it for web pages) without disturbing a deeper route
let routeReady = false; // until the address in the URL bar has been applied once, don't overwrite it
function syncHash() {
  if (!routeReady) return;
  if (active.url) { if (location.hash) history.replaceState(history.state, "", location.pathname + location.search); return; }
  const cur = parseHash();
  if (!(cur && cur.page === active.page)) history.replaceState(history.state || { i: 0 }, "", "#" + active.page);
}
// While the player or reader is open the page behind it (cards, search) is hidden, so nothing shows through or scrolls under it
let discScroll = 0;
function syncView() {
  const on = !$("#player").hidden || !$("#reader").hidden, was = el.disc.classList.contains("view");
  if (on === was) return;
  if (on) { discScroll = el.disc.scrollTop; el.disc.classList.add("view"); el.disc.scrollTop = 0; }
  else { el.disc.classList.remove("view"); const sc = discScroll; discLoad.then(() => { el.disc.scrollTop = sc; }); }
}
// hide the popup / reader / player layers and tell plugin pages to stop whatever they were showing there
function leaveViews() {
  closeDD(); $("#d-detail").hidden = true; $("#reader").hidden = true;
  for (const pg of pages.values()) { try { pg.leave && pg.leave(); } catch (err) { console.error("[cloudora] plugin leave() failed", err); } }
  $("#player").hidden = true; $("#player").innerHTML = ""; $("#reader").innerHTML = "";
  syncView();
}
let routeSeq = 0;
async function applyRoute(initial = false) {
  const r = parseHash(); if (!r || !active) return;
  const pg = pages.get(r.page);
  if (pg && pg.action) { history.replaceState({ i: (history.state && history.state.i) || 0 }, "", "#home"); return openPage(r.page); } // link-style page (e.g. a plugin that just opens a site)
  if (active.url) { if (!initial) return; newTab(null, r.page); }
  else if (active.page !== r.page) { active.page = r.page; active.title = PAGE_TITLES[r.page]; }
  const seq = ++routeSeq;
  routing = true; $("#d-q").value = r.q; try { render(); } finally { routing = false; }
  const stale = () => seq !== routeSeq;
  if (r.page === "home" || r.view !== "sub") { leaveViews(); return; }
  let handled = false;
  try { handled = await pg.route(r.parts, { stale, nav, replace: (h) => nav(h, "replace"), toast, syncView }); }
  catch (err) { console.error("[cloudora] plugin route failed", err); toast("That page failed to load"); }
  if (stale()) return;
  if (handled === false) { leaveViews(); return; }
  syncView();
}
addEventListener("popstate", () => { if (!active.url) applyRoute(); });


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
pages.set("history", { id: "history", title: "History", builtin: true, placeholder: "Search history…", async list(q, ctx) {
  const s = q.toLowerCase(), list = histList().filter((h) => !s || (h.title + " " + h.url).toLowerCase().includes(s));
  if (!list.length) return ctx.render(`<p class="muted">${q ? "No matches." : prefs.history ? "Nothing here yet. Pages you visit show up here." : "History is turned off in Settings."}</p>`);
  let html = "", day = "";
  for (const h of list.slice(0, 400)) {
    const d = dayLabel(h.t);
    if (d !== day) { day = d; html += `<div class="hday">${esc(d)}</div>`; }
    html += `<div class="hrow" data-goto="${esc(h.url)}">${fav(h.url)}<div class="tx"><b>${esc(h.title)}</b><small>${esc(h.url)}</small></div><span class="tm">${new Date(h.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><button class="rm xb" data-hdel="${h.t}" title="Remove" aria-label="Remove from history">${ic("close")}</button></div>`;
  }
  ctx.render(html + (list.length > 400 ? '<p class="muted">Showing the latest 400.</p>' : ""));
} });

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
    const t = newTab(null, PAGE_TITLES[x.page] && !(pages.get(x.page) && pages.get(x.page).action) ? x.page : "home");
    if (x.url && /^https?:/i.test(x.url)) { t.url = x.url; t.title = x.title || host(x.url); t.lazy = true; }
    t.pinned = !!x.pinned;
  }
  first.row.remove(); tabs.splice(tabs.indexOf(first), 1);
  select(tabs[Math.max(0, Math.min(tabs.length - 1, s.active))] || tabs[0]);
}

// Menus (tab right-click, ⋯ button)
function showMenu(x, y, items, above = false) {
  const c = $("#ctx"), m = document.createElement("div"); m.className = "menu"; c.innerHTML = "";
  for (const it of items) {
    if (it === "-") { m.insertAdjacentHTML("beforeend", '<div class="msep"></div>'); continue; }
    const b = document.createElement("button"); b.className = "mi"; b.disabled = !!it.off; b.setAttribute("role", "menuitem");
    b.innerHTML = `${it.icon ? ic(it.icon) : ""}<span>${esc(it.label)}</span>${it.key ? `<kbd>${esc(it.key)}</kbd>` : ""}`;
    b.onclick = () => { closeFloating(); it.fn(); }; m.appendChild(b);
  }
  c.appendChild(m); c.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + "px"; m.style.top = Math.max(8, Math.min(above ? y - r.height : y, innerHeight - r.height - 8)) + "px";
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
  showMenu(r.right - 230, barBottom() ? r.top - 6 : r.bottom + 6, [
    ...(el.app.dataset.addr === "hide" ? [{ label: "Go to address…", key: "Alt+L", fn: openAddress }] : []),
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
  ], barBottom());
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
  pop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + "px"; pop.style.top = (barBottom() ? Math.max(8, r.top - 8 - pop.getBoundingClientRect().height) : r.bottom + 8) + "px";
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


// ---------- plugins ----------
// A plugin is one ES-module file kept in this browser (IndexedDB), added in Settings > Plugins. It gets an `api` object (see PLUGINS.md).
// Everything a plugin registers is tracked per plugin, so it can be switched off, updated or removed without reloading.
// Safe mode: open Cloudora with ?noplugins to start without loading any plugin (to recover from a broken one).
const SAFE_MODE = /[?&]noplugins\b/.test(location.search);
let coreVer = "";
const netGate = (() => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); p.catch(() => {}); return { p, res, rej }; })();
let bareClient = null;
// fetch() through the same tunnel pages use: no CORS limits, and the server's real-browser TLS when that is on
async function coreFetch(url, init = {}) {
  await Promise.race([netGate.p, new Promise((_, rej) => setTimeout(() => rej(new Error("Cloudora isn't connected yet")), 20000))]);
  bareClient ||= new BareMux.BareClient("/baremux/worker.js");
  return bareClient.fetch(url, init);
}

// <img data-img="https://..."> : lazy-loaded; tries a direct CORS load first (page is cross-origin isolated, so plain
// cross-site images are blocked) and falls back to fetching the bytes through the tunnel.
function fillImg(img) {
  const u = img.dataset.img; if (!u) return;
  img.removeAttribute("data-img"); img.referrerPolicy = "no-referrer";
  let tried = false;
  img.addEventListener("error", async () => {
    if (tried) return; tried = true;
    try {
      const r = await coreFetch(u, { headers: { accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" } });
      if (!r.ok) throw new Error("status " + r.status);
      const url = URL.createObjectURL(await r.blob());
      img.removeAttribute("crossorigin"); img.addEventListener("load", () => URL.revokeObjectURL(url), { once: true }); img.src = url;
    } catch {}
  }, { once: true });
  img.crossOrigin = "anonymous"; img.src = u;
}
const imgIO = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { imgIO.unobserve(e.target); fillImg(e.target); } }), { rootMargin: "400px" }) : null;
const queueImg = (i) => (imgIO ? imgIO.observe(i) : fillImg(i));
const scanImgs = (n) => { if (n.nodeType !== 1) return; if (n.matches("img[data-img]")) queueImg(n); n.querySelectorAll("img[data-img]").forEach(queueImg); };
new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(scanImgs))).observe($("#stage"), { childList: true, subtree: true });

const loaded = new Map(), pluginErrors = new Map(); // id -> { row, off:[], settings } / id -> message
const pluginDb = (id) => ({
  get: (k, d) => db.get(`plugin:${id}:${k}`, d),
  set: (k, v) => db.set(`plugin:${id}:${k}`, v),
  remove: (k) => { try { localStorage.removeItem(`cloudora:plugin:${id}:${k}`); } catch {} },
});
function makeApi(rec) {
  const id = rec.row.id, off = (fn) => rec.off.push(fn);
  return {
    id, version: 1, get coreVersion() { return coreVer; },
    // add a page: { id, title, list(q, ctx), route?(parts, ctx), leave?(), open?(cardId), placeholder?, search?, nav? } or a link-style { id, title, action() }
    page(def) {
      if (!def || typeof def.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(def.id)) throw new Error("api.page: id must be lowercase letters, digits and dashes");
      if (def.id === "home" || def.id === "history" || (pages.has(def.id) && pages.get(def.id).owner !== id)) throw new Error(`api.page: "${def.id}" is already taken`);
      if (typeof def.title !== "string" || !def.title.trim()) throw new Error("api.page: title is required");
      if (typeof def.list !== "function" && typeof def.action !== "function") throw new Error("api.page: give the page a list() or an action()");
      pages.set(def.id, { ...def, owner: id }); PAGE_TITLES[def.id] = def.title.trim().slice(0, 24);
      renderNav();
      off(() => {
        if (active && !active.url && active.page === def.id) leaveViews();
        pages.delete(def.id); delete PAGE_TITLES[def.id]; if (discKey.startsWith(def.id + "|")) discKey = "";
        for (const t of tabs) if (t.page === def.id) { t.page = "home"; t.title = PAGE_TITLES.home; }
        renderNav(); render();
      });
    },
    style(css) { const st = document.createElement("style"); st.dataset.plugin = id; st.textContent = String(css); document.head.appendChild(st); off(() => st.remove()); },
    onClick(fn) { const h = { fn, owner: id }; clickHandlers.push(h); off(() => { const i = clickHandlers.indexOf(h); if (i >= 0) clickHandlers.splice(i, 1); }); },
    onDispose: off,
    settings(render) { rec.settings = render; }, // render(container): fill the plugin's section in Settings > Plugins
    fetch: coreFetch,
    storage: pluginDb(id),
    navigate: nav, back: () => back(), open: openInTab, openTab: (u) => newTab(u), openPage, toast,
    invalidate(pageId) { if (discKey.startsWith(pageId + "|")) discKey = ""; }, // re-draw this page's list next time it is shown
    layers: { detail: $("#d-detail"), player: $("#player"), reader: $("#reader"), sync: syncView },
    ui: { esc, ic, icons: Object.keys(ICONS), spinner, skeleton, closeButton: closeBtn, dropdown: openDD, closeDropdown: closeDD },
  };
}
function stopPlugin(id) {
  const rec = loaded.get(id); if (!rec) return;
  loaded.delete(id);
  for (const fn of rec.off.splice(0).reverse()) { try { fn(); } catch (err) { console.error("[cloudora] plugin cleanup failed", err); } }
}
async function startPlugin(row) {
  pluginErrors.delete(row.id);
  const rec = { row, off: [], settings: null };
  loaded.set(row.id, rec);
  try { await CloudoraPlugins.run(row, makeApi(rec)); }
  catch (err) {
    console.error(`[cloudora] plugin "${row.id}" failed to start`, err);
    stopPlugin(row.id); pluginErrors.set(row.id, err.message || String(err));
  }
}
async function loadAllPlugins() {
  if (SAFE_MODE) { showNotice("Safe mode: plugins are switched off for this session."); return; }
  let rows = [];
  try { rows = await CloudoraPlugins.store.list(); } catch (err) { console.warn("[cloudora] couldn't read plugins", err); }
  for (const row of rows) if (row.enabled) await startPlugin(row);
  renderNav();
}

// ---- Settings > Plugins ----
const plugMsg = (t, bad = false) => { const m = $("#plug-msg"); m.textContent = t; m.hidden = !t; m.classList.toggle("bad", bad); };
async function drawPlugins() {
  const box = $("#plug-list"); if (!box) return;
  $("#plug-safe").hidden = !SAFE_MODE;
  const rows = await CloudoraPlugins.store.list().catch(() => []);
  $("#plug-mem").hidden = CloudoraPlugins.store.persistent;
  if (!rows.length) { box.innerHTML = '<div class="srow"><div class="st"><b>No plugins installed</b><small>Add one below to unlock extra pages.</small></div></div>'; return; }
  box.innerHTML = rows.map((r) => {
    const m = r.manifest, err = pluginErrors.get(r.id), rec = loaded.get(r.id);
    return `<div class="plug" data-id="${esc(r.id)}"><div class="plug-h"><div class="st"><b>${esc(m.name)} <span class="ver">${esc(m.version)}</span></b><small>${esc(m.description || "No description.")}</small>${err ? `<small class="err">Couldn't start: ${esc(err)}</small>` : ""}</div>
      <button type="button" class="switch${r.enabled ? " on" : ""}" role="switch" aria-checked="${!!r.enabled}" data-pl="toggle" aria-label="Enable ${esc(m.name)}"></button></div>
      <div class="plug-a">${rec && rec.settings ? '<button type="button" class="btn" data-pl="settings">Settings</button>' : ""}${r.url ? '<button type="button" class="btn" data-pl="update">Check for update</button>' : ""}<button type="button" class="btn danger" data-pl="remove">Remove</button></div>
      <div class="plug-s" hidden></div></div>`;
  }).join("");
  box.querySelectorAll('[data-pl="remove"]').forEach((b) => armed(b, "Remove", () => removePlugin(b.closest(".plug").dataset.id)));
}
$("#plug-list").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-pl]"); if (!b || b.dataset.pl === "remove") return;
  const card = b.closest(".plug"), id = card.dataset.id, rows = await CloudoraPlugins.store.list(), row = rows.find((r) => r.id === id); if (!row) return;
  if (b.dataset.pl === "toggle") {
    row.enabled = !row.enabled; await CloudoraPlugins.store.put(row);
    if (row.enabled) await startPlugin(row); else stopPlugin(id);
    return drawPlugins();
  }
  if (b.dataset.pl === "settings") {
    const box = card.querySelector(".plug-s"), rec = loaded.get(id); if (!rec || !rec.settings) return;
    box.hidden = !box.hidden; if (!box.hidden) { box.innerHTML = ""; try { rec.settings(box); } catch (err) { box.textContent = "Couldn't show settings: " + err.message; } }
    return;
  }
  if (b.dataset.pl === "update") return installFromUrl(row.url, true);
});
async function removePlugin(id) {
  stopPlugin(id); pluginErrors.delete(id);
  await CloudoraPlugins.store.remove(id); drawPlugins(); toast("Plugin removed");
}

// install flow: read the manifest (no code runs), ask the user, store, then start it right away
let pldResolve = null;
function askInstall(m, old, source) {
  const upd = !!old;
  $("#pld-title").textContent = upd ? `Update ${m.name}?` : `Install ${m.name}?`;
  $("#pld-info").innerHTML = `<div><b>${esc(m.name)}</b> <span class="ver">${esc(m.version)}</span>${upd ? ` <span class="muted">(you have ${esc(old.manifest.version)})</span>` : ""}</div>
    ${m.description ? `<div class="muted">${esc(m.description)}</div>` : ""}${m.author ? `<div class="muted">By ${esc(m.author)}</div>` : ""}<div class="muted">From ${esc(source)}</div>`;
  $("#pld-go").textContent = upd ? "Update" : "Install";
  $("#pld").hidden = false; $("#pld-go").focus();
  return new Promise((res) => { pldResolve = res; });
}
const closePld = (ok) => { $("#pld").hidden = true; if (pldResolve) { pldResolve(ok); pldResolve = null; } };
$("#pld-go").onclick = () => closePld(true); $("#pld-cancel").onclick = () => closePld(false);
$("#pld").addEventListener("mousedown", (e) => { if (e.target.id === "pld") closePld(false); });
async function installFromCode(code, source, url = "") {
  const p = CloudoraPlugins.parseManifest(code);
  if (!p.ok) return plugMsg(p.error, true);
  plugMsg("");
  const old = (await CloudoraPlugins.store.list()).find((r) => r.id === p.manifest.id);
  if (old && old.code === code) return plugMsg(`${p.manifest.name} ${p.manifest.version} is already installed and up to date.`);
  if (!(await askInstall(p.manifest, old, source))) return;
  const row = { id: p.manifest.id, manifest: p.manifest, code, enabled: true, source: url ? "url" : "file", url, installedAt: old ? old.installedAt : Date.now(), updatedAt: Date.now() };
  stopPlugin(row.id);
  await CloudoraPlugins.store.put(row);
  await startPlugin(row);
  drawPlugins();
  const err = pluginErrors.get(row.id);
  if (err) plugMsg(`${row.manifest.name} was saved but couldn't start: ${err}`, true);
  else { plugMsg(""); toast(`${row.manifest.name} ${old ? "updated" : "installed"}`); }
}
async function installFromUrl(url, quiet = false) {
  let u; try { u = new URL(url.trim()); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { return plugMsg("Enter a full http(s) address.", true); }
  plugMsg("Downloading…");
  try {
    const r = await coreFetch(u.href, { headers: { accept: "text/javascript,application/javascript,text/plain,*/*" } });
    if (!r.ok) throw new Error("the server answered " + r.status);
    const code = await r.text();
    await installFromCode(code, u.host, u.href);
    if (plugMsg && $("#plug-msg").textContent === "Downloading…") plugMsg("");
  } catch (err) { plugMsg("Couldn't download the plugin: " + err.message, true); }
}
$("#plug-file").onclick = () => $("#plug-file-in").click();
$("#plug-file-in").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (f.size > CloudoraPlugins.MAX_CODE) return plugMsg("That file is larger than 1.5 MB.", true);
  installFromCode(await f.text(), f.name);
};
$("#plug-url-go").onclick = () => { const v = $("#plug-url").value.trim(); if (v) installFromUrl(v).then(() => { if (!$("#plug-msg").classList.contains("bad")) $("#plug-url").value = ""; }); };
$("#plug-url").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#plug-url-go").click(); } });
$("#plug-paste-go").onclick = () => { const v = $("#plug-code").value; if (v.trim()) installFromCode(v, "pasted code").then(() => { if (!$("#plug-msg").classList.contains("bad")) $("#plug-code").value = ""; }); };

applyTheme();
if (matchMedia("(max-width:720px)").matches) el.app.classList.add("collapsed");
renderNav();
newTab();
const pluginsReady = loadAllPlugins();
boot().then(() => pluginsReady).then(restoreSession).then(() => { const u = launchUrl(); if (u) newTab(u); }).then(async () => { try { await applyRoute(true); } finally { routeReady = true; syncHash(); } }).catch((err) => { netGate.rej(err); el.status.textContent = "Offline"; showNotice("Couldn't start the proxy: " + err.message); console.error(err); });
