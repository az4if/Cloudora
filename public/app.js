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
};
const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n]}"/></svg>`;
document.querySelectorAll("[data-ic]").forEach((b) => b.insertAdjacentHTML("afterbegin", ic(b.dataset.ic)));

const el = { app: $("#app"), tabs: $("#tablist"), views: $("#views"), home: $("#home"), addr: $("#address"),
  tiles: $("#tiles"), disc: $("#discover"), notice: $("#notice"), status: $("#status"), star: $("#star") };
let tabs = [], active = null, scramjet = null, ready = false, nextId = 1;
let engine = db.get("engine", "DuckDuckGo");
const prefs = Object.assign({ adblock: true, glow: true, theme: { mode: "dark", palette: "midnight", h: 222, s: 100 } }, db.get("prefs", {}));
if (prefs.theme.mode === "amoled") prefs.theme.mode = "dark"; // AMOLED is now just Dark
const savePrefs = () => db.set("prefs", prefs);
document.documentElement.classList.toggle("noglow", !prefs.glow);
const PAGE_TITLES = { home: "New tab", anime: "Anime", manga: "Manga", watch: "Watch" };
const AD_CSS = 'ins.adsbygoogle,.adsbygoogle,[id^="google_ads"],[id^="div-gpt-ad"],.ad-banner,.ad-container,.ad-slot,.ad-wrapper,.advertisement,.sponsored-ad,.taboola,[id^="taboola"],[class*="outbrain"],iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="adnxs"],iframe[src*="adsystem"],#ad,#ads,.ads{display:none!important}';
function applyCosmetics(frame) {
  try {
    const d = frame.contentDocument; if (!d) return;
    const old = d.getElementById("cloudora-adblock");
    if (!prefs.adblock) return old && old.remove();
    if (old) return;
    const s = d.createElement("style"); s.id = "cloudora-adblock"; s.textContent = AD_CSS;
    (d.head || d.documentElement).appendChild(s);
  } catch {}
}
const syncAdblock = () => navigator.serviceWorker.ready.then((r) => r.active && r.active.postMessage({ cloudora: "adblock", on: prefs.adblock })).catch(() => {});

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
    if (!discKey.startsWith(active.page + "|")) { $("#d-q").value = ""; $("#d-detail").hidden = true; $("#reader").hidden = true; }
    showDiscover(active.page, $("#d-q").value.trim());
  }
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", blank && b.dataset.page === active.page));
  if (document.activeElement !== el.addr) el.addr.value = active.url;
  el.star.classList.toggle("on", !!active.url && bookmarks().some((b) => b.url === active.url));
  document.title = active.url ? active.title + " · Cloudora" : "Cloudora";
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
  else if (e.key === "Escape") { $("#settings").hidden = true; $("#d-detail").hidden = true; $("#reader").hidden = true; }
});

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
  document.querySelectorAll(".switch").forEach((b) => { b.classList.toggle("on", prefs[b.dataset.k]); b.setAttribute("aria-checked", prefs[b.dataset.k]); });
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

// Discover pages. Anime: AniList. Manga: MangaDex (read here). Watch: free films on the Internet Archive.
const FIELDS = "id title{romaji english} coverImage{large} averageScore format episodes chapters";
const LIST = `query($t:MediaType,$s:[MediaSort],$q:String){Page(perPage:20){media(type:$t,sort:$s,search:$q,isAdult:false){${FIELDS}}}}`;
const ONE = `query($id:Int){Media(id:$id){${FIELDS} type description genres siteUrl externalLinks{url site type}}}`;
async function gql(query, variables) {
  const r = await fetch("/api/anilist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (!j.data) throw new Error((j.errors && j.errors[0].message) || "AniList error");
  return j.data;
}
const img = (u) => `/img?u=${encodeURIComponent(u)}`;
const mname = (m) => m.title.english || m.title.romaji;
const mmeta = (m) => [m.averageScore && "★ " + m.averageScore, m.format && m.format.replace("_", " "), m.episodes ? m.episodes + " eps" : m.chapters ? m.chapters + " ch" : ""].filter(Boolean).join(" · ");
const card = (m) => `<div class="mcard glow" data-id="${m.id}"><img loading="lazy" alt="" src="${img(m.coverImage.large)}"><b>${esc(mname(m))}</b><small>${esc(mmeta(m))}</small></div>`;
const rowsHtml = (rows, data, render) => rows.map(([h], i) => `<h3>${h}</h3><div class="grid">${render(data[i]).join("") || '<p class="muted">Nothing found.</p>'}</div>`).join("");

const loaders = {
  async anime(q, key) {
    const rows = q ? [["Results", { s: ["SEARCH_MATCH"], q }]] : [["Trending now", { s: ["TRENDING_DESC"] }], ["Most popular", { s: ["POPULARITY_DESC"] }]];
    const data = await Promise.all(rows.map(([, v]) => gql(LIST, { t: "ANIME", ...v })));
    if (key === discKey) $("#d-body").innerHTML = rowsHtml(rows, data, (d) => d.Page.media.map(card));
  },
  async manga(q, key) {
    const rows = q ? [["Results", `/manga?limit=24&title=${encodeURIComponent(q)}&order[relevance]=desc${MDQ}`]]
      : [["Most followed", `/manga?limit=24&order[followedCount]=desc${MDQ}`], ["Recently updated", `/manga?limit=24&order[latestUploadedChapter]=desc${MDQ}`]];
    const data = await Promise.all(rows.map(([, p]) => md(p)));
    if (key === discKey) $("#d-body").innerHTML = rowsHtml(rows, data, (d) => d.data.map(mcard));
  },
  async watch(q, key) {
    const j = await (await fetch("/api/archive?q=" + encodeURIComponent(q))).json();
    if (key !== discKey) return;
    const docs = (j.response && j.response.docs) || [];
    $("#d-body").innerHTML = '<p class="muted">Free public-domain movies, classic cartoons and TV from the Internet Archive.</p><div class="grid">' +
      (docs.map((d) => `<div class="mcard glow" data-id="${esc(d.identifier)}"><img loading="lazy" alt="" src="${img("https://archive.org/services/img/" + d.identifier)}"><b>${esc(String(d.title))}</b><small>${esc(String(d.year || ""))}</small></div>`).join("") || '<p class="muted">Nothing found.</p>') + "</div>";
  },
};
let discKey = "";
async function showDiscover(page, q = "") {
  const key = page + "|" + q;
  if (key === discKey) return;
  discKey = key;
  $("#d-title").textContent = PAGE_TITLES[page]; $("#d-q").placeholder = "Search " + PAGE_TITLES[page].toLowerCase() + "…";
  $("#d-body").innerHTML = '<p class="muted">Loading…</p>';
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
async function mangaDetail(id) {
  const d = $("#d-detail"), m = mItems.get(id);
  if (!m) return;
  const tags = m.attributes.tags.slice(0, 8).map((t) => `<span class="chip">${esc(t.attributes.name.en || "")}</span>`).join("");
  const desc = (m.attributes.description.en || "No description.").replace(/\[[^\]]*\]|[*_>`#]/g, "").slice(0, 700);
  d.hidden = false;
  d.innerHTML = `<div class="dcard">${closeBtn()}<img alt="" src="${mCover(m)}"><div><h2>${esc(mTitle(m))}</h2><small>${esc([m.attributes.status, m.attributes.year].filter(Boolean).join(" · "))}</small>
    <div class="chips" style="margin-top:8px">${tags}</div><p class="desc">${esc(desc)}</p><h4>Chapters</h4><div class="chlist" id="chs"><p class="muted">Loading…</p></div>
    <h4>Source</h4><div class="chips"><button class="chip" data-open="https://mangadex.org/title/${m.id}">Open on MangaDex</button></div></div></div>`;
  try {
    const f = await md(`/manga/${id}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc&includeExternalUrl=0&contentRating[]=safe&contentRating[]=suggestive`);
    const seen = new Set();
    const chapters = f.data.filter((c) => !c.attributes.externalUrl && c.attributes.pages > 0 && !seen.has(c.attributes.chapter) && seen.add(c.attributes.chapter)).reverse();
    reading = { m, chapters };
    $("#chs").innerHTML = chapters.length ? chapters.map((c, i) => `<button class="chip" data-ch="${i}">${esc(chLabel(c))}</button>`).reverse().join("") : '<p class="muted">No English chapters hosted on MangaDex.</p>';
  } catch (err) { $("#chs").innerHTML = `<p class="muted">Couldn't load chapters (${esc(err.message)}).</p>`; }
}
async function openChapter(i) {
  const { m, chapters } = reading, c = chapters[i], rd = $("#reader");
  $("#d-detail").hidden = true; rd.hidden = false; rd.scrollTop = 0;
  rd.innerHTML = `<div class="rhead"><button class="ghost" id="r-close">${ic("close")}</button><b>${esc(mTitle(m))} · ${esc(chLabel(c))}</b>
    <button class="btn" data-rn="${i - 1}" ${i < 1 ? "disabled" : ""}>‹ Prev</button><button class="btn" data-rn="${i + 1}" ${i >= chapters.length - 1 ? "disabled" : ""}>Next ›</button></div><div class="rpages"><p class="muted">Loading pages…</p></div>`;
  try {
    const s = await md(`/at-home/server/${c.id}`);
    $("#reader .rpages").innerHTML = s.chapter.data.map((f) => `<img crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" alt="Loading…" src="${esc(`${s.baseUrl}/data/${s.chapter.hash}/${f}`)}">`).join("") +
      `<p class="muted">Pages not showing? <button class="chip" data-open="https://mangadex.org/chapter/${c.id}">Open this chapter on MangaDex</button><br>Manga from MangaDex. Please support the creators.</p>`;
  } catch (err) { $("#reader .rpages").innerHTML = `<p class="muted">Couldn't load this chapter (${esc(err.message)}).</p>`; }
}

// Anime detail (AniList + official links)
async function animeDetail(id) {
  const d = $("#d-detail");
  d.hidden = false; d.innerHTML = `<div class="dcard">${closeBtn()}<p class="muted">Loading…</p></div>`;
  try {
    const m = (await gql(ONE, { id })).Media;
    const desc = (m.description || "No description.").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    const seen = new Set();
    const links = [...(m.externalLinks || []), { url: m.siteUrl, site: "AniList", type: "INFO" }]
      .filter((l) => l.url && /^https?:\/\//.test(l.url) && l.type !== "SOCIAL" && !seen.has(l.site) && seen.add(l.site)).slice(0, 9);
    d.innerHTML = `<div class="dcard">${closeBtn()}<img alt="" src="${img(m.coverImage.large)}"><div>
      <h2>${esc(mname(m))}</h2><small>${esc(mmeta(m))}</small>
      <div class="chips" style="margin-top:8px">${(m.genres || []).map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div>
      <p class="desc">${esc(desc)}</p><h4>Where to watch</h4>
      <div class="chips">${links.map((l) => `<button class="chip" data-open="${esc(l.url)}">${esc(l.site)}</button>`).join("")}</div></div></div>`;
  } catch (err) { d.innerHTML = `<div class="dcard">${closeBtn()}<p class="muted">Couldn't load details (${esc(err.message)}).</p></div>`; }
}

el.disc.addEventListener("click", (e) => {
  const t = e.target, d = $("#d-detail");
  const open = t.closest("[data-open]"); if (open) { d.hidden = true; return newTab(open.dataset.open); }
  if (t.closest("#r-close")) { $("#reader").hidden = true; return; }
  const rn = t.closest("[data-rn]"); if (rn) return rn.disabled || openChapter(+rn.dataset.rn);
  const ch = t.closest("[data-ch]"); if (ch) return openChapter(+ch.dataset.ch);
  if (t.closest(".dx") || t === d) { d.hidden = true; return; }
  const c = t.closest(".mcard"); if (!c) return;
  if (active.page === "manga") return mangaDetail(c.dataset.id);
  if (active.page === "watch") return newTab("https://archive.org/embed/" + encodeURIComponent(c.dataset.id));
  animeDetail(+c.dataset.id);
});
function openPage(p) {
  if (!active.url) { active.page = p; active.title = PAGE_TITLES[p]; render(); } else newTab(null, p);
}
document.querySelectorAll("#nav button").forEach((b) => (b.onclick = () => openPage(b.dataset.page)));

applyTheme();
if (matchMedia("(max-width:720px)").matches) el.app.classList.add("collapsed");
newTab();
boot().catch((err) => { el.status.textContent = "Offline"; showNotice("Couldn't start the proxy: " + err.message); console.error(err); });
