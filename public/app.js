"use strict";
const $ = (s) => document.querySelector(s);
const db = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("skyhop:" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("skyhop:" + k, JSON.stringify(v)); } catch {} },
};
const ENGINES = {
  DuckDuckGo: "https://duckduckgo.com/?q=%s",
  Brave: "https://search.brave.com/search?q=%s",
  Bing: "https://www.bing.com/search?q=%s",
  Google: "https://www.google.com/search?q=%s",
};
const THEMES = { midnight: "#7aa2ff", dracula: "#bd93f9", mocha: "#89b4fa", sakura: "#ff9ec7" };
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
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
};
const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n]}"/></svg>`;
document.querySelectorAll("[data-ic]").forEach((b) => b.insertAdjacentHTML("afterbegin", ic(b.dataset.ic)));

const el = { app: $("#app"), tabs: $("#tablist"), views: $("#views"), home: $("#home"), addr: $("#address"),
  tiles: $("#tiles"), notice: $("#notice"), status: $("#status"), star: $("#star") };
let tabs = [], active = null, scramjet = null, ready = false, nextId = 1;
let engine = db.get("engine", "DuckDuckGo");

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
  const conn = new BareMux.BareMuxConnection("/baremux/worker.js");
  const wisp = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/";
  if ((await conn.getTransport()) !== "/libcurl/index.mjs") await conn.setTransport("/libcurl/index.mjs", [{ websocket: wisp }]);
  ready = true;
  el.status.textContent = "Connected";
}

function newTab(url) {
  const tab = { id: nextId++, url: "", title: "New tab", frame: null, loading: false, row: document.createElement("div") };
  tab.row.className = "tab";
  tab.row.addEventListener("click", () => select(tab));
  tab.row.addEventListener("auxclick", (e) => { if (e.button === 1) closeTab(tab); });
  tabs.push(tab); el.tabs.appendChild(tab.row);
  select(tab);
  if (url) go(tab, url); else $("#home-q").focus();
  return tab;
}

function ensureFrame(tab) {
  if (tab.frame) return tab.frame;
  const f = scramjet.createFrame();
  el.views.appendChild(f.frame);
  f.addEventListener("urlchange", (e) => { tab.url = e.url; tab.title = host(e.url); render(); });
  f.frame.addEventListener("load", () => {
    tab.loading = false;
    try { const t = f.frame.contentDocument.title; if (t) tab.title = t; } catch {}
    render();
  });
  return (tab.frame = f);
}

function go(tab, url) {
  if (!ready) { showNotice("Still connecting — try again in a second."); return; }
  const f = ensureFrame(tab);
  tab.url = url; tab.title = host(url); tab.loading = true;
  f.go(url); render();
}

function select(tab) { active = tab; render(); }

function closeTab(tab) {
  const i = tabs.indexOf(tab);
  tabs.splice(i, 1); tab.row.remove(); tab.frame?.frame.remove();
  if (!tabs.length) newTab(); else if (tab === active) select(tabs[Math.max(0, i - 1)]);
}

function render() {
  for (const t of tabs) {
    t.row.className = "tab" + (t === active ? " active" : "") + (t.loading ? " loading" : "");
    t.row.innerHTML = `${fav(t.url)}<span class="t">${esc(t.title)}</span><button class="x" title="Close">${ic("close")}</button>`;
    t.row.querySelector(".x").onclick = (e) => { e.stopPropagation(); closeTab(t); };
    if (t.frame) t.frame.frame.classList.toggle("active", t === active);
  }
  const home = !active.url;
  el.home.hidden = !home;
  if (home) renderTiles();
  if (document.activeElement !== el.addr) el.addr.value = active.url;
  el.star.classList.toggle("on", !!active.url && bookmarks().some((b) => b.url === active.url));
  document.title = active.url ? active.title + " · Skyhop" : "Skyhop";
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

$("#bar").addEventListener("submit", (e) => { e.preventDefault(); const u = toUrl(el.addr.value); if (u) go(active, u); el.addr.blur(); });
$("#home-form").addEventListener("submit", (e) => { e.preventDefault(); const u = toUrl($("#home-q").value); if (u) { $("#home-q").value = ""; go(active, u); } });
el.addr.addEventListener("focus", () => el.addr.select());
$("#back").onclick = () => active.frame?.back();
$("#forward").onclick = () => active.frame?.forward();
$("#reload").onclick = () => { if (active.frame) { active.loading = true; active.frame.reload(); render(); } };
$("#new-tab").onclick = () => newTab();
$("#toggle").onclick = () => el.app.classList.toggle("collapsed");
el.star.onclick = () => {
  if (!active.url) return;
  const l = bookmarks(), i = l.findIndex((b) => b.url === active.url);
  if (i >= 0) l.splice(i, 1); else l.push({ url: active.url, title: host(active.url) });
  db.set("bookmarks", l); render();
};
document.addEventListener("keydown", (e) => {
  if (e.altKey && e.key === "t") { e.preventDefault(); newTab(); }
  else if (e.altKey && e.key === "w") { e.preventDefault(); closeTab(active); }
  else if (e.altKey && e.key === "l") { e.preventDefault(); el.addr.focus(); }
  else if (e.key === "Escape") $("#settings").hidden = true;
});

// settings
const setTheme = (t) => { document.documentElement.dataset.theme = t; db.set("theme", t); drawThemes(); };
function drawThemes() {
  $("#themes").innerHTML = Object.entries(THEMES).map(([n, c]) => `<button class="sw${document.documentElement.dataset.theme === n ? " on" : ""}" data-t="${n}" title="${n}" style="background:${c}"></button>`).join("");
}
$("#themes").addEventListener("click", (e) => { const b = e.target.closest(".sw"); if (b) setTheme(b.dataset.t); });
$("#engine").innerHTML = Object.keys(ENGINES).map((n) => `<option${n === engine ? " selected" : ""}>${n}</option>`).join("");
$("#engine").onchange = (e) => { engine = e.target.value; db.set("engine", engine); };
$("#open-settings").onclick = () => { drawThemes(); $("#settings").hidden = false; };
$("#close-settings").onclick = () => ($("#settings").hidden = true);
$("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") e.target.hidden = true; });

if (matchMedia("(max-width:720px)").matches) el.app.classList.add("collapsed");
newTab();
boot().catch((err) => { el.status.textContent = "Offline"; showNotice("Couldn't start the proxy: " + err.message); console.error(err); });
