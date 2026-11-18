#!/usr/bin/env python3
"""Long-running HTTP fetcher that looks like a real browser on the wire (curl_cffi).

Started by src/impersonate.js. Node does all policy (who may be fetched, DNS, private-IP blocking) and
talks to this process over a loopback TCP socket with a tiny framed protocol, so this file stays dumb:

  request : [u32 len][JSON {token,url,method,headers,ip,profile,body_len}][body_len bytes]
  response: [u32 len][JSON {status,status_text,headers:{name:[values]}} | {error}][body bytes, streamed, already decoded]

What makes it look like a browser: curl_cffi sends the TLS ClientHello (JA3/JA4), HTTP/2 settings and header
ordering of a real Chrome/Firefox/Safari build. Redirects are NOT followed and cookies are NOT kept: the
proxied page (Scramjet) owns both, exactly as a browser would.
"""
import asyncio
import json
import os
import struct
import sys
import time

from curl_cffi.const import CurlOpt
from curl_cffi.requests import AsyncSession

TOKEN = os.environ.get("CLOUDORA_TOKEN", "")
MAX_SESSIONS = 256
IDLE_SECONDS = 90

# one session per (browser profile, host, pinned ip): connections are reused per host anyway, and baking the
# address into the session (curl RESOLVE) means curl connects to the IP Node already vetted, not to whatever
# DNS says a moment later.
sessions: dict = {}


def get_session(profile: str, host: str, port: int, ip: str) -> dict:
    key = (profile, host, port, ip)
    entry = sessions.get(key)
    if entry is None:
        if len(sessions) >= MAX_SESSIONS:
            evict(force=True)
        addr = f"[{ip}]" if ":" in ip else ip
        entry = sessions[key] = {
            "s": AsyncSession(
                impersonate=profile,
                discard_cookies=True,
                curl_options={CurlOpt.RESOLVE: [f"{host}:{port}:{addr}"]},
            ),
            "busy": 0,
            "used": time.monotonic(),
        }
    entry["used"] = time.monotonic()
    return entry


def evict(force: bool = False) -> None:
    now = time.monotonic()
    for key, entry in list(sessions.items()):
        if entry["busy"] == 0 and (force or now - entry["used"] > IDLE_SECONDS):
            sessions.pop(key, None)
            asyncio.ensure_future(entry["s"].close())
            if force:
                return


async def reaper() -> None:
    while True:
        await asyncio.sleep(30)
        evict()


def frame(obj: dict) -> bytes:
    raw = json.dumps(obj).encode()
    return struct.pack(">I", len(raw)) + raw


async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    entry = resp = None
    try:
        (n,) = struct.unpack(">I", await reader.readexactly(4))
        if n > 1 << 20:
            return
        req = json.loads(await reader.readexactly(n))
        if not TOKEN or req.get("token") != TOKEN:
            return
        body = await reader.readexactly(req["body_len"]) if req.get("body_len") else None

        url = req["url"]
        if not url.startswith(("http://", "https://")):
            writer.write(frame({"error": "only http(s) URLs are allowed"}))
            return
        from urllib.parse import urlsplit

        parts = urlsplit(url)
        port = parts.port or (443 if parts.scheme == "https" else 80)
        headers = {}
        for k, v in (req.get("headers") or {}).items():
            headers[k] = ", ".join(v) if isinstance(v, list) else str(v)

        entry = get_session(req.get("profile") or "chrome", parts.hostname, port, req["ip"])
        entry["busy"] += 1
        try:
            resp = await entry["s"].request(
                req.get("method", "GET"),
                url,
                headers=headers,
                data=body,
                allow_redirects=False,
                stream=True,
                timeout=(15, 60),  # connect, and max stall while streaming
            )
        except Exception as exc:  # DNS / TLS / connect / timeout
            writer.write(frame({"error": f"{type(exc).__name__}: {exc}"[:300]}))
            return

        out: dict = {}
        for name, value in resp.headers.multi_items():
            lname = name.lower()
            # the body we stream is already decoded and de-chunked, so these would lie
            if lname in ("content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"):
                continue
            out.setdefault(lname, []).append(value)
        writer.write(frame({"status": resp.status_code, "status_text": resp.reason or "", "headers": out}))
        await writer.drain()
        async for chunk in resp.aiter_content():
            writer.write(chunk)
            await writer.drain()
    except (asyncio.IncompleteReadError, ConnectionError, json.JSONDecodeError, KeyError):
        pass  # peer went away / bad frame
    finally:
        if resp is not None:
            try:
                await resp.aclose()
            except Exception:
                pass
        if entry is not None:
            entry["busy"] -= 1
        try:
            writer.close()
        except Exception:
            pass


async def main() -> None:
    server = await asyncio.start_server(handle, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    print(f"PORT {port}", flush=True)  # Node reads this line
    asyncio.ensure_future(reaper())
    # exit when Node (our parent) goes away: stdin closes
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, sys.stdin.read)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
