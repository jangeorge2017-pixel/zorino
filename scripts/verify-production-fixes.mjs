/**
 * verify-production-fixes.mjs — Tests A–H for the four final production bugs.
 *
 * Run directly:  node scripts/verify-production-fixes.mjs
 *
 * No test framework is used (repository has none); assertions are plain Node.
 * The logic under test is imported straight from the REAL source (the pure
 * modules) thanks to Node's native TS type stripping, so these tests exercise
 * the actual implementation, not a copy.
 *
 *   A) AliExpress promotion-link extraction handles array/object/nested shapes
 *   B) Compare Prices merges external offers and recomputes stats over all
 *   C) Shop Now / product-detail URLs are provider-aware real PRODUCT links
 *   D) Provider activation requires runtime health (real returned products)
 */
import {
  extractPromotionLinks,
  normalizePromotionEntry,
} from "../lib/integrations/aliexpress/promotion-links.ts";
import {
  mergeOffersDedupe,
  computeCompareStats,
  tagCompareFlags,
} from "../lib/compare/merge.ts";
import {
  isValidProductDestinationUrl,
  isValidAliExpressDestinationUrl,
} from "../lib/affiliate/product-url.ts";
import {
  recordProviderRun,
  isProviderLive,
  resetProviderHealthForTests,
} from "../lib/integration/provider-health.ts";

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

const DEEP = "https://s.click.aliexpress.com/e/_abc123";
const PRODUCT = "https://www.aliexpress.com/item/1005002000000000.html";
const HOME = "https://www.aliexpress.com/";

console.log("\n[A] extractPromotionLinks handles every documented response shape");
{
  // A1 — documented nested OBJECT: { promotion_link: [ ... ] }
  const nested = extractPromotionLinks({
    promotion_link: [
      { source_value: PRODUCT, promotion_link: DEEP },
      { source_value: "https://www.aliexpress.com/item/1005003000000000.html", promotion_link: "https://s.click.aliexpress.com/e/_def456" },
    ],
  });
  assert(nested.length === 2, "nested { promotion_link: [...] } → 2 pairs", `got ${nested.length}`);

  // A2 — plain ARRAY of objects
  const arrayForm = extractPromotionLinks([
    { source_value: PRODUCT, promotion_link: DEEP },
  ]);
  assert(arrayForm.length === 1, "plain array of objects → 1 pair", `got ${arrayForm.length}`);

  // A3 — single OBJECT (not wrapped)
  const single = extractPromotionLinks({ source_value: PRODUCT, promotion_link: DEEP });
  assert(single.length === 1, "single object → 1 pair", `got ${single.length}`);

  // A4 — ARRAY of strings
  const strings = extractPromotionLinks([PRODUCT, DEEP]);
  assert(strings.length === 2, "array of strings → 2 pairs", `got ${strings.length}`);

  // A5 — garbage / null / undefined
  assert(extractPromotionLinks(null).length === 0, "null → 0 pairs");
  assert(extractPromotionLinks(undefined).length === 0, "undefined → 0 pairs");
  assert(extractPromotionLinks("not an object").length === 0, "string → 0 pairs");
  assert(extractPromotionLinks(42).length === 0, "number → 0 pairs");

  // A6 — entries without a usable promotion_link are dropped
  const dropped = normalizePromotionEntry({ source_value: PRODUCT });
  assert(dropped === null, "entry w/o promotion_link → dropped");

  // A7 — dedupe by source
  const dup = extractPromotionLinks([
    { source_value: PRODUCT, promotion_link: DEEP },
    { source_value: PRODUCT, promotion_link: DEEP },
  ]);
  assert(dup.length === 1, "duplicate pair deduped → 1", `got ${dup.length}`);
}

console.log("\n[B] compare/merge — external offers merge into Compare Prices");
{
  const internal = [
    { storeId: "walmart", price: 20, discountPercent: 10 },
  ];
  const external = [
    { storeId: "aliexpress", price: 12, discountPercent: 40 },
    { storeId: "ebay", price: 18, discountPercent: 25 },
    { storeId: "walmart", price: 15, discountPercent: 10 }, // dup store → internal wins
  ];
  const merged = mergeOffersDedupe(internal, external, (o) => o.storeId);
  assert(merged.length === 3, "one offer per store (3 stores)", `got ${merged.length}`);
  const walmartOffer = merged.find((o) => o.storeId === "walmart");
  assert(walmartOffer?.price === 20, "internal row wins over external for same store", `price ${walmartOffer?.price}`);

  const stats = computeCompareStats(merged);
  assert(stats.lowestPrice === 12, "lowest = external offer", `got ${stats.lowestPrice}`);
  assert(stats.highestPrice === 20, "highest = 20", `got ${stats.highestPrice}`);
  assert(stats.highestDiscount === 40, "highest discount = aliexpress 40", `got ${stats.highestDiscount}`);
  assert(stats.savingsVsHighest === 8, "savings 20-12 = 8", `got ${stats.savingsVsHighest}`);

  const sorted = [...merged].sort((a, b) => a.price - b.price);
  tagCompareFlags(sorted, stats);
  assert(sorted[0]?.isLowest === true, "cheapest flagged lowest");

  const empty = computeCompareStats([]);
  assert(empty.lowestPrice === 0 && empty.cheapestIndex === -1, "empty set → zeros");
}

console.log("\n[C] provider-aware Shop Now URL validation (real product links only)");
{
  // AliExpress
  assert(isValidAliExpressDestinationUrl(DEEP) === true, "ali s.click deep link accepted");
  assert(isValidAliExpressDestinationUrl(PRODUCT) === true, "ali /item/<id>.html accepted");
  assert(isValidAliExpressDestinationUrl(HOME) === false, "ali homepage rejected");
  assert(isValidAliExpressDestinationUrl("https://www.aliexpress.com/search/?q=shoes") === false, "ali /search rejected");
  assert(isValidAliExpressDestinationUrl("https://www.aliexpress.com/store/978901") === false, "ali /store/ rejected");
  assert(isValidAliExpressDestinationUrl("https://www.aliexpress.com/wholesale?catId=0") === false, "ali /wholesale rejected");

  // eBay
  assert(isValidProductDestinationUrl("https://www.ebay.com/itm/123456789012") === true, "ebay /itm/<id> accepted");
  assert(isValidProductDestinationUrl("https://www.ebay.com/itm/Genuine-Apple-Watch/123456789012") === true, "ebay /itm/slug/<id> accepted");
  assert(isValidProductDestinationUrl("https://www.ebay.com/p/1234567890") === true, "ebay /p/<id> accepted");
  assert(isValidProductDestinationUrl("https://www.ebay.com/") === false, "ebay homepage rejected");
  assert(isValidProductDestinationUrl("https://www.ebay.com/sch/i.html?_nkw=shoes") === false, "ebay /sch/ rejected");
  assert(isValidProductDestinationUrl("https://www.ebay.com/usr/my-store") === false, "ebay /usr/ rejected");
  assert(isValidProductDestinationUrl("https://www.ebay.com/deals") === false, "ebay /deals rejected");
  assert(isValidProductDestinationUrl("https://www.ebay.co.uk/itm/123456789012") === true, "ebay.co.uk /itm/ accepted");

  // Amazon
  assert(isValidProductDestinationUrl("https://www.amazon.com/dp/B0ABCD1234") === true, "amazon /dp/<asin> accepted");
  assert(isValidProductDestinationUrl("https://www.amazon.com/gp/product/B0ABCD1234") === true, "amazon /gp/product/<asin> accepted");
  assert(isValidProductDestinationUrl("https://www.amazon.com/gp/aw/d/B0ABCD1234") === true, "amazon /gp/aw/d/<asin> accepted");
  assert(isValidProductDestinationUrl("https://www.amazon.com/") === false, "amazon homepage rejected");
  assert(isValidProductDestinationUrl("https://www.amazon.com/s?k=shoes") === false, "amazon /s?k= rejected");
  assert(isValidProductDestinationUrl("https://www.amazon.com/gp/bestsellers") === false, "amazon /gp/bestsellers rejected");
  assert(isValidProductDestinationUrl("https://www.amazon.com/deals") === false, "amazon /deals rejected");

  // Walmart
  assert(isValidProductDestinationUrl("https://www.walmart.com/ip/Apple-Watch/123456789") === true, "walmart /ip/slug/<id> accepted");
  assert(isValidProductDestinationUrl("https://www.walmart.com/item/123456789") === true, "walmart /item/<id> accepted");
  assert(isValidProductDestinationUrl("https://www.walmart.com/") === false, "walmart homepage rejected");
  assert(isValidProductDestinationUrl("https://www.walmart.com/shop/all") === false, "walmart /shop rejected");
  assert(isValidProductDestinationUrl("https://www.walmart.com/search?q=x") === false, "walmart /search rejected");

  // Temu
  assert(isValidProductDestinationUrl("https://www.temu.com/item/abc-123.html") === true, "temu /item/ accepted");
  assert(isValidProductDestinationUrl("https://www.temu.com/goods.html?goods_id=601099512323666") === true, "temu goods.html?goods_id accepted");
  assert(isValidProductDestinationUrl("https://www.temu.com/") === false, "temu homepage rejected");
  assert(isValidProductDestinationUrl("https://www.temu.com/search_result.html?search_key=x") === false, "temu search_result rejected");

  // CJdropshipping
  assert(isValidProductDestinationUrl("https://www.cjdropshipping.com/product/watch-p-1234567890.html") === true, "cj /product/...-p-<pid>.html accepted");
  assert(isValidProductDestinationUrl("https://www.cjdropshipping.com/product/1234567890.html") === true, "cj /product/<pid>.html accepted");
  assert(isValidProductDestinationUrl("https://www.cjdropshipping.com/") === false, "cj homepage rejected");
  assert(isValidProductDestinationUrl("https://www.cjdropshipping.com/api") === false, "cj /api rejected");
  assert(isValidProductDestinationUrl("https://www.cjdropshipping.com/product/watch") === false, "cj /product/<no-id> rejected");

  // Noon
  assert(isValidProductDestinationUrl("https://www.noon.com/uae-en/n/electronics/iphone-15-N40123456/p") === true, "noon /n/ accepted");
  assert(isValidProductDestinationUrl("https://www.noon.com/n/iphone-15-N40123456/p") === true, "noon /n/ short accepted");
  assert(isValidProductDestinationUrl("https://s.noon.com/AbCdEf12345") === true, "noon s.noon.com accepted");
  assert(isValidProductDestinationUrl("https://www.noon.com/search?q=iphone") === false, "noon /search rejected");
  assert(isValidProductDestinationUrl("https://www.noon.com/") === false, "noon homepage rejected");

  // Generic acceptance + garbage
  assert(isValidProductDestinationUrl(null) === false, "null URL rejected");
  assert(isValidProductDestinationUrl(undefined) === false, "undefined URL rejected");
  assert(isValidProductDestinationUrl("") === false, "empty URL rejected");
  assert(isValidProductDestinationUrl("javascript:alert(1)") === false, "non-http protocol rejected");
  assert(isValidProductDestinationUrl("https://example.com/") === false, "unknown-host homepage rejected");
  assert(isValidProductDestinationUrl("https://example.com/item/123") === true, "unknown-host deep link passes generic rule");
}

console.log("\n[D] provider activation — live only with real returned products");
resetProviderHealthForTests();
{
  assert(isProviderLive("aliexpress") === false, "never-ran provider not live");
  recordProviderRun("aliexpress", 0);
  assert(isProviderLive("aliexpress") === false, "0-product run not live");
  recordProviderRun("aliexpress", 47);
  assert(isProviderLive("aliexpress") === true, "provider with real products is live");
  recordProviderRun("aliexpress", 0);
  recordProviderRun("aliexpress", 0);
  recordProviderRun("aliexpress", 0);
  assert(isProviderLive("aliexpress") === false, "3 consecutive failures → not live");

  // Per-provider isolation: ebay success does NOT revive aliexpress.
  recordProviderRun("ebay", 12);
  assert(isProviderLive("ebay") === true, "ebay live independently");
  assert(isProviderLive("aliexpress") === false, "aliexpress still not live");
}

console.log(`\n${checks} checks, ${failures} failures`);
if (failures > 0) process.exit(1);
console.log("ALL PASSED");