import test from "node:test";
import assert from "node:assert/strict";
import { isStale, checkBuild } from "../src/filters.js";

const DAY = 864e5, now = Date.parse("2026-11-22T00:00:00Z");

test("lists go stale after the age limit", () => {
  assert.equal(isStale({ built: "2026-11-20" }, 7, now), false);
  assert.equal(isStale({ built: "2026-11-15" }, 7, now), true);
  assert.equal(isStale({ built: "2026-11-15" }, 10, now), false);
  for (const bad of [null, {}, { built: "soon" }]) assert.equal(isStale(bad, 7, now), true);
  assert.ok(DAY > 0);
});

test("a new build must look sane before it replaces the old one", () => {
  const prev = { network: 120000, cosmetic: 30000 };
  assert.equal(checkBuild({ network: 125000, cosmetic: 31000 }, prev), "");
  assert.equal(checkBuild({ network: 125000, cosmetic: 31000 }, null), "");
  assert.match(checkBuild({ network: 500, cosmetic: 10 }, prev), /only 500/);
  assert.match(checkBuild({ network: 50000, cosmetic: 31000 }, prev), /far fewer rules/);
  assert.match(checkBuild({ network: 125000, cosmetic: 5000 }, prev), /far fewer page rules/);
  assert.match(checkBuild(null, prev), /no rule counts/);
  assert.match(checkBuild({ network: NaN, cosmetic: 1 }, prev), /no rule counts/);
});
