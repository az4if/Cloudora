import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { Impersonator, profileFor, isPrivateIp } from "../src/impersonate.js";
import { curlCffiAvailable } from "../src/upstream.js";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

test("browser profile follows the visitor's user agent", () => {
  assert.equal(profileFor(CHROME), "chrome");
  assert.equal(profileFor(CHROME + " Edg/141.0"), "chrome");
  assert.equal(profileFor("Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0"), "firefox");
  assert.equal(profileFor("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"), "safari");
  assert.equal(profileFor("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"), "safari_ios");
  assert.equal(profileFor(""), "chrome");
});

test("private / loopback / link-local addresses are rejected", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"])
    assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ["1.1.1.1", "8.8.8.8", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111"]) assert.equal(isPrivateIp(ip), false, ip);
});

// minimal req/res pair around Impersonator.handle()
async function call(imp, env, body = Buffer.alloc(0)) {
  const e = Buffer.from(JSON.stringify(env)), head = Buffer.alloc(4); head.writeUInt32BE(e.length);
  const srv = createServer((req, res) => imp.handle(req, res));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/proxy`, { method: "POST", body: Buffer.concat([head, e, body]) });
  const raw = Buffer.from(await r.arrayBuffer());
  srv.close();
  if (!r.ok) return { http: r.status, text: raw.toString(), off: r.headers.get("x-cloudora-impersonate") };
  const n = raw.readUInt32BE(0);
  return { http: r.status, meta: JSON.parse(raw.subarray(4, 4 + n)), body: raw.subarray(4 + n) };
}

test("policy: a host that is a private IP is blocked unless allowLocal", async (t) => {
  if (!(await curlCffiAvailable())) return t.skip("curl_cffi not installed");
  const imp = new Impersonator({ allowLocal: false });
  const r = await call(imp, { url: "http://127.0.0.1:1/", method: "GET", headers: {} });
  assert.equal(r.http, 502);
  assert.match(r.text, /direct IP/);
  const r2 = await call(imp, { url: "http://localhost/", method: "GET", headers: {} }); // never reaches a resolver that returns a public IP
  assert.notEqual(r2.http, 200);
  imp.stop();
});

test("policy: header injection and non-http schemes are rejected", async (t) => {
  if (!(await curlCffiAvailable())) return t.skip("curl_cffi not installed");
  const imp = new Impersonator({ allowLocal: true });
  assert.equal((await call(imp, { url: "http://example.com/", method: "GET", headers: { "X-A": "b\r\nX-Evil: 1" } })).http, 400);
  assert.equal((await call(imp, { url: "file:///etc/passwd", method: "GET", headers: {} })).http, 400);
  imp.stop();
});

test("fetcher: real request, redirect not followed, body decoded, cookies/encoding headers handled", async (t) => {
  if (!(await curlCffiAvailable())) return t.skip("curl_cffi not installed");
  const seen = [];
  const site = createServer((q, r) => {
    seen.push(q.headers);
    if (q.url === "/redir") { r.writeHead(302, { location: "/final", "set-cookie": ["a=1", "b=2"] }); return r.end(); }
    if (q.url === "/post") { const c = []; q.on("data", (d) => c.push(d)); q.on("end", () => { r.setHeader("content-type", "text/plain"); r.end("got:" + Buffer.concat(c)); }); return; }
    r.writeHead(200, { "content-type": "text/plain", "content-encoding": "gzip" }); r.end(gzipSync("hello ".repeat(1000)));
  });
  await new Promise((r) => site.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${site.address().port}`;
  const imp = new Impersonator({ allowLocal: true });
  try {
    const hdrs = { "User-Agent": CHROME, "Accept-Encoding": "identity", "X-Custom": "yes", Cookie: "sid=42" };
    const a = await call(imp, { url: base + "/redir", method: "GET", headers: hdrs });
    assert.equal(a.meta.status, 302);                                  // redirect handed back to the page, not followed
    assert.deepEqual(a.meta.headers["set-cookie"], ["a=1", "b=2"]);   // multiple Set-Cookie kept
    assert.equal(a.meta.headers.location[0], "/final");
    const b = await call(imp, { url: base + "/gz", method: "GET", headers: hdrs });
    assert.equal(b.body.toString(), "hello ".repeat(1000));            // gzip decoded by curl
    assert.equal(b.meta.headers["content-encoding"], undefined);       // and the header no longer claims it
    assert.equal(b.meta.headers["content-length"], undefined);
    const c = await call(imp, { url: base + "/post", method: "POST", headers: { ...hdrs, "Content-Type": "text/plain" } }, Buffer.from("payload"));
    assert.equal(c.body.toString(), "got:payload");
    const h = seen.at(-2);                                              // the /gz request as the site saw it
    assert.equal(h["user-agent"], CHROME);
    assert.equal(h["x-custom"], "yes");
    assert.equal(h.cookie, "sid=42");                                   // cookie comes from the page, not a server-side jar
    assert.match(h["accept-encoding"], /gzip/);                         // real browser value, not the page's "identity"
    assert.ok(h["sec-ch-ua"] || h["accept-language"], "impersonation adds browser default headers");
    const d = await call(imp, { url: base + "/gz", method: "GET", headers: { "User-Agent": CHROME } }); // no cookie now
    assert.equal(seen.at(-1).cookie, undefined);                        // nothing leaked between requests
    assert.equal(d.meta.status, 200);
  } finally { imp.stop(); site.close(); }
});
