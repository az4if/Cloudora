"use strict";
// Plugin store + loader. Plugins are single ES-module files kept in this browser's IndexedDB.
//
// Every plugin starts with a manifest comment (read as plain text, so nothing runs until the user confirms):
//
//   /* cloudora-plugin
//   { "id": "hello", "name": "Hello", "version": "1.0.0", "description": "Says hi.", "api": 1 }
//   */
//   export default function register(api) { ... }
//
// See PLUGINS.md for the API. This file has no dependency on the app, so it can be unit tested in Node.
(() => {
  const API_VERSION = 2;
  const MAX_CODE = 1.5 * 1024 * 1024;
  const ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;
  const VER_RE = /^\d+\.\d+\.\d+([-+][\w.-]+)?$/;

  // Read + validate the manifest without executing the code.
  function parseManifest(code) {
    if (typeof code !== "string" || !code.trim()) return { ok: false, error: "The file is empty." };
    if (code.length > MAX_CODE) return { ok: false, error: "The plugin is larger than 1.5 MB." };
    const m = /^﻿?\s*\/\*!?\s*cloudora-plugin\s*(\{[\s\S]*?\})\s*\*\//.exec(code);
    if (!m) return { ok: false, error: "Not a Cloudora plugin: the file must start with a /* cloudora-plugin { … } */ manifest." };
    let j;
    try { j = JSON.parse(m[1]); } catch { return { ok: false, error: "The plugin manifest isn't valid JSON." }; }
    if (!j || typeof j !== "object" || Array.isArray(j)) return { ok: false, error: "The plugin manifest must be an object." };
    if (typeof j.id !== "string" || !ID_RE.test(j.id)) return { ok: false, error: 'Manifest "id" must be 2-32 characters: lowercase letters, digits and dashes.' };
    if (typeof j.name !== "string" || !j.name.trim() || j.name.length > 40) return { ok: false, error: 'Manifest "name" is required (40 characters max).' };
    if (typeof j.version !== "string" || !VER_RE.test(j.version)) return { ok: false, error: 'Manifest "version" must look like 1.0.0.' };
    const api = j.api === undefined ? 1 : j.api;
    if (!Number.isInteger(api) || api < 1) return { ok: false, error: 'Manifest "api" must be a whole number.' };
    if (api > API_VERSION) return { ok: false, error: `This plugin needs plugin API ${api}; this Cloudora supports ${API_VERSION}. Update Cloudora.` };
    if (j.description !== undefined && (typeof j.description !== "string" || j.description.length > 240)) return { ok: false, error: 'Manifest "description" must be text (240 characters max).' };
    if (j.author !== undefined && (typeof j.author !== "string" || j.author.length > 60)) return { ok: false, error: 'Manifest "author" must be text (60 characters max).' };
    if (j.homepage !== undefined && !/^https?:\/\/\S+$/.test(String(j.homepage))) return { ok: false, error: 'Manifest "homepage" must be an http(s) address.' };
    return { ok: true, manifest: { id: j.id, name: j.name.trim(), version: j.version, api, description: j.description || "", author: j.author || "", homepage: j.homepage || "" } };
  }

  // "1.2.0" > "1.10.0"? compare numerically
  function cmpVersion(a, b) {
    const x = String(a).split(/[-+]/)[0].split(".").map(Number), y = String(b).split(/[-+]/)[0].split(".").map(Number);
    for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1;
    return 0;
  }

  // ---- storage: IndexedDB, with an in-memory fallback (private windows / blocked storage) ----
  const mem = new Map();
  let dbp = null, useMem = false;
  function open() {
    return (dbp ||= new Promise((resolve, reject) => {
      try {
        const o = indexedDB.open("cloudora-plugins", 1);
        o.onupgradeneeded = () => o.result.createObjectStore("plugins", { keyPath: "id" });
        o.onsuccess = () => resolve(o.result);
        o.onerror = () => reject(o.error);
        o.onblocked = () => reject(new Error("blocked"));
      } catch (e) { reject(e); }
    }).catch(() => { useMem = true; return null; }));
  }
  // run one request inside a transaction and resolve with its result
  const idb = (db, mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction("plugins", mode), r = fn(t.objectStore("plugins"));
    t.oncomplete = () => resolve(r.result);
    t.onerror = t.onabort = () => reject(t.error);
  });
  const store = {
    get persistent() { return !useMem; },
    async list() {
      const db = await open();
      const rows = db ? await idb(db, "readonly", (s) => s.getAll()) : [...mem.values()];
      return rows.sort((a, b) => (a.installedAt || 0) - (b.installedAt || 0));
    },
    async put(row) { const db = await open(); if (db) await idb(db, "readwrite", (s) => s.put(row)); else mem.set(row.id, row); },
    async remove(id) { const db = await open(); if (db) await idb(db, "readwrite", (s) => s.delete(id)); else mem.delete(id); },
  };

  // Run a plugin: import the code as a module and call its default export with the API.
  async function run(row, api, timeoutMs = 10000) {
    const url = URL.createObjectURL(new Blob([row.code], { type: "text/javascript" }));
    try {
      const mod = await import(/* @vite-ignore */ url);
      const fn = typeof mod.default === "function" ? mod.default : mod.register;
      if (typeof fn !== "function") throw new Error("The plugin has no default export function.");
      let timer;
      await Promise.race([
        Promise.resolve(fn(api)),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("The plugin took too long to start.")), timeoutMs); }),
      ]).finally(() => clearTimeout(timer));
    } finally { URL.revokeObjectURL(url); }
  }

  globalThis.CloudoraPlugins = { API_VERSION, MAX_CODE, parseManifest, cmpVersion, store, run };
})();
