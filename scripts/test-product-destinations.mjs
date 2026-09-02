import assert from "node:assert/strict";
import test from "node:test";

const productUrl = await import("../lib/affiliate/product-url.ts");
const compareMerge = await import("../lib/compare/merge.ts");

test("accepts only AliExpress product-detail and tracked deep-link destinations", () => {
  assert.equal(productUrl.isValidAliExpressDestinationUrl("https://www.aliexpress.com/item/1005001234567890.html"), true);
  assert.equal(productUrl.isValidAliExpressDestinationUrl("https://s.click.aliexpress.com/e/_ExampleToken"), true);
  assert.equal(productUrl.isValidAliExpressDestinationUrl("https://www.aliexpress.com/"), false);
  assert.equal(productUrl.isValidAliExpressDestinationUrl("https://www.aliexpress.com/w/wholesale-phone.html"), false);
});

test("does not fabricate an AliExpress destination when the API omits a product deep link", () => {
  assert.equal(
    productUrl.resolveAliExpressProductDestination(
      "https://www.aliexpress.com/store/123",
      "https://www.aliexpress.com/w/wholesale-phone.html",
    ),
    null,
  );
});

test("chooses a valid product URL when an affiliate field is invalid", () => {
  assert.equal(
    productUrl.resolveProductDestination(
      "https://www.aliexpress.com/",
      "https://www.aliexpress.com/item/1005001234567890.html",
    ),
    "https://www.aliexpress.com/item/1005001234567890.html",
  );
});

test("preserves merchant URLs with encoded callback parameters through the redirect query", () => {
  const destination =
    "https://www.aliexpress.com/item/1005001234567890.html?return_url=https%3A%2F%2Fmerchant.example%2Fdone%3Fa%3D1%2525";
  const parsed = new URL(`https://zorino.example/api/affiliate/go?${new URLSearchParams({ to: destination })}`)
    .searchParams
    .get("to");
  assert.equal(productUrl.parseAffiliateDestinationParam(parsed), destination);
});

test("keeps a valid external offer when the internal source has no merchant URL", () => {
  const merged = compareMerge.mergeOffersDedupe(
    [],
    [{ storeId: "store-a", source: "external", url: "https://merchant.example/p/123" }],
    (offer) => offer.storeId,
  );
  assert.deepEqual(merged.map((offer) => offer.source), ["external"]);
});

test("discovers products comparable solely through external_prices", () => {
  assert.deepEqual(
    compareMerge.collectComparableProductIds(
      [{ productId: "internal-and-external", storeId: "store-a" }],
      [
        { productId: "internal-and-external", storeId: "store-b" },
        { productId: "external-only", storeId: "store-c" },
        { productId: "external-only", storeId: "store-d" },
      ],
      12,
    ),
    ["internal-and-external", "external-only"],
  );
});

test("shop-now: a real merchant product URL passes through as the destination", () => {
  const destination = productUrl.resolveProductDestination(
    "https://www.aliexpress.com/",
    "https://www.aliexpress.com/item/1005001234567890.html",
    "https://s.click.aliexpress.com/e/_abc123",
  );
  assert.equal(destination, "https://www.aliexpress.com/item/1005001234567890.html");
  assert.equal(productUrl.isValidProductDestinationUrl(destination), true);
});

test("shop-now: a bare merchant homepage never becomes a Shop destination", () => {
  assert.equal(
    productUrl.resolveProductDestination(
      "https://www.aliexpress.com/",
      "https://www.alibaba.com/",
      "https://s.click.aliexpress.com/w/wholesale.html",
    ),
    null,
  );
  assert.equal(productUrl.isValidProductDestinationUrl("https://www.aliexpress.com/"), false);
});

test("shop-now: Admitad tracking deep links are real product destinations", () => {
  assert.equal(
    productUrl.isValidProductDestinationUrl("https://ad.admitad.com/g/abc123def456/"),
    true,
  );
});
