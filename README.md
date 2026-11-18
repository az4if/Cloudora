# Cloudora

Cloudora is a tiny browser-in-a-browser: tabs, address bar, back/forward/reload. Pages are fetched
by **your server**, not your device, and rendered with Scramjet.

## Features
- Tabs, bookmarks (star), cursor-following glow on search bars and cards
- **Themes:** Auto / Light / Dark (true black) modes (sun/moon button in the toolbar), 8 color presets,
  and a color wheel + exact color picker in Settings for any color you like
- **Ad & tracker blocker** (shield button in the toolbar + Settings > Privacy): runs the real
  EasyList, EasyPrivacy and uBlock Origin filter lists (~121k network rules, ~31k element-hiding rules,
  ~10k scriptlet rules). The service worker blocks requests (with uBO-style redirect stubs), injects the
  hiding CSS and scriptlets before the page's own scripts run, and guards against popups that have no
  user click. The shield shows how many requests were blocked on the current page and lets you pause
  blocking per site. Not covered: procedural cosmetic filters (`:has-text`...), HTML filtering, `removeparam`,
  and in-stream video ads (YouTube).
- **Browser:** history (Alt+H), address-bar suggestions (bookmarks, history, live search suggestions), pin /
  duplicate / drag-reorder tabs, reopen closed tab (Alt+Shift+T), restore tabs on start, find in page (Alt+F),
  zoom (Alt +/-/0), Alt+1..9 to switch tabs, Alt+D bookmark, tab right-click menu. Shortcuts also work while a
  page has focus.
- **Anime:** trending, popular, search and details from AniList, official "where to watch" links, and a **built-in player** (HLS/MP4, subtitles, speed, resume, auto-next) when you configure a source API (below)
- **Manga:** browse, search and read in the app using the public MangaDex API. Community translations are labeled **Unofficial**; publisher links and official chapters are labeled **Official**
- Wisp blocks localhost/private IPs by default, so visitors can't reach your server's network.
- The server needs outbound access to graphql.anilist.co, api.mangadex.org and their
  image hosts. Manga page images load straight from MangaDex's servers into the visitor's browser.

## Run
    npm install
    npm start          # http://localhost:8080  (set PORT to change)

Service workers need **https** (localhost is exempt), so put it behind a domain + TLS when hosting
(Caddy, Cloudflare, or a host like Render/Railway/Fly/a VPS). Static hosts (GitHub Pages) won't
work: the Wisp tunnel needs a live server.

## Deploying
Cloudora needs a **live Node server** (for the Wisp websocket tunnel), so static hosts like Vercel,
Netlify and GitHub Pages won't work. Use Render, Railway, Fly.io or a VPS.

On Render: New > Web Service, connect the repo, Build Command `npm install` (or Render's default `yarn install && yarn build`), Start Command `npm start`.
Add your domain under Settings > Custom Domains (https is automatic).
Free instances sleep after ~15 min idle, so the first visit afterward is slow.

## How it works
    your browser ── service worker (Scramjet rewrites pages) ── bare-mux + libcurl
         └── websocket /wisp/ ──> src/index.js (Wisp server) ──> the real website

- `src/index.js`  server: static files + Wisp websocket tunnel
- `public/sw.js`  service worker that intercepts proxied requests
- `public/app.js` browser UI (tabs, navigation, address bar)

## Notes
- Datacenter IPs trigger CAPTCHAs/blocks on Google, YouTube, etc. A home/residential host works better.
- Edit `wisp.options` in `src/index.js` to block hosts or change DNS.
- Credit: Mercury Workshop (Scramjet, bare-mux, libcurl-transport, wisp-js), AGPL/MIT per package.

## Player source API (optional)
The anime player also includes 24 built-in iframe providers. AniList and MAL IDs are supplied automatically by Cloudora.

The built-in player includes the iframe providers above. To add a licensed HLS/MP4 source API, set these environment
variables on your server (e.g. in Render > Environment) to point at an API **you are licensed to use**
(your own media server, a licensed provider, etc.):

    STREAM_API=https://your-api.example.com      # base URL, required
    STREAM_API_KEY=...                           # optional, sent as "Authorization: Bearer ..."

For compatibility with anime-provider deployments, `ANIME_API_URL` and
`ANIME_API_KEY` may be used as aliases for `STREAM_API` and `STREAM_API_KEY`.

Cloudora calls `GET {STREAM_API}/sources?anilist_id=<id>&episode=<n>` and expects:

    { "sources":   [ { "url": "https://.../master.m3u8", "type": "hls",  "label": "1080p" },
                     { "url": "https://.../ep1.mp4",      "type": "mp4",  "label": "720p"  } ],
      "subtitles": [ { "url": "https://.../en.vtt", "lang": "en", "label": "English" } ] }

Each source may include `"official": true` (shows an **Official** badge; the default is **Unofficial**). Set `STREAM_API_OFFICIAL=1` if your whole API is an official one. `type` can also be `"embed"` (opens the URL in a Cloudora tab). Video and subtitle hosts must allow
cross-site playback (CORS). With no `STREAM_API` set, anime pages show official links only.

## Manga provider

Manga search, chapter lists and chapter artwork use the public MangaDex API. The
default is `https://api.mangadex.org`; set `MANGADEX_URL` or `MANGA_API_URL` to
use another compatible MangaDex API deployment. Chapter artwork is downloaded
through Cloudora's same-origin `/api/md-image` relay, subject to MangaDex host
validation.

Manga details include named unofficial external search/source buttons for
MangaDex, Comick, MangaFire, MangaBuddy, MangaNato, Bato, MangaPark and Weeb
Central. These buttons open external sites and are separate from official
publisher/store links.

## Ad-block lists
`adblock-src/` holds the raw lists (taken from uBlock Origin 1.75.0's bundled assets) and
`scripts/build-filters.mjs` compiles them into `public/adblock/` (`net.json`, `cosmetic.json`, `generic.css`,
redirect stubs). Already built; re-run when you change lists:

    npm run build-filters                         # recompile adblock-src/*.txt
    npm run update-filters                        # download fresh copies first (needs internet)
    node scripts/build-filters.mjs --extra=my-rules.txt   # add your own rules (ABP/uBO syntax)

`npm test` runs the engine tests. Filter lists are © their authors (GPLv3 / CC BY-SA).

## Local testing
`CLOUDORA_ALLOW_LOCAL=1 npm start` lets the tunnel reach 127.0.0.1/LAN so you can test against a local page.
Never set it on a public server.
