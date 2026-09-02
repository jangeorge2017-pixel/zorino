import assert from "node:assert/strict";
import test from "node:test";

const { mergeOffersDedupe, computeCompareStats } = await import(
  "../lib/compare/merge.ts"
);

const makeOffer = (storeId, source, price, discountPercent = 0) => ({
  storeId,
  source,
  price,
  discountPercent,
});

test("compare: two external_prices offers for the same canonical product produce two offers", () => {
  const merged = mergeOffersDedupe(
    [],
    [
      makeOffer("store-a", "external", 20),
      makeOffer("store-b", "external", 25),
    ],
    (offer) => offer.storeId,
  );
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((o) => o.storeId).sort(), ["store-a", "store-b"]);
});

test("compare: internal + external offers from different stores are both preserved", () => {
  const merged = mergeOffersDedupe(
    [makeOffer("store-a", "internal", 15)],
    [makeOffer("store-b", "external", 30)],
    (offer) => offer.storeId,
  );
  assert.equal(merged.length, 2);
  const a = merged.find((o) => o.storeId === "store-a");
  const b = merged.find((o) => o.storeId === "store-b");
  assert.equal(a.source, "internal");
  assert.equal(b.source, "external");
});

test("compare: same store is deduped, internal price row wins over external staging row", () => {
  const merged = mergeOffersDedupe(
    [makeOffer("store-a", "internal", 15)],
    [makeOffer("store-a", "external", 9)],
    (offer) => offer.storeId,
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].storeId, "store-a");
  assert.equal(merged[0].source, "internal");
  assert.equal(merged[0].price, 15);
});

test("compare: offers without a store id (no real merchant destination) are excluded", () => {
  const merged = mergeOffersDedupe(
    [makeOffer("", "external", 19), makeOffer(null, "external", 22)],
    [{ storeId: "store-c", source: "external", price: 40 }],
    (offer) => offer.storeId,
  );
  assert.deepEqual(merged.map((o) => o.storeId), ["store-c"]);
});

test("compare: a one-store product stays one-store (no fabricated second store)", () => {
  const merged = mergeOffersDedupe(
    [makeOffer("store-a", "internal", 15)],
    [],
    (offer) => offer.storeId,
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].storeId, "store-a");
});

test("compare: stats recompute over merged offers mark the true cheapest and max discount", () => {
  const merged = mergeOffersDedupe(
    [makeOffer("store-a", "internal", 15, 25)],
    [makeOffer("store-b", "external", 10, 50), makeOffer("store-c", "external", 30, 0)],
    (offer) => offer.storeId,
  );
  const sorted = [...merged].sort((a, b) => a.price - b.price);
  const stats = computeCompareStats(sorted);
  assert.equal(stats.lowestPrice, 10);
  assert.equal(stats.highestPrice, 30);
  assert.equal(stats.savingsVsHighest, 20);
  assert.equal(stats.highestDiscount, 50);
  assert.equal(sorted[stats.cheapestIndex].storeId, "store-b");
  assert.equal(sorted[stats.highestDiscountIndexes[0]].discountPercent, 50);
});
