<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo-white.png">
  <img src="public/logo-black.png" alt="Cloudora" width="84">
</picture>

# Cloudora

**Browse beyond the walls.**
A self-hosted browser in your browser. Pages are fetched by your server and rendered with [Scramjet](https://github.com/MercuryWorkshop/scramjet).

</div>

## Features

- **Browser:** tabs, bookmarks, history, find in page, address-bar suggestions, keyboard shortcuts, editable home shortcuts
- **Ad & tracker blocking:** EasyList, EasyPrivacy and uBlock Origin lists, with a per-site pause
- **Plugins:** optional add-ons each user installs in their own browser (anime, manga, your own). See [PLUGINS.md](PLUGINS.md)
- **Real-browser fetching:** optional Chrome/Firefox/Safari TLS fingerprint via `curl_cffi`
- **Themes & layout:** auto / light / dark, accent presets or any custom colour; toolbar at the top or bottom, optional address bar (phones get a bottom toolbar by default)
- **Installable:** works as a PWA, and the app shell opens offline

## Quick start

```sh
npm install
npm start          # http://localhost:8080
```

Needs Node 22. Service workers require **https** (localhost is exempt), so put it behind a domain with TLS when hosting.
It needs a live Node server for the Wisp tunnel, so static hosts won't work. Render, Railway, Fly.io or a VPS do.

### Optional: real-browser fetching

```sh
pip install -r requirements.txt
```

With Python and `curl_cffi` installed, the server fetches pages with a real browser's TLS and HTTP/2 fingerprint, so fewer sites treat
the proxy as a bot. Without them Cloudora quietly falls back to libcurl.js.

## Configuration

Copy `.env.example` to `.env` and edit it, or set the variables in your host's dashboard. Real environment variables win over `.env`.

| Variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default `8080`) |
| `CLOUDORA_IMPERSONATE=0` | Turn off real-browser fetching |
| `CURL_CFFI=0` | Never use `curl_cffi` for upstream API requests |
| `UPSTREAM_UA` | Override the user agent for server-side requests |
| `CLOUDORA_ALLOW_LOCAL=1` | Let the tunnel reach localhost/LAN. **Local testing only, never on a public server** |

## Plugins

Cloudora ships with no anime, manga or stream servers. Add what you want under **Settings → Plugins** (file, address or pasted code); it stays in that browser, can be switched off or removed any time, and `?noplugins` starts with all of them off.
Plugins run with full access to the app, so only install ones you trust. To write your own, see [PLUGINS.md](PLUGINS.md).

## How it works

```
browser ── service worker (Scramjet) ── bare-mux ──┬─ libcurl.js ── Wisp /wisp/ ──┐
                                                   └─ /api/proxy ── curl_cffi ────┴─> website
```

| Path | Role |
| --- | --- |
| `src/index.js` | Server: static files, Wisp tunnel, API routes |
| `public/sw.js` | Service worker: proxying, ad blocking, offline shell |
| `public/app.js` | Browser UI and plugin host |
| `public/plugins.js` | Plugin manifest parser and storage |

## Development

```sh
npm test                 # unit tests
npm run build-filters    # rebuild the ad-block lists from adblock-src/
```

## Credits

Built on Scramjet, bare-mux, libcurl.js, wisp-js and hls.js by Mercury Workshop and others.
Filter lists are © their authors (GPLv3 / CC BY-SA).
