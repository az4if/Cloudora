# Skyhop

Skyhop is a tiny browser-in-a-browser: tabs, address bar, back/forward/reload. Pages are fetched
by **your server**, not your device, and rendered with Scramjet.

## Features
- Tabs, bookmarks (star button), 4 themes, search engine picker, cursor-following glow
- **Ad & tracker blocker** (Settings > Privacy): the service worker blocks known ad/tracker
  domains (list in `public/sw.js`, add your own) and hides common ad boxes. It is lighter than
  uBlock Origin and will not remove in-stream video ads (e.g. YouTube).
- **Anime / Manga** pages: trending, popular, search and details from AniList, with links to
  official streaming/reading sites that open in a Skyhop tab. Needs the server to reach
  graphql.anilist.co and *.anilist.co (covers are fetched through `/img`).
- Wisp blocks localhost/private IPs by default, so visitors can't reach your server's network.

## Run
    npm install
    npm start          # http://localhost:8080  (set PORT to change)

Service workers need **https** (localhost is exempt), so put it behind a domain + TLS when hosting
(Caddy, Cloudflare, or a host like Render/Railway/Fly/a VPS). Static hosts (GitHub Pages) won't
work: the Wisp tunnel needs a live server.

## Deploying
Skyhop needs a **live Node server** (for the Wisp websocket tunnel), so static hosts like Vercel,
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
