/**
 * Phase 4 — Canonical consumption: feature gates, surface seams, kernel, and
 * old-vs-new parity harness.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  isSurfaceEnabled,
  setSurfaceEnabledForTests,
  resetSurfaceFlagsForTests,
  canonicalizeSearchListings,
  canonicalizeCatalogItems,
  canonicalizeProductDetail,
  canonicalSearchProducts,
  searchResultsPagedSurface,
  assembleCanonicalSearchPool,
  setCanonicalSearchFetcherForTests,
  applyCanonicalCatalogIfEnabled,
  getCanonicalCatalogDiagnostics,
  canonicalCompareProducts,
  resolveMarketplaceProductDetailCanonical,
  getPdpCanonicalDiagnostics,
  runSearchFixtureParity,
  runCompareFixtureParity,
  runCatalogFixtureParity,
  runPdpFixtureParity,
} from "@/lib/canonical/consumption";
import type { NormalizedSearchListing } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { ProductDetail } from "@/lib/data/product-detail";
import type { CompareOffer } from "@/services/compare";
import { setCanonicalEnabledForTests, resetCanonicalFlagForTests } from "@/lib/canonical/feature";

const REAL_IMAGES = [
  "https://img.alicdn.com/imgextra/fixture-aliexpress-01.jpg",
  "https://i.ebayimg.com/images/g/fixture-ebay-01.jpg",
];

function listing(over: Partial<NormalizedSearchListing> & { id: string; providerId: string; externalId: string; title: string; price: number }): NormalizedSearchListing {
  return {
    id: over.id,
    providerId: over.providerId,
    externalId: over.externalId,
    title: over.title,
    price: over.price,
    originalPrice: over.originalPrice ?? 0,
    discount: over.discount ?? 0,
    currency: over.currency ?? "USD",
    imageUrl: over.imageUrl ?? REAL_IMAGES[0],
    productUrl: over.productUrl ?? "https://fixture.example.com/p",
    affiliateUrl: over.affiliateUrl ?? "https://fixture.example.com/go",
    rating: over.rating ?? 4.5,
    reviewCount: over.reviewCount ?? 120,
    inStock: over.inStock ?? true,
    storeName: over.storeName ?? "AliExpress",
    storeSlug: over.storeSlug ?? "aliexpress",
    countryCode: over.countryCode ?? "US",
    category: over.category ?? "Electronics",
    relevanceScore: 900, isDevice: true, matchTier: over.matchTier ?? "exact",
  };
}

const validListing = () =>
  listing({
    id: "al-1",
    providerId: "aliexpress",
    externalId: "alex-1",
    title: "Wireless Earbuds Pro",
    price: 19.99,
    originalPrice: 39.99,
    discount: 50,
  });

// Survives relevance ranking but violates the canonical gate (G1: no identity).
const invalidListing = () =>
  listing({
    id: "al-bad-t",
    providerId: "aliexpress",
    externalId: "",
    title: "Wireless Earbuds Missing External Id",
    price: 12,
  });

// Survives relevance ranking but violates the canonical gate (G2: zero price).
const invalidPriceListing = () =>
  listing({
    id: "al-bad-p",
    providerId: "aliexpress",
    externalId: "alex-badp",
    title: "Wireless Earbuds Zero Price",
    price: 0,
  });

// Violates the canonical gate immediately (G2: missing title).
const titleMissingListing = () =>
  listing({
    id: "al-empty-title",
    providerId: "aliexpress",
    externalId: "alex-empty",
    title: "",
    price: 12,
  });

const ebayListing = () =>
  listing({
    id: "eb-1",
    providerId: "ebay",
    externalId: "ebay-1",
    title: "Wireless Earbuds Pro (eBay)",
    price: 24.99,
    storeName: "eBay",
    storeSlug: "ebay",
  });

function searchItem(id: string, over: Partial<SearchResultItem> = {}): SearchResultItem {
  return {
    id,
    name: over.name ?? `Product ${id}`,
    imageSrc: over.imageSrc ?? REAL_IMAGES[0],
    emoji: over.emoji ?? "🛍️",
    price: over.price ?? 10,
    originalPrice: over.originalPrice ?? 20,
    discount: over.discount ?? 50,
    store: over.store ?? "AliExpress",
    storeSlug: over.storeSlug ?? "aliexpress",
    rating: over.rating ?? 4.5,
    reviewCount: over.reviewCount ?? 42,
    inStock: over.inStock ?? true,
    category: over.category ?? "Electronics",
    affiliateUrl: over.affiliateUrl ?? `https://example.com/${id}`,
    ...over,
  };
}

const STORE = {
  id: "aliexpress",
  name: "AliExpress",
  slug: "aliexpress",
  website: "https://www.aliexpress.com",
  integrationType: "aliexpress" as const,
  commissionRate: 5,
  supportedRegions: ["US"],
  supportedCurrencies: ["USD"],
  isActive: true,
};

function catalogItem(id: string, over: Partial<NormalizedCatalogItem> = {}): NormalizedCatalogItem {
  return {
    id,
    slug: `${id}-slug`,
    title: over.title ?? `Catalog ${id}`,
    imageUrl: over.imageUrl ?? REAL_IMAGES[0],
    emoji: "📦",
    categorySlug: "electronics",
    rating: 4.3,
    reviewCount: 77,
    countryCode: "US",
    currency: "USD",
    price: 25,
    originalPrice: 40,
    discount: 37,
    discountType: "percentage",
    offers: [offerFixture({ price: 25, originalPrice: 40 })],
    providerIds: ["aliexpress"],
    fetchedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function offerFixture(over: { price: number; originalPrice?: number; url?: string } = { price: 0, originalPrice: 40 }): NormalizedCatalogItem["offers"][number] {
  return {
    providerId: "aliexpress",
    storeSlug: "aliexpress",
    storeName: "AliExpress",
    externalId: `ext-${over.price}-${over.url ?? "o"}`,
    price: over.price,
    originalPrice: over.originalPrice ?? 40,
    currency: "USD",
    countryCode: "US",
    productUrl: over.url ?? "https://fixture.example.com/offer",
    inStock: true,
  };
}

function makeOffer(id: string, url: string): CompareOffer {
  return {
    id,
    productId: `product-${id}`,
    storeId: "aliexpress",
    price: 21,
    originalPrice: 30,
    currency: "USD",
    externalUrl: url,
    externalProductId: `ext-${id}`,
    inStock: true,
    isCurrent: true,
    recordedAt: "2026-01-01T00:00:00.000Z",
    store: { ...STORE },
    discountPercent: 30,
  };
}

function pdpDetail(offers: CompareOffer[]): ProductDetail {
  return {
    product: {
      id: "product-1",
      name: "Detail Product",
      slug: "detail-product",
      imageUrl: REAL_IMAGES[1],
      reviewCount: 12,
      currency: "USD",
      inStock: true,
      tags: [],
      isActive: true,
    },
    comparison: {
      product: {
        id: "product-1",
        name: "Detail Product",
        slug: "detail-product",
        imageUrl: REAL_IMAGES[1],
        reviewCount: 12,
        currency: "USD",
        inStock: true,
        tags: [],
        isActive: true,
      },
      offers: offers as ProductDetail["comparison"]["offers"],
      lowestPrice: 21,
      highestPrice: 30,
      highestDiscount: 30,
      savingsVsHighest: 9,
      savingsPercent: 30,
      providerCount: 1,
      cheapestStoreName: "AliExpress",
      highestDiscountStoreName: "AliExpress",
    },
    categoryName: "Electronics",
  } as unknown as ProductDetail;
}

describe("consumption feature gates", () => {
  beforeEach(() => {
    delete process.env.ARCH_CANONICAL;
    delete process.env.CANONICAL_CONSUMPTION_SEARCH;
    delete process.env.CANONICAL_CONSUMPTION_PDP;
    delete process.env.CANONICAL_CONSUMPTION_COMPARE;
    delete process.env.CANONICAL_CONSUMPTION_HOMEPAGE;
    resetSurfaceFlagsForTests();
    resetCanonicalFlagForTests();
  });
  afterEach(() => {
    resetSurfaceFlagsForTests();
    resetCanonicalFlagForTests();
  });

  it("defaults: all surfaces off with no env", () => {
    expect(isSurfaceEnabled("search")).toBe(false);
    expect(isSurfaceEnabled("pdp")).toBe(false);
    expect(isSurfaceEnabled("compare")).toBe(false);
    expect(isSurfaceEnabled("homepage")).toBe(false);
  });

  it("surface env var alone does NOT enable without ARCH_CANONICAL", () => {
    process.env.CANONICAL_CONSUMPTION_SEARCH = "1";
    expect(isSurfaceEnabled("search")).toBe(false);
  });

  it("requires both master flag and the surface flag", () => {
    setCanonicalEnabledForTests(true);
    process.env.CANONICAL_CONSUMPTION_SEARCH = "1";
    expect(isSurfaceEnabled("search")).toBe(true);
    expect(isSurfaceEnabled("pdp")).toBe(false);
  });

  it("test hooks toggle surfaces independently", () => {
    setSurfaceEnabledForTests("compare", true);
    expect(isSurfaceEnabled("compare")).toBe(true);
    expect(isSurfaceEnabled("homepage")).toBe(false);
    resetSurfaceFlagsForTests();
    expect(isSurfaceEnabled("compare")).toBe(false);
  });
});

describe("canonicalizeSearchListings", () => {
  it("accepts valid listings verbatim, rejects missing-id, empty-title, zero-price", () => {
    const outcome = canonicalizeSearchListings([
      validListing(),
      ebayListing(),
      invalidListing(),
      titleMissingListing(),
      invalidPriceListing(),
    ]);
    expect(outcome.accepted.map((l) => l.id)).toEqual(["al-1", "eb-1"]);
    expect(outcome.accepted[0]?.title).toBe("Wireless Earbuds Pro");
    expect(outcome.accepted[0]?.price).toBe(19.99);
    expect(outcome.rejected.map((r) => r.listing.id)).toEqual(["al-bad-t", "al-empty-title", "al-bad-p"]);
    const codes = outcome.rejected.flatMap((r) => r.codes);
    expect(codes).toContain("G1_EXTERNAL_ID_MISSING");
    expect(codes).toContain("G2_TITLE_MISSING");
    expect(codes).toContain("G2_PRICE_INVALID");
    expect(outcome.products.length).toBeGreaterThan(0);
    expect(outcome.acquired).toBe(5);
  });

  it("maps accepted listings to canonical products", () => {
    const outcome = canonicalizeSearchListings([validListing(), ebayListing()]);
    expect(outcome.productByOffer.size).toBe(2);
    for (const productId of outcome.productByOffer.values()) {
      expect(productId).toBeTruthy();
    }
  });
});

describe("canonicalizeCatalogItems", () => {
  it("passes clean items through byte-for-byte", () => {
    const item = catalogItem("c1");
    const outcome = canonicalizeCatalogItems([item]);
    expect(outcome.items[0]).toBe(item);
    expect(outcome.droppedItems).toBe(0);
    expect(outcome.rejectedOffers).toBe(0);
  });

  it("drops an offer and recomputes aggregates when only part survives", () => {
    const good = offerFixture({ price: 25, originalPrice: 40 });
    const bad = offerFixture({ price: 0, originalPrice: 40 });
    const item = catalogItem("c2", { offers: [good, bad] });
    const outcome = canonicalizeCatalogItems([item]);
    expect(outcome.rejectedOffers).toBe(1);
    expect(outcome.droppedItems).toBe(0);
    expect(outcome.items[0]?.offers).toHaveLength(1);
    expect(outcome.items[0]?.price).toBe(25);
  });

  it("drops an item when every offer fails", () => {
    const bad1 = offerFixture({ price: 0, originalPrice: 40 });
    const bad2 = offerFixture({ price: 0, originalPrice: 40, url: "https://fixture.example.com/b2" });
    const item = catalogItem("c3", { offers: [bad1, bad2] });
    const outcome = canonicalizeCatalogItems([item]);
    expect(outcome.droppedItems).toBe(1);
    expect(outcome.items).toHaveLength(0);
  });
});

describe("canonicalizeProductDetail", () => {
  it("keeps a valid detail unchanged", () => {
    const detail = pdpDetail([makeOffer("o1", "https://example.com/o1")]);
    const outcome = canonicalizeProductDetail(detail);
    expect(outcome.changed).toBe(false);
    expect(outcome.rejectedOfferIds).toHaveLength(0);
    expect(outcome.detail).toBe(detail);
  });

  it("rejects an offer with no provable price ring and rebuilds the summary", () => {
    const valid = makeOffer("ok", "https://example.com/ok");
    const zero = { ...makeOffer("zr", "https://example.com/zr"), price: 0, discountPercent: 0 };
    const detail = pdpDetail([valid, zero]);
    const outcome = canonicalizeProductDetail(detail);
    expect(outcome.rejectedOfferIds).toContain("zr");
    expect(outcome.offersKept).toBe(1);
    expect(outcome.changed).toBe(true);
    expect(outcome.detail.comparison.offers).toHaveLength(1);
    expect(outcome.detail.comparison.lowestPrice).toBe(valid.price);
  });

  it("leaves identity-less offers unvalidated (never fabricates rejections)", () => {
    const offer = { ...makeOffer("anon", "https://example.com/anon"), provider: undefined, externalProductId: undefined, id: "anon" } as unknown as CompareOffer;
    const detail = pdpDetail([offer]);
    const outcome = canonicalizeProductDetail(detail);
    expect(outcome.rejectedOfferIds).toHaveLength(0);
    expect(outcome.changed).toBe(false);
  });
});

describe("assembleCanonicalSearchPool", () => {
  it("emits balanced mixed pool; rejections attributed by code", () => {
    const pool = assembleCanonicalSearchPool({
      liveListings: [validListing(), ebayListing(), invalidListing()],
      dbItems: [searchItem("db-1", { storeSlug: "aliexpress", store: "AliExpress" })],
      activeProviders: ["aliexpress", "ebay"],
      query: "earbuds",
      limit: 10,
    });
    expect(pool.rejectedCount).toBe(1);
    expect(Object.values(pool.rejectedByCode).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(pool.acceptedCount).toBe(2);
    expect(pool.productsFormed).toBeGreaterThan(0);
    expect(pool.items.length).toBeGreaterThanOrEqual(2);
  });

  it("excludes duplicate DB items that match a live name", () => {
    const pool = assembleCanonicalSearchPool({
      liveListings: [validListing()],
      dbItems: [searchItem("db-dup", { name: "Wireless Earbuds Pro", storeSlug: "aliexpress" })],
      activeProviders: ["aliexpress"],
      query: "earbuds",
      limit: 10,
    });
    expect(pool.items.every((i) => i.id !== "db-dup")).toBe(true);
  });
});

describe("flag-aware seams (mocked legacy)", () => {
  afterEach(() => {
    delete process.env.ARCH_CANONICAL;
    delete process.env.CANONICAL_CONSUMPTION_SEARCH;
    resetSurfaceFlagsForTests();
    resetCanonicalFlagForTests();
    setCanonicalSearchFetcherForTests(null);
    vi.restoreAllMocks();
  });

  it("gate off: canonicalSearchProducts delegates to legacy searchProducts", async () => {
    const engine = await import("@/lib/search/engine");
    const spy = vi.spyOn(engine, "searchProducts").mockResolvedValue([searchItem("legacy-1")]);
    const items = await canonicalSearchProducts("earbuds", 25);
    expect(spy).toHaveBeenCalledWith("earbuds", 25, { optimizeForDeviceIntent: true });
    expect(items[0]?.id).toBe("legacy-1");
  });

  it("gate off: paged surface delegates to legacy searchProductsPaged", async () => {
    const engine = await import("@/lib/search/engine");
    const spy = vi
      .spyOn(engine, "searchProductsPaged")
      .mockResolvedValue({ items: [searchItem("p1")], total: 1, offset: 0, limit: 1, hasMore: false });
    const page = await searchResultsPagedSurface("earbuds", 0, 1);
    expect(spy).toHaveBeenCalledWith("earbuds", 0, 1, { optimizeForDeviceIntent: true });
    expect(page.items[0]?.id).toBe("p1");
  });

  it("gate on: paged surface slices the canonical pool via fetcher override", async () => {
    setCanonicalEnabledForTests(true);
    setSurfaceEnabledForTests("search", true);
    setCanonicalSearchFetcherForTests(async () => ({
      liveListings: [validListing(), ebayListing()],
      dbItems: [],
      activeProviders: ["aliexpress", "ebay"],
    }));
    const page1 = await searchResultsPagedSurface("wireless earbuds pro", 0, 1);
    const page2 = await searchResultsPagedSurface("wireless earbuds pro", 1, 1);
    expect(page1.items).toHaveLength(1);
    expect(page2.items).toHaveLength(1);
    expect(page1.items[0]?.id).not.toBe(page2.items[0]?.id);
    expect(page1.hasMore).toBe(true);
  });

  it("gate on: canonicalSearchProducts resolves a canonical pool", async () => {
    setCanonicalEnabledForTests(true);
    setSurfaceEnabledForTests("search", true);
    setCanonicalSearchFetcherForTests(async () => ({
      liveListings: [validListing(), ebayListing()],
      dbItems: [],
      activeProviders: ["aliexpress", "ebay"],
    }));
    const items = await canonicalSearchProducts("wireless earbuds pro", 30);
    expect(items.length).toBe(2);
    expect(items.some((i) => i.storeSlug === "aliexpress")).toBe(true);
    expect(items.some((i) => i.storeSlug === "ebay")).toBe(true);
  });

  it("gate on: exception falls back to legacy searchProducts", async () => {
    setCanonicalEnabledForTests(true);
    setSurfaceEnabledForTests("search", true);
    setCanonicalSearchFetcherForTests(async () => {
      throw new Error("boom");
    });
    const engine = await import("@/lib/search/engine");
    const spy = vi.spyOn(engine, "searchProducts").mockResolvedValue([searchItem("fb-1")]);
    const items = await canonicalSearchProducts("fallback-earbuds");
    expect(spy).toHaveBeenCalled();
    expect(items[0]?.id).toBe("fb-1");
  });

  it("gate on: rejections surface through the pool assembler, no crash", async () => {
    setCanonicalEnabledForTests(true);
    setSurfaceEnabledForTests("search", true);
    setCanonicalSearchFetcherForTests(async () => ({
      liveListings: [validListing(), invalidListing(), invalidPriceListing()],
      dbItems: [],
      activeProviders: ["aliexpress"],
    }));
    const items = await canonicalSearchProducts("wireless earbuds pro", 30);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.every((i) => i.id !== "al-bad-t")).toBe(true);
  });
});

describe("homepage surface", () => {
  afterEach(() => {
    delete process.env.ARCH_CANONICAL;
    delete process.env.CANONICAL_CONSUMPTION_HOMEPAGE;
    resetSurfaceFlagsForTests();
    resetCanonicalFlagForTests();
  });

  it("gate off: returns the exact same items (no canonical involvement)", () => {
    const item = catalogItem("h1");
    const output = applyCanonicalCatalogIfEnabled([item]);
    expect(output[0]).toBe(item);
  });

  it("gate on: narrows to canonical-valid offers and records diagnostics", async () => {
    setCanonicalEnabledForTests(true);
    setSurfaceEnabledForTests("homepage", true);
    const good = offerFixture({ price: 25, originalPrice: 40 });
    const zero = offerFixture({ price: 0, originalPrice: 40 });
    const output = applyCanonicalCatalogIfEnabled([
      catalogItem("h2", { offers: [good, zero] }),
      catalogItem("h3", { offers: [zero, offerFixture({ price: 0, originalPrice: 40, url: "https://fixture.example.com/ho3" })] }),
    ]);
    expect(output).toHaveLength(1);
    expect(output[0]?.offers).toHaveLength(1);
    const diag = getCanonicalCatalogDiagnostics();
    expect(diag.runs).toBeGreaterThan(0);
    expect(diag.rejectedOffers).toBeGreaterThanOrEqual(2);
    expect(diag.droppedItems).toBe(1);
    expect(diag.lastRunAt).toBeTruthy();
  });
});

describe("compare surface", () => {
  afterEach(() => {
    delete process.env.ARCH_CANONICAL;
    delete process.env.CANONICAL_CONSUMPTION_SEARCH;
    resetSurfaceFlagsForTests();
    resetCanonicalFlagForTests();
    vi.restoreAllMocks();
  });

  it("gate off: assembles compare products from legacy search", async () => {
    const engine = await import("@/lib/search/engine");
    const spy = vi.spyOn(engine, "searchProducts").mockResolvedValue([
      searchItem("cp-1", { name: "Laptop Gaming", price: 899, originalPrice: 1099, store: "eBay", storeSlug: "ebay" }),
    ]);
    const products = await canonicalCompareProducts(6);
    expect(spy).toHaveBeenCalled();
    expect(products.length).toBeGreaterThanOrEqual(1);
  });
});

describe("PDP surface", () => {
  afterEach(() => {
    delete process.env.ARCH_CANONICAL;
    delete process.env.CANONICAL_CONSUMPTION_PDP;
    resetSurfaceFlagsForTests();
    resetCanonicalFlagForTests();
    vi.restoreAllMocks();
  });

  it("gate off: delegates straight to legacy resolver", async () => {
    const md = await import("@/lib/data/marketplace-product-detail");
    const spy = vi
      .spyOn(md, "resolveMarketplaceProductDetail")
      .mockResolvedValue(pdpDetail([makeOffer("o1", "https://example.com/o1")]));
    await resolveMarketplaceProductDetailCanonical("anything");
    expect(spy).toHaveBeenCalledWith("anything");
  });

  it("gate on: rejects invalid offers through the spine and records diagnostics", async () => {
    setCanonicalEnabledForTests(true);
    setSurfaceEnabledForTests("pdp", true);
    const md = await import("@/lib/data/marketplace-product-detail");
    const valid = makeOffer("ok", "https://example.com/ok");
    const zero = { ...makeOffer("zr", "https://example.com/zr"), price: 0, discountPercent: 0 };
    vi.spyOn(md, "resolveMarketplaceProductDetail").mockResolvedValue(pdpDetail([valid, zero]));
    const detail = await resolveMarketplaceProductDetailCanonical("id1");
    expect(detail?.comparison.offers).toHaveLength(1);
    const diag = getPdpCanonicalDiagnostics();
    expect(diag.rejectedOffers).toBe(1);
    expect(diag.runs).toBeGreaterThan(0);
  });

  it("gate on: null detail passes through as null", async () => {
    setCanonicalEnabledForTests(true);
    setSurfaceEnabledForTests("pdp", true);
    const md = await import("@/lib/data/marketplace-product-detail");
    vi.spyOn(md, "resolveMarketplaceProductDetail").mockResolvedValue(null);
    expect(await resolveMarketplaceProductDetailCanonical("nope")).toBeNull();
  });
});

describe("parity harness", () => {
  it("search fixture parity passes on identical accepted output", async () => {
    const report = runSearchFixtureParity("earbuds", [validListing(), ebayListing()], 50);
    expect(report.surface).toBe("search");
    expect(report.verdict).toBe("pass");
    expect(report.itemMatchRate).toBe(1);
    expect(report.canonicalRejections).toBe(0);
    expect(report.perField.every((f) => f.matchRate === 1)).toBe(true);
  });

  it("search fixture parity attributes canonical drops instead of failing", () => {
    const report = runSearchFixtureParity("earbuds", [validListing(), invalidListing()], 50);
    expect(report.canonicalRejections).toBe(1);
    expect(report.verdict).toBe("pass");
    expect(report.itemMatchRate).toBe(1);
  });

  it("compare fixture parity passes on identical accepted output", () => {
    const report = runCompareFixtureParity("earbuds", [validListing(), ebayListing()], 50);
    expect(report.surface).toBe("compare");
    expect(report.verdict).toBe("pass");
    expect(report.itemMatchRate).toBe(1);
    expect(report.canonicalRejections).toBe(0);
    expect(report.compareOrderMatches).toBe(true);
    expect(report.compareOffers).toEqual({ legacy: 2, canonical: 2 });
    expect(report.perField.every((f) => f.matchRate === 1)).toBe(true);
  });

  it("compare fixture parity attributes canonical drops, keeps order and offers", () => {
    const report = runCompareFixtureParity(
      "earbuds",
      [validListing(), ebayListing(), invalidListing()],
      50,
    );
    expect(report.canonicalRejections).toBe(1);
    expect(report.verdict).toBe("pass");
    expect(report.itemMatchRate).toBe(1);
    expect(report.compareOrderMatches).toBe(true);
    expect(report.compareOffers).toEqual({ legacy: 2, canonical: 2 });
  });

  it("catalog fixture parity attributes dropped items", () => {
    const zero = offerFixture({ price: 0, originalPrice: 40 });
    const report = runCatalogFixtureParity([catalogItem("cat-1"), catalogItem("cat-2", { offers: [zero] })]);
    expect(report.canonicalRejections).toBe(2);
    expect(report.verdict).toBe("warn");
  });

  it("pdp fixture parity reports offer-level rejection", () => {
    const valid = makeOffer("ok", "https://example.com/ok");
    const zero = { ...makeOffer("zr", "https://example.com/zr"), price: 0, discountPercent: 0 };
    const report = runPdpFixtureParity(pdpDetail([valid, zero]));
    expect(report.canonicalRejections).toBe(1);
    expect(report.itemDiffs[0]?.equalLegacyCanonical).toBe(false);
  });
});