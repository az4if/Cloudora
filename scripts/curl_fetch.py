#!/usr/bin/env python3
"""One-shot HTTP fetch with a real browser TLS/HTTP2 fingerprint (curl_cffi).

Used by src/upstream.js as a fallback when a plain Node fetch is blocked by a
bot filter (403 / 429 / 503 / "Just a moment..."). Reads one JSON request on
stdin, writes one JSON response on stdout:

  in : {"url", "method", "headers", "body_b64", "timeout", "impersonate"}
  out: {"status", "url", "headers", "body_b64"}   (or {"error": "..."})

Install:  pip install curl_cffi
Docs:     https://curl-cffi.readthedocs.io/
"""
import base64
import json
import sys


def main() -> None:
    try:
        from curl_cffi import requests
    except ImportError:
        print(json.dumps({"error": "curl_cffi is not installed (pip install curl_cffi)"}))
        return

    req = json.load(sys.stdin)
    url = req.get("url", "")
    if not url.startswith(("http://", "https://")):
        print(json.dumps({"error": "only http(s) URLs are allowed"}))
        return

    headers = {k: v for k, v in (req.get("headers") or {}).items() if k.lower() != "user-agent"}
    body = base64.b64decode(req["body_b64"]) if req.get("body_b64") else None

    try:
        # impersonate= makes curl_cffi send Chrome's TLS (JA3/JA4) + HTTP/2 fingerprint and
        # its matching default User-Agent / sec-ch-ua headers, which is what bot filters check.
        r = requests.request(
            req.get("method", "GET"),
            url,
            headers=headers,
            data=body,
            impersonate=req.get("impersonate") or "chrome",
            timeout=req.get("timeout", 15),
            allow_redirects=True,
            max_redirects=5,
        )
    except Exception as exc:  # network / TLS / timeout
        print(json.dumps({"error": f"{type(exc).__name__}: {exc}"}))
        return

    print(json.dumps({
        "status": r.status_code,
        "url": str(r.url),
        "headers": {k.lower(): v for k, v in r.headers.items()},
        "body_b64": base64.b64encode(r.content).decode("ascii"),
    }))


if __name__ == "__main__":
    main()
