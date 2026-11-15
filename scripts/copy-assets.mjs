// Copies the proxy engine files into public/ so a static host (e.g. Vercel) can serve them.
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const pub = fileURLToPath(new URL("../public/", import.meta.url));
for (const [name, src] of [["scram", scramjetPath], ["libcurl", libcurlPath], ["baremux", baremuxPath]]) {
  rmSync(pub + name, { recursive: true, force: true });
  cpSync(src, pub + name, {
    recursive: true,
    filter: (s) => !/[\\/]types([\\/]|$)/.test(s.slice(src.length)) && !s.endsWith(".map"),
  });
}
console.log("Copied proxy assets into public/");
