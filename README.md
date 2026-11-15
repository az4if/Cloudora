# Skyhop

Skyhop is a tiny browser-in-a-browser: tabs, address bar, back/forward/reload. Pages are fetched
by **your server**, not your device, and rendered with Scramjet.

## Run
    npm install
    npm start          # http://localhost:8080  (set PORT to change)

Service workers need **https** (localhost is exempt), so put it behind a domain + TLS when hosting
(Caddy, Cloudflare, or a host like Render/Railway/Fly/a VPS). Static hosts (GitHub Pages) won't
work: the Wisp tunnel needs a live server.

## Deploying
Skyhop needs a **live server** for the Wisp websocket tunnel. Vercel (and Netlify, GitHub Pages)
can only host the static front end, so use one of these:

**A) All-in-one (easiest):** deploy the whole repo to Render, Railway, Fly.io or a VPS.
Build: `npm install`, start: `npm start` (no framework needed, plain Node). Done, `public/config.js` stays as is.

**B) Split:** keep the UI on Vercel and run the server elsewhere.
1. Deploy this repo to Render/Railway/Fly as in (A). Its URL is your tunnel.
2. Edit `public/config.js`: `window.SKYHOP = { wisp: "wss://YOUR-SERVER/wisp/" };`
3. Vercel picks up `vercel.json` (runs `npm run build`, serves `public/`).

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
