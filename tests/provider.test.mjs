import test from "node:test";
import assert from "node:assert/strict";
import {
  availableVideoServers,
  buildVideoServerUrl,
  VIDEO_SERVERS,
} from "../provider.js";

test("embed provider names are unique and alphanumeric", () => {
  const names = VIDEO_SERVERS.map((server) => server.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.every((name) => /^[a-z0-9]+$/.test(name)));
});

test("builds AniList and MAL embed URLs", () => {
  assert.equal(
    buildVideoServerUrl(VIDEO_SERVERS.find((server) => server.name === "megm"), {
      mal: 5114,
      ep: 12,
      lang: "sub",
    }),
    "https://megaplay.buzz/stream/mal/5114/12/sub",
  );
  assert.equal(
    buildVideoServerUrl(VIDEO_SERVERS.find((server) => server.name === "pmha"), {
      ani: 16498,
      ep: 5,
      lang: "dub",
    }),
    "https://ani.pm/embed/ani/16498/5/dub?hardsub=1",
  );
});

test("filters embeds by available anime IDs", () => {
  assert.ok(availableVideoServers({ mal: 5114 }).every(
    (server) => server.url.includes("{mal}") || !server.url.includes("{ani}")
  ));
  assert.ok(availableVideoServers({ ani: 16498 }).every(
    (server) => server.url.includes("{ani}") || !server.url.includes("{mal}")
  ));
});
