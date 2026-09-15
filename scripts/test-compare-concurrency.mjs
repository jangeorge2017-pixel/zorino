import assert from "node:assert/strict";
import test from "node:test";

const compare = await import("../lib/compare/merge.ts");
const productUrl = await import("../lib/affiliate/product-url.ts");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("Compare candidate pool is bounded, concurrent, and order-preserving", async () => {
  const inputs = ["first", "second", "third", "fourth", "fifth", "sixth"];
  let active = 0;
  let maximumActive = 0;
  const started = performance.now();
  const output = await compare.mapWithBoundedConcurrency(inputs, 3, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await delay(20);
    active -= 1;
    return value;
  });
  const concurrentMs = performance.now() - started;

  const sequentialStarted = performance.now();
  for (const value of inputs) {
    await delay(20);
    assert.ok(value);
  }
  const sequentialMs = performance.now() - sequentialStarted;

  assert.equal(maximumActive, 3);
  assert.deepEqual(output, inputs);
  assert.ok(concurrentMs < sequentialMs, `${concurrentMs}ms was not faster than ${sequentialMs}ms`);
  console.log(`Compare pool timing: sequential=${sequentialMs.toFixed(1)}ms, bounded=${concurrentMs.toFixed(1)}ms`);
});

test("a failed comparison does not discard unrelated candidates", async () => {
  const output = await compare.mapWithBoundedConcurrency(["good-a", "bad", "good-b"], 2, async (id) => {
    if (id === "bad") throw new Error("isolated comparison failure");
    return id;
  });
  assert.deepEqual(output, ["good-a", undefined, "good-b"]);
});

test("Compare candidate selection preserves valid cross-store products and excludes one-store products", () => {
  assert.deepEqual(
    compare.collectComparableProductIds(
      [{ productId: "cross-store", storeId: "store-a" }, { productId: "one-store", storeId: "store-c" }],
      [{ productId: "cross-store", storeId: "store-b" }, { productId: "one-store", storeId: "store-c" }],
      12,
    ),
    ["cross-store"],
  );
});

test("Compare still retains one offer per store and rejects invalid destinations", () => {
  const offers = compare.mergeOffersDedupe(
    [{ storeId: "store-a", source: "internal" }],
    [{ storeId: "store-a", source: "external" }, { storeId: "store-b", source: "external" }],
    (offer) => offer.storeId,
  );
  assert.deepEqual(offers.map((offer) => offer.source), ["internal", "external"]);
  assert.equal(productUrl.isValidProductDestinationUrl("https://www.aliexpress.com/"), false);
  assert.equal(productUrl.isValidProductDestinationUrl("https://www.aliexpress.com/item/1005001234567890.html"), true);
});
