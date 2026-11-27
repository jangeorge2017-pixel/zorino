import { afterEach, describe, expect, it, vi } from "vitest";

import { isAmazonScraperAvailable } from "@/lib/integrations/amazon-scraper";
import { isUsableRemoteProductImageUrl } from "@/lib/images/product-image";
import { amazonEgSearchConnector } from "@/lib/search/connectors/amazon-eg";
import { amazonSearchConnector } from "@/lib/search/connectors/amazon";
import {
  getSyncedStoreResultsFromDatabase,
  resetRealCatalogProductCountForTests,
  setSupabaseAnonClientForTests,
} from "@/lib/integration/database-catalog";
import {
  interleaveWithProviderCap,
  normalizeHttpsAffiliateUrl,
} from "@/lib/search/engine";
import type { SearchResultItem } from "@/lib/data/homepage";

afterEach(() => {
  vi.unstubAllEnvs();
  resetRealCatalogProductCountForTests();
});

describe("live store availability", () => {
  it("keeps the lightweight http Amazon scraper available on Render", () => {
    vi.stubEnv("RENDER", "true");
    vi.stubEnv("AMAZON_SCRAPER_DISABLED", "");
    expect(isAmazonScraperAvailable()).toBe(true);
  });

  it("keeps Amazon connectors available independently of the indirect-path opt-in", async () => {
    vi.stubEnv("AMAZON_DIRECT_ENABLE", "");
    vi.stubEnv("AMAZON_SCRAPER_DISABLED", "");
    expect(await amazonSearchConnector.isAvailable()).toBe(true);
    expect(await amazonEgSearchConnector.isAvailable()).toBe(true);
  });
});

describe("balanced live-store pool", () => {
  it("keeps eBay bounded to a rich first-page share while every other store stays visible", () => {
    const stores = ["ebay", "amazon-eg", "aliexpress", "noon", "jumia", "btech"];
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: `item-${i}`,
      storeSlug: "ebay",
      store: "eBay",
    })) as SearchResultItem[];
    for (const store of stores.slice(1)) {
      items.push({ id: store, storeSlug: store, store } as SearchResultItem);
    }

    const out = interleaveWithProviderCap(
      items,
      (item) => item.storeSlug || item.store,
      { ebay: 15 },
    );
    const head = out.slice(0, stores.length);
    expect(head.filter((item) => item.storeSlug === "ebay")).toHaveLength(1);
    for (const store of stores) {
      expect(head.some((item) => item.storeSlug === store)).toBe(true);
    }
    expect(out.filter((item) => item.storeSlug === "ebay")).toHaveLength(5);
  });
});

describe("remote product image guard", () => {
  it("rejects empty, local-placeholder, http, and data URLs", () => {
    expect(isUsableRemoteProductImageUrl("")).toBe(false);
    expect(isUsableRemoteProductImageUrl("/products/placeholder.svg")).toBe(false);
    expect(isUsableRemoteProductImageUrl("http://images.example.com/p.jpg")).toBe(false);
    expect(isUsableRemoteProductImageUrl("data:image/gif;base64,R0lGODlh")).toBe(false);
    expect(isUsableRemoteProductImageUrl("/media/products/1.jpg")).toBe(false);
  });

  it("accepts real https product images", () => {
    expect(isUsableRemoteProductImageUrl("https://eg.jumia.is/product/1.jpg")).toBe(true);
  });
});

describe("outbound product links", () => {
  it("upgrades insecure or protocol-relative links to https", () => {
    expect(normalizeHttpsAffiliateUrl("http://www.jumia.com.eg/phone.html")).toBe(
      "https://www.jumia.com.eg/phone.html",
    );
    expect(normalizeHttpsAffiliateUrl("//www.noon.com/egypt-en/p/1/")).toBe(
      "https://www.noon.com/egypt-en/p/1/",
    );
    expect(normalizeHttpsAffiliateUrl("https://www.ebay.com/itm/123")).toBe(
      "https://www.ebay.com/itm/123",
    );
    expect(normalizeHttpsAffiliateUrl(undefined)).toBeUndefined();
  });
});

describe("fast synced Jumia / Admitad DB leg", () => {
  it("returns only the requested provider rows well inside the 200ms budget", async () => {
    const rows = [
      {
        id: "1",
        product_id: "j1",
        product_name: "Jumia Earbuds",
        image_url: "https://img.example/j1.jpg",
        lowest_price: 100,
        original_price: 150,
        discount_percent: 33,
        store_name: "Jumia",
        provider: "jumia",
        affiliate_url: "https://jumia.com.eg/j1",
        external_url: null,
        country_code: "EG",
        currency: "EGP",
      },
      {
        id: "2",
        product_id: "a1",
        product_name: "Admitad Earbuds",
        image_url: "https://img.example/a1.jpg",
        lowest_price: 20,
        original_price: 40,
        discount_percent: 50,
        store_name: "AliExpress",
        provider: "admitad",
        affiliate_url: "https://example.com/a1",
        external_url: null,
        country_code: "US",
        currency: "USD",
      },
      {
        id: "3",
        product_id: "e1",
        product_name: "eBay Earbuds",
        image_url: "https://img.example/e1.jpg",
        lowest_price: 30,
        original_price: 40,
        discount_percent: 25,
        store_name: "eBay",
        provider: "ebay",
        affiliate_url: "https://ebay.com/e1",
        external_url: null,
        country_code: "US",
        currency: "USD",
      },
    ];

    let seenProviders: string[] = [];
    const chain: Record<string, unknown> = {
      select: () => chain,
      in: (col: string, values: string[]) => {
        if (col === "provider") seenProviders = values;
        return chain;
      },
      or: () => chain,
      not: () => chain,
      neq: () => chain,
      limit: () => Promise.resolve({ data: rows.slice(0, 2), error: null }),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    setSupabaseAnonClientForTests(
      () =>
        ({
          from: () => chain,
        }) as never,
    );

    const started = Date.now();
    const items = await getSyncedStoreResultsFromDatabase(
      ["jumia", "admitad"],
      "earbuds",
      10,
      200,
    );
    expect(Date.now() - started).toBeLessThan(200);
    expect(seenProviders).toEqual(["jumia", "admitad"]);
    expect(items.map((item) => item.storeSlug)).toEqual(["jumia", "admitad"]);
  });
});
