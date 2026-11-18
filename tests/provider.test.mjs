import test from "node:test";
import assert from "node:assert/strict";
import {
  availableVideoServers,
  buildMangaServerUrl,
  buildVideoServerUrl,
  describeVideoServer,
  MANGA_SERVERS,
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

test("manga provider names are unique", () => {
  const names = MANGA_SERVERS.map((server) => server.name);
  assert.equal(new Set(names).size, names.length);
});

test("builds MangaDex and search provider URLs", () => {
  assert.equal(
    buildMangaServerUrl(MANGA_SERVERS.find((server) => server.name === "MangaDex"), {
      id: "1234abcd",
      title: "Test Manga",
    }),
    "https://mangadex.org/title/1234abcd",
  );
  assert.equal(
    buildMangaServerUrl(MANGA_SERVERS.find((server) => server.name === "Comick"), {
      title: "Test Manga",
    }),
    "https://comick.io/search?q=Test%20Manga",
  );
});

test("every embed server gets a readable menu label", () => {
  for (const server of VIDEO_SERVERS) {
    const d = describeVideoServer(server);
    assert.match(d.title, /^[A-Z0-9]/);
    assert.match(d.sub, /^(AniList|MAL)/);
  }
  assert.deepEqual(describeVideoServer(VIDEO_SERVERS.find((s) => s.name === "pmha")), { title: "Ani.pm", sub: "AniList · hardsub" });
});
