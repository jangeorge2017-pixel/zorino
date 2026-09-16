/**
 * Failure #1B regression tests: degraded/partial catalog viability gate.
 *
 * Verifies that a degraded merged catalog (empty or single-provider pool from
 * latency/timeout issues) cannot overwrite a healthy multi-provider catalog in
 * the unstable_cache slot. The gate is provider-neutral, deterministic, and
 * derived from the multi-marketplace identity of the architecture.
 *
 * All tests use pure-function calls and module-state seams only -- no
 * Supabase, no live providers, no network.
 */
import { describe, it, expect, afterEach } from "vitest";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import {
  isCatalogViable,
  resolveCatalogOutcome,
  rememberCatalogAsHealthy,
  getLastKnownGoodCatalog,
  resetCatalogViabilityForTests,
  MIN_VIABLE_SOURCES,
} from "@/lib/integration/database-catalog";

afterEach(() => {
  resetCatalogViabilityForTests();
});

function makeItem(providerId: string, title = "Test Product"): NormalizedCatalogItem {
  return {
    id: `test-${providerId}-${Math.random().toString(36).slice(2, 8)}`,
    slug: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    imageUrl: "https://example.com/img.jpg",
    emoji: "📦",
    categorySlug: "electronics",
    rating: 4.5,
    reviewCount: 100,
    countryCode: "US",
    currency: "USD",
    price: 29.99,
    originalPrice: 49.99,
    discount: 40,
    discountType: "percentage",
    offers: [
      {
        providerId: providerId as any,
        storeSlug: providerId,
        storeName: `${providerId} Store`,
        externalId: `ext-${Math.random().toString(36).slice(2, 8)}`,
        price: 29.99,
        originalPrice: 49.99,
        currency: "USD",
        countryCode: "US",
        productUrl: "https://example.com/product",
        affiliateUrl: "https://example.com/aff",
        inStock: true,
      },
    ],
    providerIds: [providerId as any],
    fetchedAt: new Date().toISOString(),
  };
}

describe("isCatalogViable", () => {
  it("rejects empty catalog", () => {
    expect(isCatalogViable([])).toBe(false);
  });

  it("rejects single-provider catalog", () => {
    const items = [makeItem("aliexpress"), makeItem("aliexpress"), makeItem("aliexpress")];
    expect(isCatalogViable(items)).toBe(false);
  });

  it("accepts multi-provider catalog (>=2 distinct sources)", () => {
    const items = [makeItem("aliexpress"), makeItem("ebay")];
    expect(isCatalogViable(items)).toBe(true);
  });

  it("accepts catalog with 3+ providers", () => {
    const items = [makeItem("aliexpress"), makeItem("ebay"), makeItem("cjdropshipping")];
    expect(isCatalogViable(items)).toBe(true);
  });

  it("uses provider identity, not item count", () => {
    // 50 items from one provider = not viable
    const singleProvider = Array.from({ length: 50 }, () => makeItem("aliexpress"));
    expect(isCatalogViable(singleProvider)).toBe(false);

    // 2 items from two providers = viable
    const twoProviders = [makeItem("aliexpress"), makeItem("ebay")];
    expect(isCatalogViable(twoProviders)).toBe(true);
  });

  it("MIN_VIABLE_SOURCES is 2 (smallest non-trivial multi-source count)", () => {
    expect(MIN_VIABLE_SOURCES).toBe(2);
  });

  it("does not hardcode any specific provider name", () => {
    // The gate must be provider-neutral: any two distinct provider IDs pass.
    const items = [makeItem("any-provider-a"), makeItem("any-provider-b")];
    expect(isCatalogViable(items)).toBe(true);
  });
});

describe("resolveCatalogOutcome", () => {
  it("returns viable fresh catalog and remembers it", () => {
    const fresh = [makeItem("aliexpress"), makeItem("ebay")];
    const result = resolveCatalogOutcome(fresh);
    expect(result).toBe(fresh);
    expect(getLastKnownGoodCatalog()).toBe(fresh);
  });

  it("rejects degraded fresh catalog, returns known-good when available", () => {
    const healthy = [makeItem("aliexpress"), makeItem("ebay")];
    rememberCatalogAsHealthy(healthy);

    const degraded = [makeItem("aliexpress")]; // single provider
    const result = resolveCatalogOutcome(degraded);
    expect(result).toBe(healthy); // known-good, not degraded
  });

  it("cold start: degraded fresh returned when no known-good exists", () => {
    const degraded = [makeItem("aliexpress")];
    const result = resolveCatalogOutcome(degraded);
    expect(result).toBe(degraded); // no known-good, return what we have
  });

  it("healthy multi-provider catalog is returned unchanged", () => {
    const healthy = [makeItem("aliexpress"), makeItem("ebay"), makeItem("cjdropshipping")];
    const result = resolveCatalogOutcome(healthy);
    expect(result).toBe(healthy);
    expect(result).toHaveLength(3);
  });

  it("known-good is preserved across multiple degraded calls", () => {
    const healthy = [makeItem("aliexpress"), makeItem("ebay")];
    rememberCatalogAsHealthy(healthy);

    // First degraded call
    const degraded1 = [makeItem("aliexpress")];
    expect(resolveCatalogOutcome(degraded1)).toBe(healthy);

    // Second degraded call -- still returns the same known-good
    const degraded2 = [makeItem("aliexpress")];
    expect(resolveCatalogOutcome(degraded2)).toBe(healthy);

    // Module memory unchanged
    expect(getLastKnownGoodCatalog()).toBe(healthy);
  });

  it("new healthy catalog updates the known-good snapshot", () => {
    const healthy1 = [makeItem("aliexpress"), makeItem("ebay")];
    rememberCatalogAsHealthy(healthy1);

    const healthy2 = [makeItem("aliexpress"), makeItem("ebay"), makeItem("cjdropshipping")];
    const result = resolveCatalogOutcome(healthy2);
    expect(result).toBe(healthy2);
    expect(getLastKnownGoodCatalog()).toBe(healthy2);
  });
});

describe("resetCatalogViabilityForTests", () => {
  it("clears known-good memory", () => {
    rememberCatalogAsHealthy([makeItem("aliexpress"), makeItem("ebay")]);
    expect(getLastKnownGoodCatalog()).toHaveLength(2);

    resetCatalogViabilityForTests();
    expect(getLastKnownGoodCatalog()).toHaveLength(0);
  });
});
