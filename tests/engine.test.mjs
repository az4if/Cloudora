// node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
await import("../public/adblock/engine.js");
const B = globalThis.CloudoraBlock, dir = new URL("../public/adblock/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir)));
const net = new B.Net(read("net.json"), read("res.json"));
const cos = new B.Cosmetic(read("cosmetic.json"));

test("blocks well-known ad and tracker requests", () => {
  for (const [u, t] of [
    ["https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", "script"],
    ["https://www.google-analytics.com/analytics.js", "script"],
    ["https://securepubads.g.doubleclick.net/tag/js/gpt.js", "script"],
    ["https://connect.facebook.net/en_US/fbevents.js", "script"],
    ["https://static.hotjar.com/c/hotjar-1.js", "script"],
  ]) assert.ok(net.match(u, t, "example.com"), u);
});
test("leaves normal sites alone", () => {
  for (const [u, t, d] of [
    ["https://example.com/static/app.js", "script", "example.com"],
    ["https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js", "script", "example.com"],
    ["https://fonts.googleapis.com/css?family=Roboto", "stylesheet", "example.com"],
    ["https://www.wikipedia.org/", "document", ""],
    ["https://github.com/user/repo", "document", ""],
  ]) assert.equal(net.match(u, t, d), null, u);
});
test("domain helpers", () => {
  assert.equal(B.regDomain("a.b.example.co.uk"), "example.co.uk");
  assert.equal(B.regDomain("www.example.com"), "example.com");
  assert.ok(B.domMatch("sub.example.com", ["example.com"]));
  assert.ok(!B.domMatch("notexample.com", ["example.com"]));
});
test("cosmetic rules resolve per host", () => {
  const r = cos.forHost("www.youtube.com");
  assert.ok(r.css.length > 0 || r.calls.length > 0);
});
test("matching is fast", () => {
  const t0 = performance.now();
  for (let i = 0; i < 5000; i++) net.match("https://example.com/a/b/c.js?x=" + i, "script", "example.com");
  assert.ok(performance.now() - t0 < 1500);
});
