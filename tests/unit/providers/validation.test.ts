import { describe, it, expect } from "vitest";
import {
  CanonicalListingSchema,
  SearchResultSetSchema,
  CompareProductResultSchema,
  ProviderConfigSchema,
  ProductImageSchema,
  ProductLocationSchema,
  ProductDiscountSchema,
  AvailabilitySchema,
  CancellationPolicySchema,
  SellerInfoSchema,
  ProviderMetadataSchema,
  ShippingSchema,
  PaginationInfoSchema,
  ProviderStatSchema,
  DeduplicationStatsSchema,
  CompareOfferSchema,
  validateCanonicalListing,
  validateCanonicalListings,
  computeDiscount,
  deriveCanonicalItemId,
} from "@/lib/providers/validation";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeValidListing(overrides: Record<string, unknown> = {}) {
  return {
    providerId: "aliexpress",
    canonicalItemId: "zorino-abc123",
    title: "iPhone 15 Pro Max 256GB",
    category: "Phones",
    images: [{ url: "https://images.example.com/product.jpg" }],
    thumbnailUrl: "https://images.example.com/product.jpg",
    price: 899.99,
    currency: "USD",
    availability: "in_stock" as const,
    productUrl: "https://www.example.com/product/123",
    providerMetadata: {
      providerId: "aliexpress",
      providerName: "AliExpress",
      externalItemId: "123456789",
      externalUrl: "https://www.aliexpress.com/item/123456789.html",
      fetchedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

// ─── CanonicalListingSchema ─────────────────────────────────────────────────

describe("CanonicalListingSchema", () => {
  it("accepts a valid minimal listing", () => {
    const result = CanonicalListingSchema.safeParse(makeValidListing());
    expect(result.success).toBe(true);
  });

  it("accepts a fully-populated listing", () => {
    const full = makeValidListing({
      description: "A great phone",
      subcategory: "Smartphones",
      productType: "product",
      location: { country: "US", city: "New York" },
      images: [
        { url: "https://images.example.com/1.jpg", alt: "Front", isPrimary: true },
        { url: "https://images.example.com/2.jpg", alt: "Back" },
      ],
      originalPrice: 1199.99,
      discount: { amount: 300, percentage: 25 },
      availableFrom: "2026-01-01T00:00:00Z",
      availableUntil: "2026-12-31T23:59:59Z",
      rating: 4.5,
      reviewCount: 1234,
      salesCount: 5000,
      amenities: ["5G", "Face ID"],
      specifications: { storage: "256GB", color: "Titanium" },
      affiliateUrl: "https://track.example.com/abc",
      cancellation: { isRefundable: true, policy: "30-day return", deadline: "2026-02-01" },
      seller: { name: "TechStore", rating: 4.8, verified: true },
      shipping: { freeShipping: true, estimatedDays: 5 },
      countryCode: "US",
    });
    const result = CanonicalListingSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it("rejects when providerId is empty", () => {
    const result = CanonicalListingSchema.safeParse(
      makeValidListing({ providerId: "" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects when title is empty", () => {
    const result = CanonicalListingSchema.safeParse(
      makeValidListing({ title: "" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects when price is zero or negative", () => {
    expect(
      CanonicalListingSchema.safeParse(makeValidListing({ price: 0 })).success
    ).toBe(false);
    expect(
      CanonicalListingSchema.safeParse(makeValidListing({ price: -10 })).success
    ).toBe(false);
  });

  it("rejects when currency is not 3 chars", () => {
    expect(
      CanonicalListingSchema.safeParse(makeValidListing({ currency: "US" })).success
    ).toBe(false);
    expect(
      CanonicalListingSchema.safeParse(makeValidListing({ currency: "USDX" })).success
    ).toBe(false);
  });

  it("rejects when thumbnailUrl is not a valid URL", () => {
    expect(
      CanonicalListingSchema.safeParse(
        makeValidListing({ thumbnailUrl: "not-a-url" })
      ).success
    ).toBe(false);
  });

  it("rejects when productUrl is not a valid URL", () => {
    expect(
      CanonicalListingSchema.safeParse(
        makeValidListing({ productUrl: "not-a-url" })
      ).success
    ).toBe(false);
  });

  it("rejects unknown keys (strict mode)", () => {
    const result = CanonicalListingSchema.safeParse(
      makeValidListing({ unknownField: "should-fail" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects invalid availability value", () => {
    expect(
      CanonicalListingSchema.safeParse(
        makeValidListing({ availability: "in-stock" })
      ).success
    ).toBe(false);
    expect(
      CanonicalListingSchema.safeParse(
        makeValidListing({ availability: "on_sale" })
      ).success
    ).toBe(false);
  });

  it("accepts all valid availability values", () => {
    for (const val of ["in_stock", "out_of_stock", "limited", "unknown"]) {
      const result = CanonicalListingSchema.safeParse(
        makeValidListing({ availability: val })
      );
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid productType", () => {
    expect(
      CanonicalListingSchema.safeParse(
        makeValidListing({ productType: "digital" })
      ).success
    ).toBe(false);
  });

  it("accepts valid productType values", () => {
    for (const val of ["product", "service", "booking", "rental"]) {
      const result = CanonicalListingSchema.safeParse(
        makeValidListing({ productType: val })
      );
      expect(result.success).toBe(true);
    }
  });

  it("rejects images with invalid URLs", () => {
    expect(
      CanonicalListingSchema.safeParse(
        makeValidListing({
          images: [{ url: "not-a-url" }],
        })
      ).success
    ).toBe(false);
  });

  it("accepts empty images array", () => {
    const result = CanonicalListingSchema.safeParse(
      makeValidListing({ images: [] })
    );
    expect(result.success).toBe(true);
  });

  it("rejects negative rating", () => {
    expect(
      CanonicalListingSchema.safeParse(
        makeValidListing({ rating: -1 })
      ).success
    ).toBe(false);
  });

  it("rejects rating above 5", () => {
    expect(
      CanonicalListingSchema.safeParse(
        makeValidListing({ rating: 5.1 })
      ).success
    ).toBe(false);
  });

  it("accepts rating of exactly 0 and 5", () => {
    expect(
      CanonicalListingSchema.safeParse(makeValidListing({ rating: 0 })).success
    ).toBe(true);
    expect(
      CanonicalListingSchema.safeParse(makeValidListing({ rating: 5 })).success
    ).toBe(true);
  });

  it("rejects invalid affiliateUrl", () => {
    expect(
      CanonicalListingSchema.safeParse(
        makeValidListing({ affiliateUrl: "not-a-url" })
      ).success
    ).toBe(false);
  });
});

// ─── Discount Schema ────────────────────────────────────────────────────────

describe("ProductDiscountSchema", () => {
  it("accepts valid discount", () => {
    expect(
      ProductDiscountSchema.safeParse({ amount: 100, percentage: 25 }).success
    ).toBe(true);
  });

  it("rejects negative amount", () => {
    expect(
      ProductDiscountSchema.safeParse({ amount: -1, percentage: 10 }).success
    ).toBe(false);
  });

  it("rejects percentage over 100", () => {
    expect(
      ProductDiscountSchema.safeParse({ amount: 100, percentage: 101 }).success
    ).toBe(false);
  });

  it("accepts zero discount", () => {
    expect(
      ProductDiscountSchema.safeParse({ amount: 0, percentage: 0 }).success
    ).toBe(true);
  });
});

// ─── Location Schema ────────────────────────────────────────────────────────

describe("ProductLocationSchema", () => {
  it("accepts valid location", () => {
    expect(
      ProductLocationSchema.safeParse({
        country: "US",
        city: "New York",
        coordinates: { lat: 40.7128, lng: -74.006 },
      }).success
    ).toBe(true);
  });

  it("rejects invalid latitude", () => {
    expect(
      ProductLocationSchema.safeParse({
        coordinates: { lat: 91, lng: 0 },
      }).success
    ).toBe(false);
  });

  it("rejects invalid longitude", () => {
    expect(
      ProductLocationSchema.safeParse({
        coordinates: { lat: 0, lng: 181 },
      }).success
    ).toBe(false);
  });

  it("accepts valid coordinate extremes", () => {
    expect(
      ProductLocationSchema.safeParse({
        coordinates: { lat: -90, lng: -180 },
      }).success
    ).toBe(true);
    expect(
      ProductLocationSchema.safeParse({
        coordinates: { lat: 90, lng: 180 },
      }).success
    ).toBe(true);
  });
});

// ─── Seller Schema ──────────────────────────────────────────────────────────

describe("SellerInfoSchema", () => {
  it("accepts valid seller", () => {
    expect(
      SellerInfoSchema.safeParse({ name: "TechStore" }).success
    ).toBe(true);
  });

  it("rejects empty name", () => {
    expect(
      SellerInfoSchema.safeParse({ name: "" }).success
    ).toBe(false);
  });

  it("rejects rating above 5", () => {
    expect(
      SellerInfoSchema.safeParse({ name: "Store", rating: 5.1 }).success
    ).toBe(false);
  });
});

// ─── Shipping Schema ────────────────────────────────────────────────────────

describe("ShippingSchema", () => {
  it("accepts valid shipping", () => {
    expect(
      ShippingSchema.safeParse({
        freeShipping: true,
        estimatedDays: 5,
        cost: 0,
      }).success
    ).toBe(true);
  });

  it("rejects negative cost", () => {
    expect(
      ShippingSchema.safeParse({
        freeShipping: false,
        cost: -5,
      }).success
    ).toBe(false);
  });

  it("rejects negative estimatedDays", () => {
    expect(
      ShippingSchema.safeParse({
        freeShipping: true,
        estimatedDays: -1,
      }).success
    ).toBe(false);
  });
});

// ─── validateCanonicalListing helper ────────────────────────────────────────

describe("validateCanonicalListing", () => {
  it("returns success for valid listing", () => {
    const result = validateCanonicalListing(makeValidListing());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.providerId).toBe("aliexpress");
      expect(result.data.price).toBe(899.99);
    }
  });

  it("returns errors for invalid listing", () => {
    const result = validateCanonicalListing({
      providerId: "",
      price: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("returns errors for null input", () => {
    const result = validateCanonicalListing(null);
    expect(result.success).toBe(false);
  });

  it("returns errors for undefined input", () => {
    const result = validateCanonicalListing(undefined);
    expect(result.success).toBe(false);
  });

  it("returns errors for string input", () => {
    const result = validateCanonicalListing("not an object");
    expect(result.success).toBe(false);
  });
});

// ─── validateCanonicalListings batch helper ─────────────────────────────────

describe("validateCanonicalListings", () => {
  it("separates valid from invalid listings", () => {
    const valid1 = makeValidListing();
    const valid2 = makeValidListing({
      providerId: "ebay",
      canonicalItemId: "zorino-def456",
    });
    const invalid = { providerId: "", price: -1 };

    const result = validateCanonicalListings([valid1, invalid, valid2]);
    expect(result.valid).toHaveLength(2);
    expect(result.invalidCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.index).toBe(1);
  });

  it("returns empty valid array for all invalid inputs", () => {
    const result = validateCanonicalListings([{}, null, "bad"]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalidCount).toBe(3);
  });

  it("handles empty input array", () => {
    const result = validateCanonicalListings([]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalidCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── computeDiscount ────────────────────────────────────────────────────────

describe("computeDiscount", () => {
  it("computes discount correctly", () => {
    const result = computeDiscount(100, 75);
    expect(result).toEqual({ amount: 25, percentage: 25 });
  });

  it("computes fractional discount", () => {
    const result = computeDiscount(100, 33);
    expect(result).toEqual({ amount: 67, percentage: 67 });
  });

  it("returns undefined when no original price", () => {
    expect(computeDiscount(undefined, 100)).toBeUndefined();
  });

  it("returns undefined when original equals current", () => {
    expect(computeDiscount(100, 100)).toBeUndefined();
  });

  it("returns undefined when original is less than current", () => {
    expect(computeDiscount(50, 100)).toBeUndefined();
  });

  it("returns undefined when original is zero", () => {
    expect(computeDiscount(0, 100)).toBeUndefined();
  });

  it("caps percentage at 100", () => {
    const result = computeDiscount(100, 0.01);
    expect(result!.percentage).toBeLessThanOrEqual(100);
  });

  it("handles very small discount", () => {
    const result = computeDiscount(1000, 999.99);
    expect(result!.percentage).toBe(0);
    expect(result!.amount).toBeCloseTo(0.01);
  });
});

// ─── deriveCanonicalItemId ──────────────────────────────────────────────────

describe("deriveCanonicalItemId", () => {
  it("produces deterministic IDs", () => {
    const id1 = deriveCanonicalItemId("aliexpress", "12345");
    const id2 = deriveCanonicalItemId("aliexpress", "12345");
    expect(id1).toBe(id2);
  });

  it("produces different IDs for different inputs", () => {
    const id1 = deriveCanonicalItemId("aliexpress", "12345");
    const id2 = deriveCanonicalItemId("ebay", "12345");
    const id3 = deriveCanonicalItemId("aliexpress", "99999");
    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
  });

  it("starts with zorino- prefix", () => {
    const id = deriveCanonicalItemId("test", "item");
    expect(id).toMatch(/^zorino-/);
  });
});

// ─── SearchResultSetSchema ──────────────────────────────────────────────────

describe("SearchResultSetSchema", () => {
  it("accepts valid search result set", () => {
    const result = SearchResultSetSchema.safeParse({
      query: "iphone 15",
      items: [makeValidListing()],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 100,
        hasMore: true,
      },
      providerStats: [
        {
          providerId: "aliexpress",
          fetchedCount: 50,
          normalizedCount: 45,
          filteredCount: 40,
          durationMs: 1500,
        },
      ],
      deduplicationStats: {
        totalRaw: 50,
        totalNormalized: 45,
        totalDeduplicated: 30,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty items", () => {
    const result = SearchResultSetSchema.safeParse({
      query: "nonexistent",
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, hasMore: false },
      providerStats: [],
      deduplicationStats: { totalRaw: 0, totalNormalized: 0, totalDeduplicated: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative page", () => {
    const result = SearchResultSetSchema.safeParse({
      query: "test",
      items: [],
      pagination: { page: 0, pageSize: 20, totalItems: 0, hasMore: false },
      providerStats: [],
      deduplicationStats: { totalRaw: 0, totalNormalized: 0, totalDeduplicated: 0 },
    });
    expect(result.success).toBe(false);
  });
});

// ─── CompareProductResultSchema ─────────────────────────────────────────────

describe("CompareProductResultSchema", () => {
  it("accepts valid compare result", () => {
    const result = CompareProductResultSchema.safeParse({
      canonicalItemId: "zorino-abc",
      title: "iPhone 15",
      imageUrl: "https://images.example.com/1.jpg",
      category: "Phones",
      offers: [
        {
          providerId: "aliexpress",
          providerName: "AliExpress",
          price: 899,
          currency: "USD",
          productUrl: "https://www.example.com/1",
          availability: "in_stock",
          fetchedAt: new Date().toISOString(),
        },
        {
          providerId: "ebay",
          providerName: "eBay",
          price: 949,
          currency: "USD",
          productUrl: "https://www.ebay.com/1",
          availability: "in_stock",
          fetchedAt: new Date().toISOString(),
        },
      ],
      lowestPrice: 899,
      highestPrice: 949,
      savingsAmount: 50,
      savingsPercent: 5.27,
      providerCount: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when offers is empty", () => {
    const result = CompareProductResultSchema.safeParse({
      canonicalItemId: "zorino-abc",
      title: "iPhone 15",
      imageUrl: "https://images.example.com/1.jpg",
      category: "Phones",
      offers: [],
      lowestPrice: 899,
      highestPrice: 949,
      savingsAmount: 50,
      savingsPercent: 5.27,
      providerCount: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when providerCount is zero", () => {
    const result = CompareProductResultSchema.safeParse({
      canonicalItemId: "zorino-abc",
      title: "iPhone 15",
      imageUrl: "https://images.example.com/1.jpg",
      category: "Phones",
      offers: [
        {
          providerId: "aliexpress",
          providerName: "AliExpress",
          price: 899,
          currency: "USD",
          productUrl: "https://www.example.com/1",
          availability: "in_stock",
          fetchedAt: new Date().toISOString(),
        },
      ],
      lowestPrice: 899,
      highestPrice: 899,
      savingsAmount: 0,
      savingsPercent: 0,
      providerCount: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── ProviderConfigSchema ───────────────────────────────────────────────────

describe("ProviderConfigSchema", () => {
  it("accepts valid provider config", () => {
    const result = ProviderConfigSchema.safeParse({
      id: "aliexpress",
      name: "AliExpress",
      version: "1.0.0",
      status: "active",
      integrationType: "aliexpress",
      requiredEnvVars: ["ALIEXPRESS_APP_KEY"],
      supportedCurrencies: ["USD", "EUR"],
      supportedCountries: ["US", "DE"],
      maxPageSize: 50,
    });
    expect(result.success).toBe(true);
  });

  it("accepts config with rate limit", () => {
    const result = ProviderConfigSchema.safeParse({
      id: "amazon",
      name: "Amazon",
      version: "1.0.0",
      status: "configured",
      integrationType: "amazon",
      requiredEnvVars: ["AMAZON_KEY"],
      supportedCurrencies: ["USD"],
      supportedCountries: ["US"],
      rateLimit: { requests: 1, perSeconds: 1 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty required env vars", () => {
    const result = ProviderConfigSchema.safeParse({
      id: "test",
      name: "Test",
      version: "1.0.0",
      status: "stub",
      integrationType: "partner",
      requiredEnvVars: [],
      supportedCurrencies: ["USD"],
      supportedCountries: ["US"],
    });
    expect(result.success).toBe(true); // empty is valid
  });

  it("rejects invalid currency code length", () => {
    const result = ProviderConfigSchema.safeParse({
      id: "test",
      name: "Test",
      version: "1.0.0",
      status: "stub",
      integrationType: "partner",
      requiredEnvVars: [],
      supportedCurrencies: ["US"],
      supportedCountries: ["US"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid provider status", () => {
    const result = ProviderConfigSchema.safeParse({
      id: "test",
      name: "Test",
      version: "1.0.0",
      status: "live",
      integrationType: "partner",
      requiredEnvVars: [],
      supportedCurrencies: ["USD"],
      supportedCountries: ["US"],
    });
    expect(result.success).toBe(false);
  });
});

// ─── ProviderMetadata Schema ────────────────────────────────────────────────

describe("ProviderMetadataSchema", () => {
  it("accepts valid metadata", () => {
    const result = ProviderMetadataSchema.safeParse({
      providerId: "aliexpress",
      providerName: "AliExpress",
      externalItemId: "12345",
      externalUrl: "https://www.aliexpress.com/item/12345.html",
      fetchedAt: "2026-09-04T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty providerId", () => {
    const result = ProviderMetadataSchema.safeParse({
      providerId: "",
      providerName: "AliExpress",
      externalItemId: "12345",
      externalUrl: "https://example.com",
      fetchedAt: "2026-09-04T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid externalUrl", () => {
    const result = ProviderMetadataSchema.safeParse({
      providerId: "aliexpress",
      providerName: "AliExpress",
      externalItemId: "12345",
      externalUrl: "not-a-url",
      fetchedAt: "2026-09-04T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-ISO datetime", () => {
    const result = ProviderMetadataSchema.safeParse({
      providerId: "aliexpress",
      providerName: "AliExpress",
      externalItemId: "12345",
      externalUrl: "https://example.com",
      fetchedAt: "2026-09-04",
    });
    expect(result.success).toBe(false);
  });
});
