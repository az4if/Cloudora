// bare-mux transport: HTTP requests are made by the Cloudora server through curl_cffi, so the target site sees a real
// Chrome/Firefox/Safari TLS + HTTP/2 fingerprint (see src/impersonate.js). WebSockets use libcurl.js over Wisp.
// If the server can't do it (no Python/curl_cffi) this quietly falls back to libcurl.js for everything.
import Libcurl from "/libcurl/index.mjs";

const te = new TextEncoder(), td = new TextDecoder();

async function toBytes(body) {
  if (body == null) return new Uint8Array(0);
  if (typeof body === "string") return te.encode(body);
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  return new Uint8Array(await new Response(body).arrayBuffer()); // Blob, FormData, URLSearchParams, ReadableStream
}

// Server reply = [u32 len][JSON meta][body...]. Read the meta, hand back the rest as a stream.
async function readFramed(res) {
  const reader = res.body.getReader();
  let buf = new Uint8Array(0);
  const need = async (n) => {
    while (buf.length < n) {
      const { done, value } = await reader.read();
      if (done) throw new Error("connection to the fetcher closed early");
      const next = new Uint8Array(buf.length + value.length); next.set(buf); next.set(value, buf.length); buf = next;
    }
  };
  await need(4);
  const len = new DataView(buf.buffer, buf.byteOffset).getUint32(0);
  await need(4 + len);
  const meta = JSON.parse(td.decode(buf.subarray(4, 4 + len)));
  let rest = buf.subarray(4 + len);
  const body = new ReadableStream({
    async pull(ctrl) {
      if (rest) { const r = rest; rest = null; if (r.length) return ctrl.enqueue(r); }
      const { done, value } = await reader.read();
      done ? ctrl.close() : ctrl.enqueue(value);
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  return { meta, body };
}

export default class ImpersonateClient {
  constructor(options = {}) {
    this.options = options;
    this.fallback = new Libcurl({ websocket: options.websocket ?? options.wisp });
    this.ready = false;
    this.offUntil = 0;
  }
  async init() { await this.fallback.init(); this.ready = true; }
  async meta() {}
  connect(...args) { return this.fallback.connect(...args); }

  async request(remote, method, body, headers, signal) {
    if (Date.now() >= this.offUntil) {
      try {
        const r = await this.viaServer(remote, method, body, headers, signal);
        if (r) return r;
      } catch (e) {
        if (signal?.aborted || e.name === "AbortError" || e.fatal) throw e;
        this.offUntil = Date.now() + 15000; // couldn't reach the fetcher at all: use libcurl.js for a bit
      }
    }
    return this.fallback.request(remote, method, body, headers, signal);
  }

  async viaServer(remote, method, body, headers, signal) {
    const payload = await toBytes(body);
    const env = te.encode(JSON.stringify({ url: remote.href, method, headers }));
    const out = new Uint8Array(4 + env.length + payload.length);
    new DataView(out.buffer).setUint32(0, env.length);
    out.set(env, 4); out.set(payload, 4 + env.length);
    const res = await fetch("/api/proxy", { method: "POST", body: out, signal, cache: "no-store", credentials: "omit" });
    if (res.headers.get("x-cloudora-impersonate") === "off") { this.offUntil = Date.now() + 5 * 60e3; return null; }
    if (!res.ok) { const err = new Error(`fetcher: ${(await res.text()).slice(0, 200)}`); err.fatal = res.status !== 503 && res.status !== 429; throw err; }
    const { meta, body: stream } = await readFramed(res);
    if (meta.error) { const err = new Error(meta.error); err.fatal = true; throw err; } // DNS / TLS / blocked: a retry elsewhere would only bypass policy
    return { body: stream, headers: meta.headers, status: meta.status, statusText: meta.status_text };
  }
}
