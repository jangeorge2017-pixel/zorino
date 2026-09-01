/**
 * verify-alibaba-fix.mjs — Tests A–G for the provider-aware Alibaba data fix.
 *
 * Run directly:  node scripts/verify-alibaba-fix.mjs
 *
 * No test framework is used (repository has none); assertions are plain Node.
 * The Alibaba URL / live-feed decision logic is imported straight from the real
 * source (lib/affiliate/product-url.ts) thanks to Node's native TS type
 * stripping, so these tests exercise the actual implementation, not a copy.
 *
 *   A) https://www.alibaba.com/                         → rejected
 *   B) https://www.alibaba.com/?foo=bar                 → rejected (homepage w/ query)
 *   C) generic Admitad tracking URL                     → never a native product;
 *                                                         only usable when a live
 *                                                         product proves the deep link
 *   D) real Alibaba product URLs                        → accepted
 *   E) Alibaba DB row w/ homepage + live product avail  → resolves live (feed-first)
 *   F) Alibaba DB row w/ no provable deep URL           → unavailable
 *   G) one Alibaba failure does not remove other offers → per-provider isolation
 */
import { readFileSync } from "node:fs";
import {
  isValidProductDestinationUrl,
  isAlibabaProductUrl,
  isAlibabaHostUrl,
  extractAlibabaProductId,
  resolveAlibabaProduct,
} from "../lib/affiliate/product-url.ts";

let failures = 0;
let checks = 0;
function assert(cond, label, extra = "") {
  checks += 1;
  if (cond) {
    console.log(`  ✓ ${label}${extra ? `  (${extra})` : ""}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}  ${extra}`);
  }
}

console.log("\n[A] Alibaba homepage is never a product destination");
const HOME = "https://www.alibaba.com/";
assert(isValidProductDestinationUrl(HOME) === false, "homepage rejected by isValidProductDestinationUrl");
assert(isAlibabaProductUrl(HOME) === false, "homepage rejected by isAlibabaProductUrl");

console.log("\n[B] Alibaba homepage with an arbitrary query is still a homepage");
const HOME_Q = "https://www.alibaba.com/?foo=bar";
assert(isValidProductDestinationUrl(HOME_Q) === false, "homepage?foo=bar rejected by isValidProductDestinationUrl");
assert(isAlibabaProductUrl(HOME_Q) === false, "homepage?foo=bar rejected by isAlibabaProductUrl");
assert(isAlibabaHostUrl(HOME_Q) === true, "host still recognized as Alibaba");

console.log("\n[C] Generic Admitad tracking URL is never a native Alibaba product");
// Real shape from lowest_prices_today (Alibaba WW row), tracking host only.
const TRACK = "https://rzekl.com/g/pm1aev55cl32ef59cc79219aa26f6f/?ulp=https%3A%2F%2Foffer.alibaba.com%2Fcps%2Fm8irg4a8%3Fbm%3Dcps%26src%3Dsaf%26productId%3D62147007178&i=5&f_id=50001";
assert(isAlibabaHostUrl(TRACK) === false, "rzekl.com tracking host is not an Alibaba host");
assert(isAlibabaProductUrl(TRACK) === false, "tracking URL is not a native Alibaba product URL");
// When a live product proves the deep link, the row resolves live; when not, it is unavailable.
assert(
  resolveAlibabaProduct(TRACK, true) === "live",
  "tracking-row with live product resolves live",
);
assert(
  resolveAlibabaProduct(TRACK, false) === "unavailable",
  "tracking-row without a provable product is unavailable",
);

console.log("\n[D] Real Alibaba product URLs are accepted");
const PROD1 = "https://www.alibaba.com/product-detail/Wholesale-Mobile-Phone-USB-Cable_62147007178.html";
const PROD2 = "https://offer.alibaba.com/cps/m8irg4a8?bm=cps&src=saf&productId=62147007178";
assert(isAlibabaProductUrl(PROD1) === true, "product-detail/<slug>_<id>.html accepted");
assert(isValidProductDestinationUrl(PROD1) === true, "product-detail URL passes generic guard");
assert(isAlibabaProductUrl(PROD2) === true, "offer.alibaba.com/cps/...?productId= accepted");
assert(extractAlibabaProductId(PROD1) === "62147007178", "product-detail id extracted");
assert(extractAlibabaProductId(PROD2) === "62147007178", "cps productId extracted");

console.log("\n[E] Alibaba DB row (homepage stored) resolves live feed product when available");
// Stored URL is a homepage; live feed has the real product → must pick live.
const HOMEPAGE_STORED = "https://www.alibaba.com/";
assert(resolveAlibabaProduct(HOMEPAGE_STORED, true) === "live", "homepage row + live product → live");
// Stored URL is a homepage and no live product → unavailable (never the homepage).
assert(resolveAlibabaProduct(HOMEPAGE_STORED, false) === "unavailable", "homepage row + no live → unavailable");

console.log("\n[F] Alibaba DB row with no provable deep URL is unavailable");
assert(resolveAlibabaProduct(TRACK, false) === "unavailable", "tracking-only row → unavailable");
assert(resolveAlibabaProduct(null, false) === "unavailable", "null URL → unavailable");
assert(resolveAlibabaProduct("", false) === "unavailable", "empty URL → unavailable");
// A natively-valid stored Alibaba product URL is the only stored fallback.
assert(resolveAlibabaProduct(PROD1, false) === "stored", "native product URL, no live → stored");

console.log("\n[G] One Alibaba failure must not drop other providers' offers");
// Runtime demonstration mirroring lib/search/engine.ts fetchProvidersInParallel
// (each connector runs in its own try/catch inside Promise.all, so a single
// provider throwing cannot remove the ones that succeeded).
const providers = [
  { name: "aliexpress", run: async () => [{ id: 1, name: "AliExpress item" }] },
  { name: "alibaba", run: async () => { throw new Error("alibaba feed 405"); } },
  { name: "ebay", run: async () => [{ id: 2, name: "eBay item" }] },
  { name: "cjdropshipping", run: async () => [{ id: 3, name: "CJ item" }] },
];
const results = await Promise.all(
  providers.map(async (p) => {
    try {
      return { name: p.name, items: await p.run() };
    } catch (err) {
      return { name: p.name, items: [] };
    }
  }),
);
const withItems = results.filter((r) => r.items.length > 0).map((r) => r.name).sort();
assert(
  JSON.stringify(withItems) === JSON.stringify(["aliexpress", "cjdropshipping", "ebay"]),
  "ebay/aliexpress/cj offers survive the Alibaba failure",
  `present=${withItems.join(",")}`,
);
// Static guard: the real engine keeps each connector in its own try/catch.
const engineSrc = readFileSync(new URL("../lib/search/engine.ts", import.meta.url), "utf8");
const body = engineSrc.slice(engineSrc.indexOf("fetchProvidersInParallel"));
assert(
  body.includes("connectors.map(async (connector) =>") &&
    body.includes("try {") &&
    body.includes("} catch (err) {") &&
    body.includes("Promise.all("),
  "engine source isolates each provider (try/catch inside Promise.all)",
);

console.log(`\n${checks - failures}/${checks} assertions passed, ${failures} failed`);
if (failures > 0) process.exit(1);
