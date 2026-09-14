/**
 * Regression tests for Fix 1 — homepage section diversity.
 *
 * Observed production symptoms (verified against live homepage HTML):
 * 1. `flash` ≡ `priceDrops` — both buckets showed the SAME three products.
 * 2. A single Admitad merchant (Glasseslit WW) dominated discount slots while
 *    other merchants/marketplaces were absent.
 * 3. `newArrivals` ordering was meaningless: `updatedMins` was a constant 5 for
 *    every card, so "new" was just a copy of the input order.
 *
 * Root causes being locked down:
 * - Sections drew from the same pool with NO cross-section exclusion.
 * - Balancing keyed on provider id, so every `db-*` product became its own
 *   provider bucket and an Admitad merchant could fill every discount slot
 *   (one product per bucket, all from the same shop).
 * - `updatedMins` was a hardcoded constant, not derived from snapshot age.
 */
import { describe, expect, it } from "vitest";

import {
  balanceCards,
  buildHomepageSections,
  cardIdentityKeys,
  minutesSinceFetched,
} from "@/lib/integration/homepage-sections";
import type { TrendingDealCard } from "@/lib/types/entities";

function card(partial: Partial<TrendingDealCard> & { store: string }): TrendingDealCard {
  return {
    id: partial.id ?? partial.productId ?? "c-1",
    productId: partial.productId ?? String(partial.id ?? "c-1"),
    name: partial.name ?? "Product",
    imageSrc: partial.imageSrc ?? "https://img.example.com/x.jpg",
    emoji: partial.emoji ?? "📦",
    discount: partial.discount ?? 0,
    rating: partial.rating ?? 0,
    reviews: partial.reviews ?? 0,
    price: partial.price ?? 100,
    originalPrice: partial.originalPrice ?? 100,
    store: partial.store,
    storeLogoSrc: partial.storeLogoSrc ?? "/stores/x.svg",
    storeInitial: partial.storeInitial ?? "XX",
    updatedMins: partial.updatedMins ?? 5,
    priceHistory: partial.priceHistory ?? [],
  };
}

/** Collect actual (un-prefixed) product ids across all five sections. */
function sectionCards(
  sections: ReturnType<typeof buildHomepageSections>,
): { name: string; cards: TrendingDealCard[] }[] {
  return [
    { name: "flash", cards: sections.flash },
    { name: "priceDrops", cards: sections.priceDrops },
    { name: "newArrivals", cards: sections.newArrivals },
    { name: "topRated", cards: sections.topRated },
    { name: "editorsPicks", cards: sections.editorsPicks },
  ];
}

/** productId (fallback id BEFORE the flash-/drop- prefix is applied). */
function realId(c: TrendingDealCard): string {
  return String(c.productId ?? c.id);
}

describe("homepage section diversity (Fix 1)", () => {
  it("flash and priceDrops are distinct when the pool has enough products", () => {
    const pool = Array.from({ length: 12 }, (_, i) =>
      card({
        id: `db-${i + 1}`,
        name: `Product ${1000 + i + 1}`,
        discount: 60 - Math.floor(i / 2), // two products share each discount value
        originalPrice: 200,
        price: 80 - Math.floor(i / 2),
        store: i % 2 === 0 ? "Glasseslit WW" : "Alibaba WW",
      }),
    );

    const sections = buildHomepageSections(pool);
    const flashIds = sections.flash.map(realId);
    const dropIds = sections.priceDrops.map(realId);

    expect(flashIds).toHaveLength(4);
    expect(dropIds).toHaveLength(4);
    expect(dropIds).not.toEqual(flashIds);
  });

  it("no product is reused across the five sections", () => {
    const pool = Array.from({ length: 30 }, (_, i) =>
      card({
        id: `db-${i + 1}`,
        name: `Product ${1000 + i + 1}`,
        discount: 80 - i, // strictly decreasing discounts
        originalPrice: 150,
        price: 100,
        store: `Merchant ${(i % 5) + 1}`,
        rating: 4,
        reviews: 100 - i,
        updatedMins: i,
      }),
    );

    const sections = buildHomepageSections(pool);
    const allIds = sectionCards(sections).flatMap(({ cards }) => cards.map(realId));

    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("a single discount-dominant merchant does not fill every flash slot", () => {
    // Glasseslit WW owns the 10 deepest discounts; round-robin must still
    // leave room for other merchants alongside it.
    const pool = [
      ...Array.from({ length: 10 }, (_, i) =>
        card({ id: `db-glasses-${i}`, name: `Glasses ${1000 + i}`, discount: 90 - i, originalPrice: 200, price: 20, store: "Glasseslit WW" }),
      ),
      card({ id: "real-aliexpress-1", name: "Ali Item", discount: 80, originalPrice: 200, price: 40, store: "AliExpress" }),
      card({ id: "real-ebay-1", name: "Ebay Item", discount: 75, originalPrice: 200, price: 50, store: "eBay" }),
      card({ id: "db-alibaba-1", name: "Alibaba Item", discount: 70, originalPrice: 200, price: 60, store: "Alibaba WW" }),
    ];

    const sections = buildHomepageSections(pool);
    const flashStores = sections.flash.map((c) => c.store);
    const distinctMerchants = new Set(flashStores);

    expect(sections.flash.length).toBeGreaterThanOrEqual(2);
    expect(flashStores.filter((s) => s === "Glasseslit WW").length).toBeLessThan(4);
    expect(distinctMerchants.size).toBeGreaterThanOrEqual(2);
  });

  it("priceDrops reflects merchant balance too, not just the deepest discounts", () => {
    const pool = [
      ...Array.from({ length: 8 }, (_, i) =>
        card({ id: `db-x-${i}`, name: `Item ${1000 + i}`, discount: 95 - i, originalPrice: 300, price: 30, store: "Merchant A" }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        card({ id: `ebay-${i}`, name: `Ebay Item ${1000 + i}`, discount: 60 - i * 2, originalPrice: 100, price: 40, store: "eBay" }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        card({ id: `ali-${i}`, name: `Ali Item ${1000 + i}`, discount: 55 - i * 2, originalPrice: 100, price: 45, store: "AliExpress" }),
      ),
    ];

    const sections = buildHomepageSections(pool);
    const dropStores = sections.priceDrops.map((c) => c.store);

    expect(new Set(dropStores).size).toBeGreaterThanOrEqual(2);
    expect(dropStores.filter((s) => s === "Merchant A").length).toBeLessThan(4);
  });

  it("newArrivals orders by real snapshot age (updatedMins), not input order", () => {
    // High-discount "stale" products are consumed by the earlier sections;
    // newArrivals must still be able to surface recently-fetched items and
    // never fall back to the stale input order. Under the old constant
    // `updatedMins = 5` the sort was a no-op and stale products leaked in.
    const stale = Array.from({ length: 6 }, (_, i) =>
      card({
        id: `stale-${i}`,
        name: `Stale Item ${1000 + i}`,
        discount: 95 - i,
        updatedMins: 500,
        originalPrice: 200,
        price: 40,
        store: `StaleMerchant ${i}`,
      }),
    );
    const fresh = Array.from({ length: 14 }, (_, i) =>
      card({
        id: `fresh-${i}`,
        name: `Fresh Item ${1000 + i}`,
        discount: 50 - i,
        updatedMins: i + 1,
        originalPrice: 200,
        price: 60,
        store: "FreshMerchant",
      }),
    );

    const sections = buildHomepageSections([...stale, ...fresh]);
    const newCards = sections.newArrivals;

    expect(newCards.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < newCards.length; i++) {
      expect(newCards[i]!.updatedMins).toBeGreaterThanOrEqual(newCards[i - 1]!.updatedMins);
    }
    for (const c of newCards) {
      expect(c.updatedMins).toBeLessThan(100);
    }
  });
});

describe("homepage cross-surface identity with the trending strip (Fix 6)", () => {
  it("sections exclude every card the trending strip claims", () => {
    const pool = Array.from({ length: 40 }, (_, i) =>
      card({
        id: `p-${i}`,
        name: `Product ${1000 + i}`,
        discount: 90 - Math.floor(i / 2),
        originalPrice: 200,
        price: 40,
        store: i % 2 === 0 ? "Glasseslit WW" : "Alibaba WW",
      }),
    );

    const trending = balanceCards(
      [...pool].sort((a, b) => b.discount - a.discount),
      8,
      (a, b) => b.discount - a.discount,
    );
    const claimedKeys = new Set(trending.flatMap((c) => cardIdentityKeys(c)));
    const sections = buildHomepageSections(pool, claimedKeys);

    const trendingIds = trending.map(realId);
    const sectionIds = sectionCards(sections).flatMap(({ cards }) => cards.map(realId));

    for (const id of trendingIds) {
      expect(sectionIds).not.toContain(id);
    }
  });

  it("trending strip + all five sections stay distinct and full when the pool is large enough", () => {
    const pool = Array.from({ length: 60 }, (_, i) =>
      card({
        id: `db-${i}`,
        name: `Gadget ${1000 + i}`,
        discount: 95 - Math.floor(i / 4),
        originalPrice: 300,
        price: 60,
        rating: 5,
        reviews: 500 - i,
        updatedMins: i,
        store: `Merchant ${(i % 6) + 1}`,
      }),
    );

    const trending = balanceCards(
      [...pool].sort((a, b) => b.discount - a.discount),
      8,
      (a, b) => b.discount - a.discount,
    );
    const claimed = new Set(trending.flatMap((c) => cardIdentityKeys(c)));
    const sections = buildHomepageSections(pool, claimed);

    const featured = [
      ...trending,
      ...sectionCards(sections).flatMap(({ cards }) => cards),
    ];

    expect(featured).toHaveLength(8 + 4 * 5);
    expect(new Set(featured.map(realId)).size).toBe(featured.length);
    expect(sections.flash).toHaveLength(4);
    expect(sections.priceDrops).toHaveLength(4);
    expect(sections.newArrivals).toHaveLength(4);
    expect(sections.topRated).toHaveLength(4);
    expect(sections.editorsPicks).toHaveLength(4);
  });

  it("the same real product under different source-format ids is recognised as one product", () => {
    const dbCopy = card({ id: "db-100", name: "Pro Glasses 2024", store: "Glasseslit WW" });
    const feedCopy = card({
      id: "admitad-55-100",
      name: "Pro Glasses 2024",
      store: "Glasseslit WW",
    });
    const others = Array.from({ length: 24 }, (_, i) =>
      card({
        id: `other-${i}`,
        name: `Other Product ${1000 + i}`,
        store: `Store ${(i % 4) + 1}`,
      }),
    );

    const sections = buildHomepageSections([dbCopy, feedCopy, ...others]);
    const sectionIds = sectionCards(sections).flatMap(({ cards }) => cards.map(realId));

    expect(sectionIds).toContain("db-100");
    expect(sectionIds).not.toContain("admitad-55-100");
  });

  it("a trending-claimed product's cross-format twin is excluded from sections too", () => {
    const dbCopy = card({ id: "db-9", name: "Aviator Sunglasses", store: "Glasseslit WW" });
    const feedCopy = card({
      id: "admitad-9-9",
      name: "Aviator Sunglasses",
      store: "Glasseslit WW",
    });
    const pool = [
      dbCopy,
      feedCopy,
      ...Array.from({ length: 24 }, (_, i) =>
        card({ id: `o-${i}`, name: `Other ${1000 + i}`, store: `S${(i % 5) + 1}` }),
      ),
    ];

    const claimed = new Set(trendingToKeys([dbCopy]));
    const sections = buildHomepageSections(pool, claimed);

    const sectionIds = sectionCards(sections).flatMap(({ cards }) => cards.map(realId));
    expect(sectionIds).not.toContain("db-9");
    expect(sectionIds).not.toContain("admitad-9-9");
  });

  it("genuinely different products from different providers are not merged by shared titles", () => {
    const pool = [
      ...Array.from({ length: 4 }, (_, i) =>
        card({ id: `ali-${i}`, name: "Wireless Earbuds Pro", store: "AliExpress" }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        card({ id: `ebay-${i}`, name: "Wireless Earbuds Pro", store: "eBay" }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        card({ id: `db-${i}`, name: "Wireless Earbuds Pro", store: "Glasseslit WW" }),
      ),
    ];

    const sections = buildHomepageSections(pool);
    const flashIds = sections.flash.map(realId);

    expect(flashIds.some((id) => id.startsWith("ali-"))).toBe(true);
    expect(flashIds.some((id) => id.startsWith("ebay-"))).toBe(true);
    expect(flashIds.some((id) => id.startsWith("db-"))).toBe(true);
  });

  it("sections shrink truthfully rather than repeating products when the pool is small", () => {
    const pool = Array.from({ length: 6 }, (_, i) =>
      card({
        id: `db-${i}`,
        name: `Only ${1000 + i}`,
        discount: 60 - i,
        originalPrice: 200,
        price: 50,
        store: "Glasseslit WW",
      }),
    );

    const sections = buildHomepageSections(pool);
    const allIds = sectionCards(sections).flatMap(({ cards }) => cards.map(realId));

    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.length).toBeLessThanOrEqual(6);
    expect(sections.flash.length).toBeGreaterThan(0);
  });
});

/** Claim keys helper — mirrors getHomepageProductSurfaces(). */
function trendingToKeys(cards: ReturnType<typeof card>[]): string[] {
  return cards.flatMap((c) => cardIdentityKeys(c));
}

describe("minutesSinceFetched (Fix 1)", () => {
  it("returns minutes elapsed for a valid ISO timestamp", () => {
    const twoHoursAgo = new Date(Date.now() - 120 * 60_000).toISOString();
    expect(minutesSinceFetched(twoHoursAgo)).toBeGreaterThanOrEqual(119);
    expect(minutesSinceFetched(twoHoursAgo)).toBeLessThanOrEqual(121);
  });

  it("falls back to the legacy constant for unparseable timestamps", () => {
    expect(minutesSinceFetched("not-a-date")).toBe(5);
    expect(minutesSinceFetched("")).toBe(5);
  });
});