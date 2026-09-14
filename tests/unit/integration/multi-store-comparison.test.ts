/**
 * Regression tests for Fix 2 — Compare multi-store pool & cross-store matching.
 *
 * Observed production symptoms (verified against live /compare HTML and the
 * pipeline):
 * 1. Compare cards were single-merchant: seed results came only from
 *    searchProductsSurface (4 live results per query) and DB-backed merchant
 *    products never entered the pool, so few cards had cross-store offers.
 * 2. MIN_TITLE_SIMILARITY = 0.55 rejected genuine model-variant twins whose
 *    titles differ in spelling/packaging (e.g. "Samsung Galaxy Watch 4 44mm"
 *    vs "Samsung Galaxy Watch4 SM-R870 Blk" score 0.5), keeping most cards
 *    at a single store even when the same item existed elsewhere.
 * 3. Matching never required a real product-level destination URL, so a
 *    merchant-homepage-only listing could be attached as a "shoppable" offer.
 *
 * Rules locked down here:
 * - A genuinely comparable second store ATTACHES (2+ store enrichment).
 * - When nothing qualifies, the result STAYS single-store (no fabrication).
 * - False matches (look-alike accessories, out-of-price-band, no shared core
 *   token, too-low similarity, no meaningful name) are REJECTED.
 * - At most one offer per store; an already-attached listing never duplicates.
 * - Every attached offer carries a VALID product-level affiliate destination.
 */
import { describe, expect, it } from "vitest";

import {
  ScoredCandidate,
  scoreCompareCandidate,
  selectCompareExtras,
  sharedCoreTokens,
  titleSimilarity,
} from "@/lib/data/multi-store-comparison";
import { isValidProductDestinationUrl } from "@/lib/affiliate/product-url";
import type { SearchResultItem } from "@/lib/data/homepage";

function item(partial: Partial<SearchResultItem> & { id: string }): SearchResultItem {
  return {
    name: partial.name ?? "Product",
    imageSrc: partial.imageSrc ?? "https://img.example.com/x.jpg",
    emoji: "🛍️",
    price: partial.price ?? 100,
    originalPrice: partial.originalPrice ?? partial.price ?? 100,
    discount: partial.discount ?? 0,
    store: partial.store ?? "AliExpress",
    storeSlug: partial.storeSlug ?? "aliexpress",
    rating: partial.rating ?? 0,
    reviewCount: partial.reviewCount ?? 0,
    inStock: partial.inStock ?? true,
    category: partial.category ?? "general",
    currency: partial.currency ?? "USD",
    countryCode: partial.countryCode ?? "US",
    affiliateUrl: partial.affiliateUrl ?? "https://www.aliexpress.com/item/3256801234567890.html",
    ...partial,
  };
}

const VALID_ALIEXPRESS = "https://www.aliexpress.com/item/3256801234567890.html";
const VALID_EBAY = "https://www.ebay.com/itm/325680123456";
const validStoreIds = new Set(["aliexpress"]);
const noKnownOffers = new Set<string>();

describe("sharedCoreTokens", () => {
  it("counts meaningful shared brand/model tokens only", () => {
    expect(
      sharedCoreTokens("Samsung Galaxy Watch 4 44mm", "Samsung Galaxy Watch4 SM-R870 Blk"),
    ).toBeGreaterThanOrEqual(2);
  });

  it("is 0 when only stopwords or numbers overlap", () => {
    expect(sharedCoreTokens("Apple iPhone 15 Pro", "Galaxy S24 Ultra Case")).toBeLessThan(1);
    expect(sharedCoreTokens("Television 55 inch", "Rolls of tape")).toBeLessThan(1);
  });
});

describe("titleSimilarity", () => {
  it("accepts genuine model-variant twins at the 0.40 threshold", () => {
    const score = titleSimilarity(
      "Samsung Galaxy Watch 4 44mm Smartwatch Bluetooth",
      "Samsung Galaxy Watch4 SM-R870 Galaxy Watch 4 Series",
    );
    expect(score).toBeGreaterThanOrEqual(0.4);
  });

  it("stays below 0.40 for a different product sharing only a generic word", () => {
    const score = titleSimilarity("Samsung Galaxy Buds 2 Pro", "Apple AirPods Pro 2");
    expect(score).toBeLessThan(0.4);
  });
});

describe("scoreCompareCandidate — 2+ store enrichment", () => {
  it("attaches a genuine same-product listing from another store", () => {
    const base = "Samsung Galaxy Watch 4 44mm Smartwatch Bluetooth";
    const scored = scoreCompareCandidate(
      base,
      199,
      item({
        id: "ebay-1001",
        name: "Samsung Galaxy Watch4 SM-R870 44mm Smartwatch",
        price: 189,
        storeSlug: "ebay",
        store: "eBay",
        affiliateUrl: VALID_EBAY,
      }),
      validStoreIds,
      noKnownOffers,
    );
    expect(scored).not.toBeNull();
    expect(scored!.storeSlug).toBe("ebay");
    expect(scored!.score).toBeGreaterThanOrEqual(0.4);
  });

  it("keeps the result single-store when nothing qualifies", () => {
    const base = "Samsung Galaxy Watch 4 44mm Smartwatch";
    const scored = scoreCompareCandidate(
      base,
      199,
      item({ id: "aliexpress-1", name: "Samsung Galaxy Watch 4 Case", price: 8, storeSlug: "aliexpress" }),
      validStoreIds,
      noKnownOffers,
    );
    expect(scored).toBeNull();
  });
});

describe("scoreCompareCandidate — false-match rejection", () => {
  it("rejects a look-alike accessory far outside the price band", () => {
    const scored = scoreCompareCandidate(
      "Apple iPhone 15 128GB",
      799,
      item({ id: "walmart-5", name: "Apple iPhone 15 Silicone Case with Magsafe", price: 12, storeSlug: "walmart", store: "Walmart" }),
      validStoreIds,
      noKnownOffers,
    );
    expect(scored).toBeNull();
  });

  it("rejects a different product whose titles share only a generic token", () => {
    const scored = scoreCompareCandidate(
      "Samsung Galaxy Buds 2 Pro",
      149,
      item({ id: "jumbo-6", name: "Apple AirPods Pro 2", price: 159, storeSlug: "bestbuy", store: "Best Buy", affiliateUrl: "https://www.walmart.com/ip/Apple-AirPods-Pro-2/44444444" }),
      validStoreIds,
      noKnownOffers,
    );
    expect(scored).toBeNull();
  });

  it("rejects a candidate without a real product-level destination URL", () => {
    const caseUrl = scoreCompareCandidate(
      "Samsung Galaxy Watch 4 44mm Smartwatch",
      199,
      item({ id: "ebay-2", name: "Samsung Galaxy Watch4 SM-R870", price: 189, storeSlug: "ebay", store: "eBay", affiliateUrl: "https://www.ebay.com/sch/i.html?_nkw=watch" }),
      validStoreIds,
      noKnownOffers,
    );
    expect(caseUrl).toBeNull();

    const homepageOnly = scoreCompareCandidate(
      "Samsung Galaxy Watch 4 44mm Smartwatch",
      199,
      item({ id: "ebay-3", name: "Samsung Galaxy Watch4 SM-R870", price: 189, storeSlug: "ebay", store: "eBay", affiliateUrl: "https://www.ebay.com" }),
      validStoreIds,
      noKnownOffers,
    );
    expect(homepageOnly).toBeNull();
  });

  it("rejects a declined candidate and one without in-stock/price", () => {
    const outOfStock = scoreCompareCandidate(
      "Samsung Galaxy Watch 4 44mm",
      199,
      item({ id: "ebay-4", name: "Samsung Galaxy Watch4 SM-R870 44mm", price: 189, storeSlug: "ebay", store: "eBay", inStock: false, affiliateUrl: VALID_EBAY }),
      validStoreIds,
      noKnownOffers,
    );
    expect(outOfStock).toBeNull();

    const zeroPrice = scoreCompareCandidate(
      "Samsung Galaxy Watch 4 44mm",
      199,
      item({ id: "ebay-5", name: "Samsung Galaxy Watch4 SM-R870 44mm", price: 0, storeSlug: "ebay", store: "eBay", affiliateUrl: VALID_EBAY }),
      validStoreIds,
      noKnownOffers,
    );
    expect(zeroPrice).toBeNull();
  });
});

describe("selectCompareExtras — deduplication", () => {
  it("attaches at most one offer per store (best score wins)", () => {
    const base = "Samsung Galaxy Watch 4 44mm Smartwatch Bluetooth";
    const extras = selectCompareExtras(
      base,
      199,
      [
        item({
          id: "ebay-10",
          name: "Samsung Galaxy Watch4 SM-R870 44mm Smartwatch",
          price: 189,
          storeSlug: "ebay",
          store: "eBay",
          affiliateUrl: VALID_EBAY,
        }),
        item({
          id: "ebay-11",
          name: "Samsung Galaxy Watch4 SM-R870 44mm LTE Smartwatch Bluetooth",
          price: 195,
          storeSlug: "ebay",
          store: "eBay",
          affiliateUrl: VALID_EBAY,
        }),
      ],
      validStoreIds,
      noKnownOffers,
      "watch-1",
    );
    expect(extras.length).toBe(1);
    expect(extras[0]!.provider).toBe("ebay");
  });

  it("never duplicates an already-attached offer identity", () => {
    const base = "Samsung Galaxy Watch 4 44mm Smartwatch Bluetooth";
    const already = new Set(["aliexpress-aliexpress-9000"]);
    const extras = selectCompareExtras(
      base,
      199,
      [
        item({
          id: "aliexpress-9000",
          name: "Samsung Galaxy Watch4 SM-R870 44mm Smartwatch",
          price: 189,
          storeSlug: "aliexpress",
          store: "AliExpress",
          affiliateUrl: VALID_ALIEXPRESS,
        }),
      ],
      new Set<string>(),
      already,
      "watch-1",
    );
    expect(extras.length).toBe(0);
  });

  it("merges multiple stores into one result (2+ store comparison)", () => {
    const base = "Samsung Galaxy Watch 4 44mm Smartwatch Bluetooth";
    const extras = selectCompareExtras(
      base,
      199,
      [
        item({ id: "ebay-20", name: "Samsung Galaxy Watch4 SM-R870 44mm Smartwatch", price: 189, storeSlug: "ebay", store: "eBay", affiliateUrl: VALID_EBAY }),
        item({ id: "walmart-21", name: "Samsung Galaxy Watch4 44mm Galaxy Watch 4", price: 205, storeSlug: "walmart", store: "Walmart", affiliateUrl: "https://www.walmart.com/ip/Samsung-Galaxy-Watch4-44mm/53322222" }),
      ],
      validStoreIds,
      noKnownOffers,
      "watch-1",
    );
    expect(extras.length).toBe(2);
    expect(new Set(extras.map((o) => o.provider))).toEqual(new Set(["ebay", "walmart"]));
  });

  it("covers the endless extras cap (MAX_EXTRA_OFFERS = 4)", () => {
    const base = "Samsung Galaxy Watch 4 44mm Smartwatch Bluetooth";
    const candidates: SearchResultItem[] = [];
    for (const [idx, store] of ["ebay", "walmart", "amazon", "bestbuy", "temu", "noon"].entries()) {
      candidates.push(
        item({
          id: `p-${idx}`,
          name: `Samsung Galaxy Watch4 SM-R870 44mm Smartwatch ${store}`,
          price: 190 + idx,
          storeSlug: store,
          store,
          affiliateUrl:
            store === "walmart"
              ? "https://www.walmart.com/ip/Samsung-Galaxy-Watch4-44mm/53322222"
              : `https://www.ebay.com/itm/325680123456000${idx}`,
        }),
      );
    }
    const extras = selectCompareExtras(
      base,
      199,
      candidates,
      validStoreIds,
      noKnownOffers,
      "watch-1",
    );
    expect(extras.length).toBeLessThanOrEqual(4);
  });
});

describe("attached offers carry valid affiliate destinations", () => {
  it("every offer attached by selectCompareExtras has a valid product URL", () => {
    const base = "Samsung Galaxy Watch 4 44mm Smartwatch Bluetooth";
    const extras = selectCompareExtras(
      base,
      199,
      [
        item({ id: "ebay-30", name: "Samsung Galaxy Watch4 SM-R870 44mm Smartwatch", price: 189, storeSlug: "ebay", store: "eBay", affiliateUrl: VALID_EBAY }),
        item({ id: "walmart-31", name: "Samsung Galaxy Watch4 44mm Galaxy Watch 4", price: 205, storeSlug: "walmart", store: "Walmart", affiliateUrl: "https://www.walmart.com/ip/Samsung-Galaxy-Watch4-44mm/53322222" }),
        item({ id: "ali-32", name: "Samsung Galaxy Watch4 SM-R870 44mm Smartwatch", price: 179, storeSlug: "aliexpress", store: "AliExpress", affiliateUrl: VALID_ALIEXPRESS }),
      ],
      new Set<string>(),
      noKnownOffers,
      "watch-1",
    );
    expect(extras.length).toBe(3);
    for (const offer of extras) {
      expect(isValidProductDestinationUrl(offer.externalUrl)).toBe(true);
    }
  });
});

describe("ScoredCandidate type regressions", () => {
  it("keeps the exported scored-candidate shape stable", () => {
    const base = "Samsung Galaxy Watch 4 44mm Smartwatch Bluetooth";
    const scored = scoreCompareCandidate(
      base,
      199,
      item({
        id: "ebay-40",
        name: "Samsung Galaxy Watch4 SM-R870 44mm Smartwatch",
        price: 189,
        storeSlug: "ebay",
        store: "eBay",
        affiliateUrl: VALID_EBAY,
      }),
      new Set<string>(["aliexpress"]),
      noKnownOffers,
    );
    const typed: ScoredCandidate | null = scored;
    expect(typed?.storeSlug).toBe("ebay");
  });
});