import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { upstream, BROWSER_UA, curlCffiAvailable } from "../src/upstream.js";

// Local "bot filter": answers 403 unless the request carries Chrome's sec-ch-ua header,
// which plain Node fetch never sends but curl_cffi's chrome impersonation does.
function filterServer() {
  const seen = [];
  const srv = createServer((req, res) => {
    seen.push(req.headers);
    if (req.url === "/echo") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ ua: req.headers["user-agent"], body: "" })); }
    if (!req.headers["sec-ch-ua"]) { res.writeHead(403, { server: "cloudflare", "cf-mitigated": "challenge" }); return res.end("Just a moment..."); }
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, ua: req.headers["user-agent"] }));
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r({ srv, seen, base: `http://127.0.0.1:${srv.address().port}` })));
}

test("upstream sends a real browser User-Agent, not node's default", async () => {
  const { srv, base } = await filterServer();
  const r = await upstream(base + "/echo");
  srv.close();
  assert.equal(r.status, 200);
  const ua = JSON.parse(r.body.toString()).ua;
  assert.equal(ua, BROWSER_UA);
  assert.match(ua, /Mozilla\/5\.0 .*Chrome\/\d+/);
});

test("caller headers are merged over the defaults", async () => {
  const { srv, base } = await filterServer();
  const r = await upstream(base + "/echo", { headers: { "User-Agent": "custom/1" } });
  srv.close();
  assert.equal(JSON.parse(r.body.toString()).ua, "custom/1");
});

test("a bot-filter 403 is retried through curl_cffi when it is installed", async (t) => {
  if (!(await curlCffiAvailable())) return t.skip("curl_cffi not installed");
  const { srv, base } = await filterServer();
  const r = await upstream(base + "/api");
  srv.close();
  assert.equal(r.status, 200);
  assert.equal(r.via, "curl_cffi");
  assert.equal(JSON.parse(r.body.toString()).ok, true);
});
