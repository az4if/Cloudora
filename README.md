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
- **Anime:** browse and search AniList, with a built-in embed player (batched episodes, server list)
- **Manga:** opens [atsu.moe](https://atsu.moe/) in a tab
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

| Variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default `8080`) |
| `STREAM_API`, `STREAM_API_KEY` | Add a direct HLS/MP4 source API you are licensed to use |
| `CLOUDORA_IMPERSONATE=0` | Turn off real-browser fetching |
| `CURL_CFFI=0` | Never use `curl_cffi` for upstream API requests |
| `UPSTREAM_UA` | Override the user agent for server-side requests |
| `CLOUDORA_ALLOW_LOCAL=1` | Let the tunnel reach localhost/LAN. **Local testing only, never on a public server** |

<details>
<summary>Source API format</summary>

Cloudora calls `GET {STREAM_API}/sources?anilist_id=<id>&episode=<n>` and expects:

```json
{
  "sources": [
    { "url": "https://.../master.m3u8", "type": "hls", "label": "1080p" },
    { "url": "https://.../ep1.mp4", "type": "mp4", "label": "720p" }
  ],
  "subtitles": [{ "url": "https://.../en.vtt", "lang": "en", "label": "English" }]
}
```

Add `"official": true` to a source for an **Official** badge, or set `STREAM_API_OFFICIAL=1` for the whole API.
Video and subtitle hosts must allow cross-site playback (CORS).

</details>

## How it works

```
browser ── service worker (Scramjet) ── bare-mux ──┬─ libcurl.js ── Wisp /wisp/ ──┐
                                                   └─ /api/proxy ── curl_cffi ────┴─> website
```

| Path | Role |
| --- | --- |
| `src/index.js` | Server: static files, Wisp tunnel, API routes |
| `public/sw.js` | Service worker: proxying, ad blocking, offline shell |
| `public/app.js` | Browser UI |

## Development

```sh
npm test                 # unit tests
npm run build-filters    # rebuild the ad-block lists from adblock-src/
```

## Credits

Built on Scramjet, bare-mux, libcurl.js, wisp-js and hls.js by Mercury Workshop and others. Anime data from AniList.
Filter lists are © their authors (GPLv3 / CC BY-SA).
