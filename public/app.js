"use strict";
const SEARCH = "https://duckduckgo.com/?q=%s";
const $ = (id) => document.getElementById(id);
const tabsEl = $("tabs"), viewsEl = $("views"), address = $("address"), status = $("status");

const tabs = [];
let active = null, scramjet, ready = false;

function toUrl(input) {
  input = input.trim();
  if (!input) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input;
  if (/^[^\s]+\.[^\s]{2,}$/.test(input) || /^localhost(:\d+)?/.test(input)) return "https://" + input;
  return SEARCH.replace("%s", encodeURIComponent(input));
}

async function boot() {
  if (!navigator.serviceWorker) throw new Error("Service workers need https (or localhost).");
  await navigator.serviceWorker.register("/sw.js");
  const { ScramjetController } = $scramjetLoadController();
  scramjet = new ScramjetController({
    files: { wasm: "/scram/scramjet.wasm.wasm", all: "/scram/scramjet.all.js", sync: "/scram/scramjet.sync.js" },
  });
  await scramjet.init();
  const conn = new BareMux.BareMuxConnection("/baremux/worker.js");
  const wisp = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/";
  if ((await conn.getTransport()) !== "/libcurl/index.mjs")
    await conn.setTransport("/libcurl/index.mjs", [{ websocket: wisp }]);
  ready = true;
  status.textContent = "";
  newTab();
}

function newTab(url) {
  const frame = scramjet.createFrame();
  frame.frame.className = "";
  viewsEl.appendChild(frame.frame);
  const el = document.createElement("div");
  el.className = "tab";
  el.innerHTML = '<span>New tab</span><button class="x" title="Close">&times;</button>';
  tabsEl.insertBefore(el, $("new-tab"));
  const tab = { frame, el, title: el.querySelector("span") };
  tabs.push(tab);
  el.addEventListener("click", () => select(tab));
  el.querySelector(".x").addEventListener("click", (e) => { e.stopPropagation(); close(tab); });
  frame.addEventListener("urlchange", (e) => {
    tab.title.textContent = new URL(e.url).hostname || e.url;
    if (tab === active) address.value = e.url;
  });
  select(tab);
  if (url) frame.go(url); else address.focus();
}

function select(tab) {
  active = tab;
  for (const t of tabs) {
    t.el.classList.toggle("active", t === tab);
    t.frame.frame.classList.toggle("active", t === tab);
  }
  address.value = tab.frame.frame.src ? tab.frame.url.href : "";
}

function close(tab) {
  const i = tabs.indexOf(tab);
  tabs.splice(i, 1);
  tab.el.remove(); tab.frame.frame.remove();
  if (!tabs.length) newTab(); else if (tab === active) select(tabs[Math.max(0, i - 1)]);
}

$("bar").addEventListener("submit", (e) => {
  e.preventDefault();
  const url = toUrl(address.value);
  if (url && ready && active) active.frame.go(url);
});
$("back").onclick = () => active?.frame.back();
$("forward").onclick = () => active?.frame.forward();
$("reload").onclick = () => active?.frame.reload();
$("new-tab").onclick = () => ready && newTab();

boot().catch((err) => { status.textContent = "Failed to start: " + err.message; console.error(err); });
