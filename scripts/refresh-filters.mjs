// Downloads the latest ad-block lists, compiles them and swaps them into public/adblock/ (same safety checks as the
// server's own weekly refresh). Used by .github/workflows/update-filters.yml; you can also run it by hand:
//   node scripts/refresh-filters.mjs
// Exits 1 if anything fails or the new build looks wrong, leaving the current lists untouched.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { refresh } from "../src/filters.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const info = await refresh({ root, liveDir: join(root, "public", "adblock"), force: true });
  console.log(`Ad-block lists updated: ${info.network} network rules, ${info.cosmetic} page rules, ${info.scriptlets} scriptlets (built ${info.built})`);
} catch (err) {
  console.error("Ad-block list update failed:", err.message);
  process.exit(1);
}
