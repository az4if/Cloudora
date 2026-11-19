import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const pub = (p) => new URL("../public" + p, import.meta.url);
const manifest = JSON.parse(readFileSync(pub("/site.webmanifest"), "utf8"));

test("manifest has what browsers need to offer install", () => {
  for (const k of ["id", "name", "short_name", "start_url", "scope", "display", "background_color", "theme_color"]) assert.ok(manifest[k], k);
  assert.ok(manifest.icons.some((i) => i.sizes === "192x192" && i.purpose === "any"));
  assert.ok(manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "any"));
  assert.ok(manifest.icons.some((i) => i.purpose === "maskable"));
});

test("every file the manifest points at exists", () => {
  const files = [...manifest.icons, ...manifest.screenshots, ...manifest.shortcuts.flatMap((s) => s.icons || [])].map((i) => i.src);
  for (const f of files) assert.ok(existsSync(pub(f)), f);
});

test("service worker only precaches files that exist", () => {
  const sw = readFileSync(pub("/sw.js"), "utf8");
  const list = JSON.parse("[" + /const SHELL = \[([\s\S]*?)\];/.exec(sw)[1] + "]");
  assert.ok(list.includes("/") && list.includes("/app.js"));
  for (const f of list) assert.ok(f === "/" || existsSync(pub(f)), f);
});
