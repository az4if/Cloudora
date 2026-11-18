"use strict";
window.CloudoraVideoProviders = (() => {
  const servers = [
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

  function build(server, ids) {
    if (!server) return "";
    const values = {
      ani: ids.anilist ? encodeURIComponent(String(ids.anilist)) : "",
      mal: ids.mal ? encodeURIComponent(String(ids.mal)) : "",
      ep: ids.ep ? encodeURIComponent(String(ids.ep)) : "",
      lang: ids.lang ? encodeURIComponent(String(ids.lang)) : "",
    };
    if (
      (server.url.includes("{ani}") && !values.ani) ||
      (server.url.includes("{mal}") && !values.mal)
    ) return "";
    return server.url.replace(/\{(ani|mal|ep|lang)\}/g, (_match, key) => values[key] ?? "");
  }

  function available(ids) {
    return servers.filter((server) => build(server, ids));
  }

  return { servers, build, available };
})();
