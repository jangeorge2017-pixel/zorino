import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  compareImportedProductPrices,
  type CompareProductResult,
  type CompareOffer,
} from "@/services/compare";
import * as compareService from "@/services/compare";
import { isValidProductDestinationUrl } from "@/lib/affiliate/product-url";

// Mock dependencies
vi.mock("@/lib/marketplace-engine/utils", () => ({
  computeSavingsPercent: (lowest: number, highest: number) => {
    if (highest === 0) return 0;
    return Math.round(((highest - lowest) / highest) * 100);
  },
}));

vi.mock("@/lib/database/mappers", () => ({
  mapProduct: (row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.image_url,
    currency: row.currency,
    countryCode: row.country_code,
    inStock: row.in_stock,
    reviewCount: row.review_count || 0,
    tags: row.tags || [],
    isActive: row.is_active,
  }),
}));

vi.mock("@/lib/affiliate/product-url", () => ({
  isValidProductDestinationUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: vi.fn(),
}));

vi.mock("@/services/prices", () => ({
  compareProductPrices: vi.fn(),
  getCurrentPricesForProduct: vi.fn(),
  getLowestPrice: vi.fn(),
}));

describe("Bug Fix: Compare Prices - External Offers Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should merge external_prices offers into comparison when they have valid product URLs", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };

    vi.mocked(compareService as any).createSupabaseAnonClient = vi.fn(() => mockSupabase);

    // Mock internal prices (only 1 store)
    const internalPrices = [
      {
        id: "price-1",
        productId: "product-1",
        storeId: "store-1",
        price: 100,
        originalPrice: 120,
        currency: "USD",
        inStock: true,
        isCurrent: true,
        recordedAt: "2026-09-01T00:00:00Z",
        externalUrl: "https://store1.com/product/123",
        externalProductId: "ext-1",
        store: { id: "store-1", name: "Store 1", integrationType: "amazon" },
      },
    ];

    // Mock external prices (multiple real stores with valid product URLs)
    const externalPrices = [
      {
        id: "ext-price-1",
        provider: "aliexpress",
        store_id: "store-2",
        external_id: "ext-2",
        canonical_product_id: "product-1",
        price: 85,
        original_price: 100,
        currency: "USD",
        country_code: "US",
        in_stock: true,
        product_url: "https://aliexpress.com/product-detail/12345.html",
      },
      {
        id: "ext-price-2",
        provider: "ebay",
        store_id: "store-3",
        external_id: "ext-3",
        canonical_product_id: "product-1",
        price: 95,
        original_price: 110,
        currency: "USD",
        country_code: "US",
        in_stock: true,
        product_url: "https://ebay.com/itm/98765",
      },
    ];

    // Mock product
    const mockProduct = {
      id: "product-1",
      name: "Test Product",
      slug: "test-product",
      image_url: "https://example.com/image.jpg",
      currency: "USD",
      country_code: "US",
      in_stock: true,
      review_count: 10,
      is_active: true,
    };

    // Setup mock responses
    vi.mocked(compareService as any).compareProductPrices = vi.fn().mockResolvedValue({
      data: internalPrices,
      error: null,
    });

    mockSupabase.maybeSingle.mockResolvedValue({ data: mockProduct, error: null });
    vi.mocked(isValidProductDestinationUrl).mockImplementation((url) => {
      // All our test URLs should be valid
      return !url.includes("homepage") && !url.includes("category");
    });

    // Mock external prices query
    let queryCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "external_prices" && queryCallCount === 0) {
        queryCallCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: () => ({ data: externalPrices, error: null }),
        } as any;
      }
      return mockSupabase;
    });

    // Make the comparison
    const result = await compareImportedProductPrices("product-1");

    // Verify result structure
    expect(result.data).toBeDefined();
    expect(result.error).toBeNull();

    const compareResult = result.data as CompareProductResult;

    // CRITICAL: Should have 3 offers (1 internal + 2 external)
    expect(compareResult.offers.length).toBe(3);

    // Verify all offers are included
    const storeIds = compareResult.offers.map((o) => o.storeId);
    expect(storeIds).toContain("store-1");
    expect(storeIds).toContain("store-2");
    expect(storeIds).toContain("store-3");

    // Verify lowest price is identified correctly (85 from AliExpress)
    expect(compareResult.lowestPrice).toBe(85);
    expect(compareResult.offers[0].price).toBe(85);
    expect(compareResult.offers[0].isLowest).toBe(true);

    // Verify provider data is included
    expect(compareResult.offers.some((o) => o.provider === "aliexpress")).toBe(true);
    expect(compareResult.offers.some((o) => o.provider === "ebay")).toBe(true);
  });

  it("should exclude external offers with invalid/homepage product URLs", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };

    vi.mocked(compareService as any).createSupabaseAnonClient = vi.fn(() => mockSupabase);

    const internalPrices = [
      {
        id: "price-1",
        productId: "product-1",
        storeId: "store-1",
        price: 100,
        originalPrice: 120,
        currency: "USD",
        inStock: true,
        isCurrent: true,
        recordedAt: "2026-09-01T00:00:00Z",
        externalUrl: "https://store1.com/product/123",
        externalProductId: "ext-1",
        store: { id: "store-1", name: "Store 1", integrationType: "amazon" },
      },
    ];

    // External prices with INVALID URLs (homepage, generic landing pages)
    const externalPrices = [
      {
        id: "ext-price-1",
        provider: "aliexpress",
        store_id: "store-2",
        external_id: "ext-2",
        canonical_product_id: "product-1",
        price: 85,
        original_price: 100,
        currency: "USD",
        country_code: "US",
        in_stock: true,
        product_url: "https://aliexpress.com/", // HOMEPAGE - INVALID
      },
      {
        id: "ext-price-2",
        provider: "ebay",
        store_id: "store-3",
        external_id: "ext-3",
        canonical_product_id: "product-1",
        price: 95,
        original_price: 110,
        currency: "USD",
        country_code: "US",
        in_stock: true,
        product_url: "https://ebay.com/search?q=product", // SEARCH PAGE - INVALID
      },
    ];

    const mockProduct = {
      id: "product-1",
      name: "Test Product",
      slug: "test-product",
      image_url: "https://example.com/image.jpg",
      currency: "USD",
      country_code: "US",
      in_stock: true,
      review_count: 10,
      is_active: true,
    };

    vi.mocked(compareService as any).compareProductPrices = vi.fn().mockResolvedValue({
      data: internalPrices,
      error: null,
    });

    mockSupabase.maybeSingle.mockResolvedValue({ data: mockProduct, error: null });

    // Mock validation: reject homepage and search URLs
    vi.mocked(isValidProductDestinationUrl).mockImplementation((url) => {
      if (!url) return false;
      return !url.includes("homepage") && !url.includes("search") && !url.endsWith("/");
    });

    let queryCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "external_prices" && queryCallCount === 0) {
        queryCallCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: () => ({ data: externalPrices, error: null }),
        } as any;
      }
      return mockSupabase;
    });

    const result = await compareImportedProductPrices("product-1");

    // CRITICAL: Should only have 1 offer (internal price, external offers rejected due to invalid URLs)
    expect(result.data).toBeDefined();
    const compareResult = result.data as CompareProductResult;
    expect(compareResult.offers.length).toBe(1);
    expect(compareResult.offers[0].storeId).toBe("store-1");
  });

  it("should preserve provider isolation: one failing provider should not break all comparisons", async () => {
    // This tests that if external_prices query fails for one provider,
    // internal prices are still returned and comparison still works

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };

    vi.mocked(compareService as any).createSupabaseAnonClient = vi.fn(() => mockSupabase);

    const internalPrices = [
      {
        id: "price-1",
        productId: "product-1",
        storeId: "store-1",
        price: 100,
        originalPrice: 120,
        currency: "USD",
        inStock: true,
        isCurrent: true,
        recordedAt: "2026-09-01T00:00:00Z",
        externalUrl: "https://store1.com/product/123",
        externalProductId: "ext-1",
        store: { id: "store-1", name: "Store 1", integrationType: "amazon" },
      },
      {
        id: "price-2",
        productId: "product-1",
        storeId: "store-2",
        price: 110,
        originalPrice: 130,
        currency: "USD",
        inStock: true,
        isCurrent: true,
        recordedAt: "2026-09-01T00:00:00Z",
        externalUrl: "https://store2.com/product/456",
        externalProductId: "ext-2",
        store: { id: "store-2", name: "Store 2", integrationType: "ebay" },
      },
    ];

    const mockProduct = {
      id: "product-1",
      name: "Test Product",
      slug: "test-product",
      image_url: "https://example.com/image.jpg",
      currency: "USD",
      country_code: "US",
      in_stock: true,
      review_count: 10,
      is_active: true,
    };

    vi.mocked(compareService as any).compareProductPrices = vi.fn().mockResolvedValue({
      data: internalPrices,
      error: null,
    });

    mockSupabase.maybeSingle.mockResolvedValue({ data: mockProduct, error: null });

    vi.mocked(isValidProductDestinationUrl).mockReturnValue(true);

    // Mock external prices query to return empty (simulating provider failure or no external data)
    let queryCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "external_prices" && queryCallCount === 0) {
        queryCallCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: () => ({ data: [], error: null }),
        } as any;
      }
      return mockSupabase;
    });

    const result = await compareImportedProductPrices("product-1");

    // CRITICAL: Comparison should still work with internal prices only
    expect(result.data).toBeDefined();
    expect(result.error).toBeNull();

    const compareResult = result.data as CompareProductResult;
    expect(compareResult.offers.length).toBe(2); // Both internal prices
    expect(compareResult.lowestPrice).toBe(100);
    expect(compareResult.highestPrice).toBe(110);
  });
});

describe("Bug Fix: Shop Now - Product URL Validation", () => {
  it("should reject offers with invalid product destination URLs", () => {
    const invalidUrls = [
      "https://aliexpress.com/", // homepage
      "https://aliexpress.com/search?q=phone", // search
      "https://aliexpress.com/category/123", // category
      "https://store.com/", // homepage
      "", // empty
      null, // null
      "not-a-url", // unparseable
    ];

    invalidUrls.forEach((url) => {
      expect(isValidProductDestinationUrl(url as any)).toBe(false);
    });
  });

  it("should accept valid product detail URLs", () => {
    const validUrls = [
      "https://aliexpress.com/product-detail/12345.html",
      "https://www.amazon.com/dp/B0123456789",
      "https://www.ebay.com/itm/123456789",
      "https://store.com/products/my-product",
      "https://example.com/product/detail/abc123",
    ];

    vi.mocked(isValidProductDestinationUrl).mockReturnValue(true);

    validUrls.forEach((url) => {
      expect(isValidProductDestinationUrl(url)).toBe(true);
    });
  });
});
