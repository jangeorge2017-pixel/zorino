import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchResultItem } from "@/lib/data/homepage";
import * as dbCatalog from "@/lib/integration/database-catalog";
import * as providerConfig from "@/lib/integration/provider-config";
import * as providerHealth from "@/lib/integration/provider-health";
import * as adapterRegistry from "@/lib/providers/adapter-registry";
import type { ProviderAdapter } from "@/lib/providers/adapter";
import * as engine from "@/lib/search/engine";
import type { RawProviderListing } from "@/lib/search/types";
import {
  buildAndCacheSearchResult,
  clearSearchMemoryCacheForTests,
  getCachedSearchResult,
} from "@/lib/search/persistent-cache";
import * as cacheStore from "@/lib/search/persistent-cache-store";

function cacheItem(storeSlug: string): SearchResultItem {
  return { id: storeSlug, storeSlug, store: storeSlug } as SearchResultItem;
}

function dbItem(storeSlug: string): SearchResultItem {
  return {
    id: `db-${storeSlug}`,
    name: "Wireless Earbuds Bluetooth 5.3",
    imageSrc: "https://img.alicdn.com/imgextra/fixture-db-01.jpg",
    emoji: "🎧",
    price: 39.99,
    originalPrice: 59.99,
    discount: 33,
    store: storeSlug,
    storeSlug,
    category: "electronics",
    rating: 4.5,
    reviewCount: 120,
    inStock: true,
    affiliateUrl: `https://example.com/${storeSlug}/earbuds`,
    productUrl: `https://example.com/${storeSlug}/earbuds`,
    currency: "USD",
    countryCode: "US",
  } as SearchResultItem;
}

function hangingAdapter(): ProviderAdapter {
  return {
    id: "ebay",
    name: "eBay",
    async isAvailable() {
      return true;
    },
    normalize(listing: RawProviderListing) {
      return listing;
    },
    normalizeBatch(listings: RawProviderListing[]) {
      return listings;
    },
    search() {
      return new Promise(() => {});
    },
  } as unknown as ProviderAdapter;
}

beforeEach(() => {
  clearSearchMemoryCacheForTests();
  engine.setProviderFetchTimeoutForTests(100);
});

afterEach(() => {
  engine.setProviderFetchTimeoutForTests();
  vi.restoreAllMocks();
});

describe("in-memory search pool cache", () => {
  it("serves repeated reads without touching Supabase again", async () => {
    vi.spyOn(cacheStore, "isPersistentSearchCacheEnabled").mockReturnValue(true);
    const read = vi
      .spyOn(cacheStore, "readPersistentSearchCache")
      .mockResolvedValue(null);
    vi.spyOn(cacheStore, "writePersistentSearchCache").mockResolvedValue(undefined);
    const search = vi
      .spyOn(engine, "searchProducts")
      .mockResolvedValue([cacheItem("ebay"), cacheItem("noon")]);
    const query = `memory-cache-${Date.now()}`;

    await buildAndCacheSearchResult(query, 10);
    const cached = await getCachedSearchResult(query, 10);

    expect(cached?.map((item) => item.storeSlug)).toEqual(["ebay", "noon"]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
  });

  it("promotes a fresh Supabase entry into memory", async () => {
    vi.spyOn(cacheStore, "isPersistentSearchCacheEnabled").mockReturnValue(true);
    const read = vi
      .spyOn(cacheStore, "readPersistentSearchCache")
      .mockResolvedValue({
        items: [
          cacheItem("amazon-eg"),
          cacheItem("aliexpress"),
          cacheItem("jumia"),
          cacheItem("carrefour"),
        ],
        fetchedAt: new Date().toISOString(),
      });
    const query = `memory-rehydrate-${Date.now()}`;

    const first = await getCachedSearchResult(query, 10);
    const second = await getCachedSearchResult(query, 10);

    expect(first?.map((item) => item.storeSlug)).toEqual([
      "amazon-eg",
      "aliexpress",
      "jumia",
      "carrefour",
    ]);
    expect(second).toEqual(first);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe("DB-first search", () => {
  beforeEach(() => {
    vi.spyOn(providerConfig, "getActiveProductionProviders").mockResolvedValue([
      "ebay",
    ]);
    vi.spyOn(dbCatalog, "getSearchResultsFromDatabase").mockResolvedValue([]);
    vi.spyOn(dbCatalog, "getSyncedStoreResultsFromDatabase").mockResolvedValue([]);
  });

  it("does not start the live fan-out until local DB lanes resolve", async () => {
    let releaseProviders!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseProviders = resolve;
    });
    vi.spyOn(providerConfig, "getActiveProductionProviders").mockImplementation(
      async () => {
        await gate;
        return ["ebay"];
      },
    );
    const adapters = vi
      .spyOn(adapterRegistry, "getActiveProviderAdapters")
      .mockResolvedValue([]);

    const pending = engine.searchProducts(`db-first-gate-${Date.now()}`, 20);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(adapters).not.toHaveBeenCalled();

    releaseProviders();
    await pending;
    expect(adapters).toHaveBeenCalled();
  });

  it("keeps DB-backed stores when live adapters return nothing", async () => {
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([]);
    vi.spyOn(dbCatalog, "getSearchResultsFromDatabase").mockResolvedValue([
      dbItem("noon"),
    ]);

    const items = await engine.searchProducts(
      `db-backed-${Date.now()} wireless earbuds`,
      20,
    );

    expect(items.map((item) => item.storeSlug)).toContain("noon");
  });

  it("does not penalize provider health for a timeout-only miss", async () => {
    const record = vi.spyOn(providerHealth, "recordProviderRun");
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([
      hangingAdapter(),
    ]);

    const items = await engine.searchProducts(
      `timeout-health-${Date.now()}`,
      20,
    );

    expect(items).toEqual([]);
    expect(record).not.toHaveBeenCalled();
  });
});
