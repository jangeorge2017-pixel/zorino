import { afterEach, describe, expect, it, vi } from "vitest";

import { isHeadlessBrowserBlocked } from "@/lib/security/headless-browser-guard";
import { isAmazonScraperAvailable } from "@/lib/integrations/amazon-scraper";
import { amazonEgSearchConnector } from "@/lib/search/connectors/amazon-eg";
import { amazonSearchConnector } from "@/lib/search/connectors/amazon";
import {
  getSyncedStoreResultsFromDatabase,
  resetRealCatalogProductCountForTests,
  setSupabaseAnonClientForTests,
} from "@/lib/integration/database-catalog";
import { interleaveWithProviderCap } from "@/lib/search/engine";
import type { SearchResultItem } from "@/lib/data/homepage";

afterEach(() => {
  vi.unstubAllEnvs();
  resetRealCatalogProductCountForTests();
});

describe("Render low-memory browser guard", () => {
  it("blocks headless browsers on Render and when explicitly disabled", () => {
    vi.stubEnv("RENDER", "true");
    vi.stubEnv("DISABLE_PLAYWRIGHT", "");
    expect(isHeadlessBrowserBlocked()).toBe(true);

    vi.stubEnv("RENDER", "");
    vi.stubEnv("DISABLE_PLAYWRIGHT", "true");
    expect(isHeadlessBrowserBlocked()).toBe(true);
  });

  it("keeps the lightweight http Amazon scraper available while browsers are blocked", () => {
    vi.stubEnv("RENDER", "true");
    vi.stubEnv("AMAZON_SCRAPER_DISABLED", "");
    expect(isHeadlessBrowserBlocked()).toBe(true);
    expect(isAmazonScraperAvailable()).toBe(true);
  });

  it("restores Amazon connectors independently of the indirect-path opt-in", async () => {
    vi.stubEnv("AMAZON_DIRECT_ENABLE", "");
    vi.stubEnv("AMAZON_SCRAPER_DISABLED", "");
    expect(await amazonSearchConnector.isAvailable()).toBe(true);
    expect(await amazonEgSearchConnector.isAvailable()).toBe(true);
  });
});

describe("low-memory balanced pool", () => {
  it("caps eBay at four rows while every other store stays in the first rows", () => {
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
      { ebay: 4 },
    );
    const head = out.slice(0, stores.length);
    expect(head.filter((item) => item.storeSlug === "ebay")).toHaveLength(1);
    for (const store of stores) {
      expect(head.some((item) => item.storeSlug === store)).toBe(true);
    }
    expect(out.filter((item) => item.storeSlug === "ebay")).toHaveLength(4);
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
