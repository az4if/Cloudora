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
  tiles: $("#tiles"), disc: $("#discover"), notice: $("#notice"), status: $("#status"), star: $("#star") };
let tabs = [], active = null, scramjet = null, ready = false, nextId = 1;
let engine = db.get("engine", "DuckDuckGo");
const prefs = Object.assign({ adblock: true, glow: true }, db.get("prefs", {}));
const savePrefs = () => db.set("prefs", prefs);
document.documentElement.classList.toggle("noglow", !prefs.glow);
const PAGE_TITLES = { home: "New tab", anime: "Anime", manga: "Manga" };
const AD_CSS = 'ins.adsbygoogle,.adsbygoogle,[id^="google_ads"],[id^="div-gpt-ad"],.ad-banner,.ad-container,.ad-slot,.ad-wrapper,.advertisement,.sponsored-ad,.taboola,[id^="taboola"],[class*="outbrain"],iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="adnxs"],iframe[src*="adsystem"],#ad,#ads,.ads{display:none!important}';
function applyCosmetics(frame) {
  try {
    const d = frame.contentDocument; if (!d) return;
    const old = d.getElementById("skyhop-adblock");
    if (!prefs.adblock) return old && old.remove();
    if (old) return;
    const s = d.createElement("style"); s.id = "skyhop-adblock"; s.textContent = AD_CSS;
    (d.head || d.documentElement).appendChild(s);
  } catch {}
}
const syncAdblock = () => navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage({ skyhop: "adblock", on: prefs.adblock })).catch(() => {});

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
  syncAdblock();
}

function newTab(url, page = "home") {
  const tab = { id: nextId++, url: "", page, title: PAGE_TITLES[page], frame: null, loading: false, row: document.createElement("div") };
  tab.row.className = "tab";
  tab.row.addEventListener("click", () => select(tab));
  tab.row.addEventListener("auxclick", (e) => { if (e.button === 1) closeTab(tab); });
  tabs.push(tab); el.tabs.appendChild(tab.row);
  select(tab);
  if (url) go(tab, url); else if (page === "home") $("#home-q").focus();
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
    applyCosmetics(f.frame);
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
    t.row.innerHTML = `${fav(t.url || (t.page !== "home" ? t.page : ""))}<span class="t">${esc(t.title)}</span><button class="x" title="Close">${ic("close")}</button>`;
    t.row.querySelector(".x").onclick = (e) => { e.stopPropagation(); closeTab(t); };
    if (t.frame) t.frame.frame.classList.toggle("active", t === active);
  }
  const blank = !active.url;
  el.home.hidden = !(blank && active.page === "home");
  el.disc.hidden = !(blank && active.page !== "home");
  if (!el.home.hidden) renderTiles();
  if (!el.disc.hidden) {
    if (!discKey.startsWith(active.page + "|")) $("#d-q").value = "";
    showDiscover(active.page, $("#d-q").value.trim());
  }
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", blank && b.dataset.page === active.page));
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
  else if (e.key === "Escape") { $("#settings").hidden = true; $("#d-detail").hidden = true; }
});

// settings
const setTheme = (t) => { document.documentElement.dataset.theme = t; db.set("theme", t); drawSettings(); };
function drawSettings() {
  $("#themes").innerHTML = Object.entries(THEMES).map(([n, c]) => `<button class="sw${document.documentElement.dataset.theme === n ? " on" : ""}" data-t="${n}" title="${n}" style="background:${c}"></button>`).join("");
  document.querySelectorAll(".switch").forEach((b) => { b.classList.toggle("on", prefs[b.dataset.k]); b.setAttribute("aria-checked", prefs[b.dataset.k]); });
}
$("#themes").addEventListener("click", (e) => { const b = e.target.closest(".sw"); if (b) setTheme(b.dataset.t); });
document.querySelectorAll(".switch").forEach((b) => (b.onclick = () => {
  const k = b.dataset.k; prefs[k] = !prefs[k]; savePrefs(); drawSettings();
  document.documentElement.classList.toggle("noglow", !prefs.glow);
  if (k === "adblock") { syncAdblock(); tabs.forEach((t) => t.frame && applyCosmetics(t.frame.frame)); }
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

// Anime / Manga pages (data from AniList; links open official sources inside Skyhop)
const FIELDS = "id title{romaji english} coverImage{large} averageScore format episodes chapters";
const LIST = `query($t:MediaType,$s:[MediaSort],$q:String){Page(perPage:20){media(type:$t,sort:$s,search:$q,isAdult:false){${FIELDS}}}}`;
const ONE = `query($id:Int){Media(id:$id){${FIELDS} type description genres siteUrl externalLinks{url site type}}}`;
async function gql(query, variables) {
  const r = await fetch("/api/anilist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (!j.data) throw new Error((j.errors && j.errors[0].message) || "AniList error");
  return j.data;
}
const mname = (m) => m.title.english || m.title.romaji;
const mmeta = (m) => [m.averageScore && "★ " + m.averageScore, m.format && m.format.replace("_", " "), m.episodes ? m.episodes + " eps" : m.chapters ? m.chapters + " ch" : ""].filter(Boolean).join(" · ");
const cover = (m) => `/img?u=${encodeURIComponent(m.coverImage.large)}`;
const card = (m) => `<div class="mcard glow" data-id="${m.id}"><img loading="lazy" alt="" src="${cover(m)}"><b>${esc(mname(m))}</b><small>${esc(mmeta(m))}</small></div>`;
let discKey = "";
async function showDiscover(page, q = "") {
  const key = page + "|" + q;
  if (key === discKey) return;
  discKey = key;
  const body = $("#d-body");
  $("#d-title").textContent = PAGE_TITLES[page];
  body.innerHTML = '<p class="muted">Loading…</p>';
  const rows = q ? [["Results", { s: ["SEARCH_MATCH"], q }]] : [["Trending now", { s: ["TRENDING_DESC"] }], ["Most popular", { s: ["POPULARITY_DESC"] }]];
  try {
    const data = await Promise.all(rows.map(([, v]) => gql(LIST, { t: page.toUpperCase(), ...v })));
    if (key !== discKey) return;
    body.innerHTML = rows.map(([h], i) => `<h3>${h}</h3><div class="grid">${data[i].Page.media.map(card).join("") || '<p class="muted">Nothing found.</p>'}</div>`).join("");
  } catch (err) {
    if (key === discKey) { discKey = ""; body.innerHTML = `<p class="muted">Couldn't reach AniList (${esc(err.message)}).</p>`; }
  }
}
$("#d-form").addEventListener("submit", (e) => { e.preventDefault(); showDiscover(active.page, $("#d-q").value.trim()); });
el.disc.addEventListener("click", async (e) => {
  const d = $("#d-detail");
  const open = e.target.closest("[data-open]");
  if (open) { d.hidden = true; return newTab(open.dataset.open); }
  if (e.target.closest(".dx") || e.target === d) { d.hidden = true; return; }
  const c = e.target.closest(".mcard");
  if (!c) return;
  d.hidden = false; d.innerHTML = '<div class="dcard"><button class="ghost dx">' + ic("close") + '</button><p class="muted">Loading…</p></div>';
  try {
    const m = (await gql(ONE, { id: +c.dataset.id })).Media;
    const desc = (m.description || "No description.").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    const seen = new Set();
    const links = [...(m.externalLinks || []), { url: m.siteUrl, site: "AniList", type: "INFO" }]
      .filter((l) => l.url && /^https?:\/\//.test(l.url) && l.type !== "SOCIAL" && !seen.has(l.site) && seen.add(l.site)).slice(0, 9);
    d.innerHTML = `<div class="dcard"><button class="ghost dx">${ic("close")}</button><img alt="" src="${cover(m)}"><div>
      <h2>${esc(mname(m))}</h2><small>${esc(mmeta(m))}</small>
      <div class="chips" style="margin-top:8px">${(m.genres || []).map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div>
      <p class="desc">${esc(desc)}</p>
      <h4>${m.type === "ANIME" ? "Where to watch" : "Where to read"}</h4>
      <div class="chips">${links.map((l) => `<button class="chip" data-open="${esc(l.url)}">${esc(l.site)}</button>`).join("")}</div></div></div>`;
  } catch (err) { d.innerHTML = `<div class="dcard"><button class="ghost dx">${ic("close")}</button><p class="muted">Couldn't load details (${esc(err.message)}).</p></div>`; }
});
function openPage(p) {
  if (!active.url) { active.page = p; active.title = PAGE_TITLES[p]; render(); } else newTab(null, p);
}
document.querySelectorAll("#nav button").forEach((b) => (b.onclick = () => openPage(b.dataset.page)));

if (matchMedia("(max-width:720px)").matches) el.app.classList.add("collapsed");
newTab();
boot().catch((err) => { el.status.textContent = "Offline"; showNotice("Couldn't start the proxy: " + err.message); console.error(err); });
