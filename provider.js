export const VIDEO_SERVERS = [
  { name: "megm", url: "https://megaplay.buzz/stream/mal/{mal}/{ep}/{lang}" },
  { name: "mega", url: "https://megaplay.buzz/stream/ani/{ani}/{ep}/{lang}" },
  { name: "pmha", url: "https://ani.pm/embed/ani/{ani}/{ep}/{lang}?hardsub=1" },
  { name: "pmhm", url: "https://ani.pm/embed/mal/{mal}/{ep}/{lang}?hardsub=1" },
  { name: "pma", url: "https://ani.pm/embed/ani/{ani}/{ep}/{lang}" },
  { name: "pmm", url: "https://ani.pm/embed/mal/{mal}/{ep}/{lang}" },
  { name: "vidm", url: "https://megavid.buzz/mal/{mal}/{ep}/{lang}?color=%2322d3a5" },
  { name: "vida", url: "https://megavid.buzz/ani/{ani}/{ep}/{lang}?color=%2322d3a5" },
  { name: "prom", url: "https://vidlink.pro/anime/{mal}/{ep}/{lang}" },
  { name: "profallm", url: "https://vidlink.pro/anime/{mal}/{ep}/{lang}?fallback=true" },
  { name: "nesta", url: "https://vidnest.fun/anime/{ani}/{ep}/{lang}" },
  { name: "pahea", url: "https://vidnest.fun/animepahe/{ani}/{ep}/{lang}" },
  { name: "uscca", url: "https://tryembed.us.cc/embed/anime/{ani}/{ep}/{lang}" },
  { name: "easym", url: "https://player.videasy.net/anime/{mal}/{ep}?color=10B981&overlay=true" },
  { name: "zokoa", url: "https://zokoanime.video/stream/ani/{ani}/{ep}/{lang}" },
  { name: "zokom", url: "https://zokoanime.video/stream/mal/{mal}/{ep}/{lang}" },
  { name: "animoa", url: "https://cdn.4animo.xyz/embed/ani/{ani}/{ep}/{lang}?k=1" },
  { name: "animom", url: "https://cdn.4animo.xyz/embed/mal/{mal}/{ep}/{lang}?k=1" },
  { name: "linka", url: "https://anilink.cc/watch/{ani}/{ep}?variant={lang}" },
  { name: "hawka", url: "https://vidhawk.buzz/embed/ani/{ani}/{ep}/{lang}" },
  { name: "hawkm", url: "https://vidhawk.buzz/embed/mal/{mal}/{ep}/{lang}" },
  { name: "babam", url: "https://babastream.top/embed/{mal}/{ep}/{lang}" },
  { name: "xoa", url: "https://anixo.buzz/embed/ani/{ani}/{ep}?track={lang}" },
  { name: "xom", url: "https://anixo.buzz/embed/mal/{mal}/{ep}?track={lang}" },
];

export const MANGA_SERVERS = [
  { name: "MangaDex", url: "https://mangadex.org/title/{id}" },
  { name: "Comick", url: "https://comick.io/search?q={q}" },
  { name: "MangaFire", url: "https://mangafire.to/filter?keyword={q}" },
  { name: "MangaBuddy", url: "https://mangabuddy.com/search/{slug}" },
  { name: "MangaNato", url: "https://www.natomanga.com/search/story/{slug}" },
  { name: "Bato", url: "https://bato.to/search?word={q}" },
  { name: "MangaPark", url: "https://mangapark.net/search?word={q}" },
  { name: "Weeb Central", url: "https://weebcentral.com/search?text={q}" },
];

export function buildMangaServerUrl(server, { id, title } = {}) {
  if (!server || typeof server.url !== "string") return "";
  const text = String(title || "").trim();
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const values = {
    id: id ? encodeURIComponent(String(id)) : "",
    q: text ? encodeURIComponent(text) : "",
    slug: slug ? encodeURIComponent(slug) : "",
  };
  if ((server.url.includes("{id}") && !values.id) ||
      (server.url.includes("{q}") && !values.q) ||
      (server.url.includes("{slug}") && !values.slug)) return "";
  return server.url.replace(/\{(id|q|slug)\}/g, (_match, key) => values[key] ?? "");
}

export function buildVideoServerUrl(server, { ani, mal, ep, lang }) {
  if (!server || typeof server.url !== "string") return "";
  const values = {
    ani: ani ? encodeURIComponent(String(ani)) : "",
    mal: mal ? encodeURIComponent(String(mal)) : "",
    ep: ep ? encodeURIComponent(String(ep)) : "",
    lang: lang ? encodeURIComponent(String(lang)) : "",
  };
  return server.url.replace(/\{(ani|mal|ep|lang)\}/g, (_match, key) => values[key] ?? "");
}

export function availableVideoServers({ ani, mal } = {}) {
  const aniId = Number(ani) > 0;
  const malId = Number(mal) > 0;
  return VIDEO_SERVERS.filter((server) => {
    if (server.url.includes("{ani}") && !server.url.includes("{mal}")) return aniId;
    if (server.url.includes("{mal}") && !server.url.includes("{ani}")) return malId;
    return aniId || malId;
  });
}

export function describeVideoServer(server) {
  const host = new URL(server.url.replace(/\{\w+\}/g, "x")).hostname.replace(/^(www|cdn|player)\./, "");
  const word = host.split(".")[0].length > 3 ? host.split(".")[0] : host;
  const sub = [server.url.includes("{ani}") ? "AniList" : "MAL", /hardsub/.test(server.url) && "hardsub", /fallback/.test(server.url) && "fallback", /animepahe/.test(server.url) && "AnimePahe"].filter(Boolean);
  return { title: word[0].toUpperCase() + word.slice(1), sub: sub.join(" · ") };
}
