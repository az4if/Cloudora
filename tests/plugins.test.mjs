import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// public/plugins.js is a browser script; run it in a bare context and take what it exposes
const ctx = vm.createContext({ globalThis: null, URL, Blob, indexedDB: undefined });
ctx.globalThis = ctx;
vm.runInContext(readFileSync(new URL("../public/plugins.js", import.meta.url), "utf8"), ctx);
const P = ctx.CloudoraPlugins;
const head = (j) => `/* cloudora-plugin\n${typeof j === "string" ? j : JSON.stringify(j)}\n*/\nexport default function(){}`;
const ok = { id: "demo-1", name: "Demo", version: "1.2.3" };

test("accepts a valid manifest and fills defaults", () => {
  const r = P.parseManifest(head(ok));
  assert.equal(r.ok, true);
  assert.deepEqual({ ...r.manifest }, { id: "demo-1", name: "Demo", version: "1.2.3", api: 1, description: "", author: "", homepage: "" });
});

test("rejects files without a manifest, bad JSON and bad fields", () => {
  for (const code of ["", "   ", "export default () => {}", head("{ not json }"), head("[]"), head({ ...ok, id: "Bad Id" }), head({ ...ok, id: "a" }),
    head({ ...ok, name: "" }), head({ ...ok, version: "1.0" }), head({ ...ok, api: 0 }), head({ ...ok, api: 1.5 }), head({ ...ok, homepage: "javascript:alert(1)" }),
    head({ ...ok, description: "x".repeat(241) })]) assert.equal(P.parseManifest(code).ok, false, String(code).slice(0, 60));
});

test("refuses plugins that need a newer API", () => {
  const r = P.parseManifest(head({ ...ok, api: P.API_VERSION + 1 }));
  assert.equal(r.ok, false);
  assert.match(r.error, /Update Cloudora/);
});

test("refuses oversized code and tolerates a BOM", () => {
  assert.equal(P.parseManifest(head(ok) + " ".repeat(P.MAX_CODE)).ok, false);
  assert.equal(P.parseManifest("﻿" + head(ok)).ok, true);
});

test("compares versions numerically", () => {
  assert.equal(P.cmpVersion("1.2.0", "1.10.0"), -1);
  assert.equal(P.cmpVersion("2.0.0", "1.99.99"), 1);
  assert.equal(P.cmpVersion("1.0.0", "1.0.0-beta"), 0);
});

test("store falls back to memory without IndexedDB", async () => {
  await P.store.put({ id: "a", code: "x", installedAt: 2 });
  await P.store.put({ id: "b", code: "y", installedAt: 1 });
  assert.equal(JSON.stringify((await P.store.list()).map((r) => r.id)), '["b","a"]');
  await P.store.remove("a");
  assert.equal(JSON.stringify((await P.store.list()).map((r) => r.id)), '["b"]');
  assert.equal(P.store.persistent, false);
});
