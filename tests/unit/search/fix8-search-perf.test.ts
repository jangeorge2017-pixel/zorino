/**
 * Fix 8 regression guards — search performance.
 *
 * Fix 8 changed three things in a bid to cut cold-search latency (~20s):
 *   1. provider discovery (`getActiveProductionProviders`) now runs CONCURRENTLY
 *      with the provider fan-out inside the same `Promise.all` (not serially after);
 *   2. `refreshProviderEvidence` short-circuits when the 10-min evidence cache is
 *      still fresh (no 11 redundant per-provider count reads on every query);
 *   3. the DB supplement honours an optional `timeoutMs` — on timeout it resolves
 *      to an EMPTY pool (the same truthful "no DB products" state a DB error
 *      produces), never fabricated/partial rows.
 *
 * These tests lock those guarantees AND guard the surrounding behaviors that
 * must not regress: multi-provider diversity, real-data preservation, the 8s
 * engine→DB timeout wiring, and the active-provider DB filter.
 *
 * Mocking: suite runs with isolate:false + singleFork:true where per-module
 * `vi.mock` is unreliable, so this file uses live-binding spies
 * (`vi.spyOn(module, "fn")`) and the exported test seams
 * (`setSupabaseAnonClientForTests`, `resetProviderEvidenceForTests`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { searchProducts } from "@/lib/search/engine";
import * as providerConfig from "@/lib/integration/provider-config";
import * as providerEvidence from "@/lib/integration/provider-evidence";
import * as adapterRegistry from "@/lib/providers/adapter-registry";
import {
  getSearchResultsFromDatabase,
  resetRealCatalogProductCountForTests,
  setSupabaseAnonClientForTests,
} from "@/lib/integration/database-catalog";

import type { ProviderAdapter } from "@/lib/providers/adapter";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

// ─── resolvers ──────────────────────────────────────────────────────────────
const dbCatalog = () => import("@/lib/integration/database-catalog");

function resetEvidenceState() {
  providerConfig.resetProviderEvidenceForTests();
  providerEvidence.resetProviderEvidenceForTests();
}

// ─── fixtures ───────────────────────────────────────────────────────────────

const S25_QUERY = "samsung galaxy s25 ultra";

function aliexpressListing(): RawProviderListing {
  return {
    providerId: "aliexpress",
    externalId: "fixture-al-s25",
    title: `${S25_QUERY} 5G 256GB Unlocked GSM Smartphone`,
    imageUrl: "https://img.alicdn.com/imgextra/fixture-aliexpress-01.jpg",
    price: 899.99,
    originalPrice: 1099.99,
    discount: 18,
    currency: "USD",
    storeName: "AliExpress",
    category: "smartphones",
    rating: 4.7,
    reviewCount: 320,
    inStock: true,
    productUrl: "https://www.aliexpress.com/item/fixture-al-s25.html",
    affiliateUrl: "https://s.click.aliexpress.com/e/fixture-al-s25",
    countryCode: "US",
  };
}

function ebayListing(): RawProviderListing {
  return {
    providerId: "ebay",
    externalId: "fixture-ebay-s25",
    title: `${S25_QUERY} 256GB Unlocked Smartphone (Renewed)`,
    imageUrl: "https://i.ebayimg.com/images/g/fixture-ebay-s25.jpg",
    price: 929.99,
    originalPrice: 1049.99,
    discount: 11,
    currency: "USD",
    storeName: "eBay",
    category: "smartphones",
    rating: 4.6,
    reviewCount: 180,
    inStock: true,
    productUrl: "https://www.ebay.com/itm/fixture-ebay-s25",
    affiliateUrl: "https://www.ebay.com/itm/fixture-ebay-s25",
    countryCode: "US",
  };
}

function fakeAdapter(id: SearchProviderId, listing: RawProviderListing): ProviderAdapter {
  return {
    id,
    name: id === "aliexpress" ? "AliExpress" : "eBay",
    async isAvailable() {
      return true;
    },
    normalize() {
      return listing;
    },
    normalizeBatch() {
      return [listing];
    },
    async search() {
      return { providerId: id, listings: [listing], durationMs: 12 };
    },
  };
}

function dbItem(
  over: Partial<SearchResultItem> & { storeSlug: string },
): SearchResultItem {
  const base: SearchResultItem = {
    id: "db-fixture-1",
    name: `${S25_QUERY} 256GB Unlocked Smartphone`,
    imageSrc: "https://img.alicdn.com/imgextra/fixture-db-01.jpg",
    emoji: "🛍️",
    price: 850.0,
    originalPrice: 999.99,
    discount: 15,
    store: "Admitad Merchant",
    storeSlug: "admitad",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    category: "smartphones",
    currency: "USD",
    countryCode: "US",
    affiliateUrl: "https://go.admitad.com/click/fixture",
  };
  return { ...base, ...over };
}

// Fake supabase chains used via setSupabaseAnonClientForTests.
function hangingSupabaseFactory() {
  const never = new Promise(() => {
    /* never settles */
  });
  const chain: any = {
    select: () => chain,
    or: () => chain,
    eq: () => chain,
    not: () => chain,
    neq: () => chain,
    order: () => chain,
    limit: () => never,
  };
  return () => ({ from: () => chain });
}

function fastSupabaseFactory(row: Record<string, unknown>) {
  const rowChain: any = {
    select: () => rowChain,
    or: () => rowChain,
    eq: () => rowChain,
    not: () => rowChain,
    neq: () => rowChain,
    order: () => rowChain,
    limit: () => Promise.resolve({ data: [row], error: null }),
  };
  const productsChain: any = {
    select: () => productsChain,
    in: () =>
      Promise.resolve({
        data: [{ id: row.product_id, category_slug: "smartphones" }],
        error: null,
      }),
  };
  return () => ({
    from: (table: string) => (table === "products" ? productsChain : rowChain),
  });
}

const DB_ROW = {
  id: "row-1",
  product_id: "admitad-fixture-1",
  product_name: `${S25_QUERY} 256GB Unlocked Smartphone`,
  product_slug: "admitad-fixture-1",
  image_url: "https://img.alicdn.com/imgextra/fixture-db-01.jpg",
  emoji: null,
  lowest_price: 850.0,
  original_price: 999.99,
  discount_percent: 15,
  store_name: "Admitad Merchant",
  provider: "admitad",
  affiliate_url: "https://go.admitad.com/click/fixture",
  external_url: "https://merchant.example.com/p",
  country_code: "US",
  currency: "USD",
};

afterEach(() => {
  vi.restoreAllMocks();
  resetRealCatalogProductCountForTests();
  resetEvidenceState();
});

describe("Fix 8: provider discovery runs concurrently with the fan-out", () => {
  it("calls getActiveProductionProviders while adapters are still in-flight", async () => {
    let releaseAdapters!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseAdapters = resolve;
    });

    const adaptersSpy = vi
      .spyOn(adapterRegistry, "getActiveProviderAdapters")
      .mockImplementation(async () => {
        await gate;
        return [];
      });

    let providersDiscovered: null | "in-flight" | "done" = null;
    vi.spyOn(providerConfig, "getActiveProductionProviders").mockImplementation(
      async () => {
        providersDiscovered = "in-flight";
        return ["aliexpress", "ebay"];
      },
    );

    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    const pending = searchProducts(`fix8-concurrent-${Date.now()}`, 20);

    // While the adapter fan-out is still gated, provider discovery must already
    // have been invoked (it is part of the same Promise.all — not serial-after).
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(providersDiscovered).toBe("in-flight");
    expect(adaptersSpy).toHaveBeenCalled();

    releaseAdapters();
    const items = await pending;
    expect(Array.isArray(items)).toBe(true);
  });
});

describe("Fix 8: evidence refresh short-circuits on a fresh cache", () => {
  it("does not re-read per-provider evidence on the second activation", async () => {
    const hasEvidenceSpy = vi.spyOn(providerEvidence, "hasProviderEvidence");

    await providerConfig.getActiveProductionProviders();
    const callsAfterFirst = hasEvidenceSpy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    await providerConfig.getActiveProductionProviders();
    expect(hasEvidenceSpy.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe("Fix 8: DB supplement honours timeoutMs", () => {
  it("resolves to an empty pool when the read hangs past the timeout", async () => {
    setSupabaseAnonClientForTests(hangingSupabaseFactory() as never);

    const started = Date.now();
    const items = await getSearchResultsFromDatabase(S25_QUERY, 5, { timeoutMs: 100 });
    const elapsed = Date.now() - started;

    expect(items).toEqual([]);
    expect(elapsed).toBeLessThan(3_000);
  });

  it("returns real rows normally when no timeout is given (unchanged default)", async () => {
    setSupabaseAnonClientForTests(fastSupabaseFactory(DB_ROW) as never);

    const items = await getSearchResultsFromDatabase(S25_QUERY, 5);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: `db-admitad-fixture-1`,
      name: DB_ROW.product_name,
      price: 850,
      originalPrice: 999.99,
      discount: 15,
      store: "Admitad Merchant",
      storeSlug: "admitad",
      currency: "USD",
      countryCode: "US",
      affiliateUrl: "https://go.admitad.com/click/fixture",
    });
  });

  it("does not fabricate rows when the DB errors inside the timeout path", async () => {
    setSupabaseAnonClientForTests(
      (() => {
        const errChain: any = {};
        errChain.select = () => errChain;
        errChain.or = () => errChain;
        errChain.eq = () => errChain;
        errChain.not = () => errChain;
        errChain.neq = () => errChain;
        errChain.order = () => errChain;
        errChain.limit = () => Promise.resolve({ data: null, error: { message: "boom" } });
        return { from: () => errChain };
      })() as never,
    );

    const items = await getSearchResultsFromDatabase(S25_QUERY, 5, { timeoutMs: 500 });
    expect(items).toEqual([]);
  });
});

describe("Fix 8: engine wiring preserves diversity, real data, and DB gating", () => {
  beforeEach(() => {
    vi.spyOn(providerConfig, "getActiveProductionProviders").mockResolvedValue([
      "aliexpress",
      "ebay",
    ]);
  });

  it("passes the 8s timeout to the DB supplement", async () => {
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([
      fakeAdapter("aliexpress", aliexpressListing()),
      fakeAdapter("ebay", ebayListing()),
    ]);
    const dbSpy = vi
      .spyOn(await dbCatalog(), "getSearchResultsFromDatabase")
      .mockResolvedValue([]);

    await searchProducts(`fix8-engine-${Date.now()}`, 20);

    expect(dbSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), {
      timeoutMs: 8_000,
    });
  });

  it("returns multi-provider diversity with real names, prices, images, URLs", async () => {
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([
      fakeAdapter("aliexpress", aliexpressListing()),
      fakeAdapter("ebay", ebayListing()),
    ]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    const items = await searchProducts(S25_QUERY, 20);

    const stores = new Set(items.map((i) => i.storeSlug));
    expect(stores.has("aliexpress")).toBe(true);
    expect(stores.has("ebay")).toBe(true);

    const al = items.find((i) => i.storeSlug === "aliexpress");
    expect(al).toMatchObject({
      name: aliexpressListing().title,
      price: 899.99,
      imageSrc: aliexpressListing().imageUrl,
      affiliateUrl: aliexpressListing().affiliateUrl,
    });

    const ebay = items.find((i) => i.storeSlug === "ebay");
    expect(ebay).toMatchObject({
      name: ebayListing().title,
      price: 929.99,
      imageSrc: ebayListing().imageUrl,
      affiliateUrl: ebayListing().affiliateUrl,
    });
  });

  it("still excludes DB products from non-active providers (no bypass)", async () => {
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([
      fakeAdapter("aliexpress", aliexpressListing()),
      fakeAdapter("ebay", ebayListing()),
    ]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([
      dbItem({ storeSlug: "walmart", id: "db-walmart-1" }),
      dbItem({ storeSlug: "temu", id: "db-temu-1" }),
    ]);

    const items = await searchProducts(S25_QUERY, 20);
    const stores = new Set(items.map((i) => i.storeSlug));

    expect(stores.has("walmart")).toBe(false);
    expect(stores.has("temu")).toBe(false);
    expect(stores.has("aliexpress")).toBe(true);
    expect(stores.has("ebay")).toBe(true);
  });
});