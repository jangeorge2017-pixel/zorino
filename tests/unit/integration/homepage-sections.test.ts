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
  buildHomepageSections,
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
        card({ id: `db-glasses-${i}`, discount: 90 - i, originalPrice: 200, price: 20, store: "Glasseslit WW" }),
      ),
      card({ id: "real-aliexpress-1", discount: 80, originalPrice: 200, price: 40, store: "AliExpress" }),
      card({ id: "real-ebay-1", discount: 75, originalPrice: 200, price: 50, store: "eBay" }),
      card({ id: "db-alibaba-1", discount: 70, originalPrice: 200, price: 60, store: "Alibaba WW" }),
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
        card({ id: `db-x-${i}`, discount: 95 - i, originalPrice: 300, price: 30, store: "Merchant A" }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        card({ id: `ebay-${i}`, discount: 60 - i * 2, originalPrice: 100, price: 40, store: "eBay" }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        card({ id: `ali-${i}`, discount: 55 - i * 2, originalPrice: 100, price: 45, store: "AliExpress" }),
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