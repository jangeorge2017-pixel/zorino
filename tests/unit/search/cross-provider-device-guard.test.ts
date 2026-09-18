/**
 * Cross-provider device-search regression suite.
 *
 * Problem being locked: a `/search` query for a genuine device ("iphone 15 pro
 * max", "samsung galaxy s24 ultra", "airpods pro") must reach EVERY capable
 * provider in that provider's own query language, so genuine devices lead page 1
 * ahead of accessories/parts — without hardcoding any product/model/merchant and
 * without changing the LOCKED homepage catalog / Compare Prices behaviour.
 *
 * Guards:
 *   1. Generic device-intent detection (all 5 required production queries).
 *   2. Provider capability map (category filter, keyword expansion, NEVER a
 *      forced NEW condition filter).
 *   3. AliExpress generic query expansion; legacy path unchanged.
 *   4. eBay category narrowing + graceful uncategorized fallback; Used/
 *      Refurbished preserved.
 *   5. Engine opt-in propagation; the default (homepage/compare) path emits the
 *      exact same adapter options as before.
 *   6. Provider timeout / failure degrades gracefully.
 *   7. Multi-provider assembly: genuine devices lead, accessories backfill, no
 *      provider is fabricated or padded.
 *
 * Mocking: suite runs isolate:false + singleFork:true where per-module
 * `vi.mock` is unreliable, so this file uses live-binding spies
 * (`vi.spyOn(module, "fn")`) and exported test seams.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  analyzeSearchQueryIntent,
  buildExpandedSearchQueries,
  detectProductFamily,
} from "@/lib/search/query-intent";
import { getProviderSearchCapabilities } from "@/lib/search/provider-capabilities";
import { buildAliExpressSearchQueries } from "@/lib/search/connectors/aliexpress";
import {
  resetEbayLastGoodCacheForTests,
  resolveEbayDeviceSearchStrategy,
  searchEbayWithClient,
} from "@/lib/search/connectors/ebay";
import { buildBrowseSearchParams, EbayAffiliateClient } from "@/lib/integrations/ebay/client";
import type { EbayRawProduct } from "@/lib/integrations/ebay/types";
import { assembleProductionSearchResults } from "@/lib/search/production-pipeline";
import {
  searchProducts,
  setProviderFetchTimeoutForTests,
} from "@/lib/search/engine";
import * as adapterRegistry from "@/lib/providers/adapter-registry";
import * as providerConfig from "@/lib/integration/provider-config";
import type { ProviderAdapter } from "@/lib/providers/adapter";
import type { ConnectorSearchOptions } from "@/lib/search/connectors/types";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";

const dbCatalog = () => import("@/lib/integration/database-catalog");

function rawListing(overrides: Partial<RawProviderListing>): RawProviderListing {
  return {
    providerId: "aliexpress",
    externalId: "x",
    title: "listing",
    imageUrl: "https://x.example.com/img.jpg",
    price: 100,
    originalPrice: 120,
    discount: 0,
    currency: "USD",
    storeName: "Test Store",
    category: "Electronics",
    rating: 0,
    reviewCount: 0,
    salesCount: 0,
    inStock: true,
    productUrl: "https://x.example.com/p",
    affiliateUrl: "https://x.example.com/p?aff=1",
    ...overrides,
  };
}

function rawEbayProduct(overrides: Partial<EbayRawProduct> = {}): EbayRawProduct {
  return {
    itemId: "284393027916",
    title: "Apple iPhone 15 128GB Unlocked Smartphone",
    price: { value: "799.99", currency: "USD" },
    itemWebUrl: "https://www.ebay.com/itm/284393027916",
    itemAffiliateWebUrl: "https://www.ebay.com/itm/284393027916?campid=test",
    image: { imageUrl: "https://i.ebayimg.com/images/g/AbC/s-l1600.jpg" },
    buyingOptions: ["FIXED_PRICE"],
    ...overrides,
  };
}

/** Adapter that records the options the engine passed it (per adapter.search call). */
function capturingAdapter(
  id: SearchProviderId,
  listing: RawProviderListing,
): ProviderAdapter & { captured: ConnectorSearchOptions[] } {
  const captured: ConnectorSearchOptions[] = [];
  const adapter: ProviderAdapter & { captured: ConnectorSearchOptions[] } = {
    id,
    name: id,
    async isAvailable() {
      return true;
    },
    normalize() {
      return listing;
    },
    normalizeBatch() {
      return [listing];
    },
    async search(_query: string, options?: ConnectorSearchOptions) {
      captured.push(options ?? {});
      return { providerId: id, listings: [listing], durationMs: 5 };
    },
    captured,
  };
  return adapter;
}

afterEach(() => {
  vi.restoreAllMocks();
  resetEbayLastGoodCacheForTests();
  setProviderFetchTimeoutForTests();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Generic device-intent detection
// ─────────────────────────────────────────────────────────────────────────────

describe("generic device-intent detection (no product hardcoding)", () => {
  const requiredQueries = [
    { query: "iphone 15", family: "phone", ebayCategoryId: "9355" },
    { query: "iphone 15 pro", family: "phone", ebayCategoryId: "9355" },
    { query: "iphone 15 pro max", family: "phone", ebayCategoryId: "9355" },
    { query: "airpods pro", family: "audio", ebayCategoryId: undefined },
    { query: "samsung galaxy s24", family: "phone", ebayCategoryId: "9355" },
  ] as const;

  it.each(requiredQueries)(
    "classifies required query '$query' as a $family device search",
    ({ query, family, ebayCategoryId }) => {
      const intent = analyzeSearchQueryIntent(query);
      expect(intent.family).toBe(family);
      expect(intent.kind).toBe("device");
      expect(intent.wantsAccessory).toBe(false);
      expect(intent.ebayCategoryId).toBe(ebayCategoryId);
    },
  );

  it("maps generic category words to their family + US eBay category", () => {
    expect(analyzeSearchQueryIntent("laptop")).toMatchObject({
      kind: "category",
      family: "laptop",
      ebayCategoryId: "175672",
    });
    expect(analyzeSearchQueryIntent("ipad pro")).toMatchObject({
      family: "tablet",
      ebayCategoryId: "171485",
    });
    expect(analyzeSearchQueryIntent("ps5 console")).toMatchObject({
      family: "console",
      ebayCategoryId: "1249",
    });
  });

  it("keeps families without a confident category keyword-only", () => {
    expect(analyzeSearchQueryIntent("rtx 5090")).toMatchObject({
      family: "gpu",
      ebayCategoryId: undefined,
    });
    expect(analyzeSearchQueryIntent("airpods pro").ebayCategoryId).toBeUndefined();
  });

  it("detects accessory intent and never category-narrows it", () => {
    for (const query of [
      "iphone 15 case",
      "iphone 15 screen protector",
      "samsung galaxy s24 charger",
      "airpods pro case",
    ]) {
      const intent = analyzeSearchQueryIntent(query);
      expect(intent.kind).toBe("accessory");
      expect(intent.wantsAccessory).toBe(true);
      expect(intent.ebayCategoryId).toBeUndefined();
    }
  });

  it("degrades unknown/empty queries safely", () => {
    expect(analyzeSearchQueryIntent("")).toMatchObject({
      kind: "generic",
      family: "unknown",
    });
    expect(detectProductFamily("wooden desk")).toBe("unknown");
  });

  it("is model-agnostic — any brand's phone query maps to the phone family", () => {
    for (const query of [
      "google pixel 9 pro",
      "oneplus 13",
      "xiaomi redmi note 14",
      "iphone 15",
    ]) {
      expect(detectProductFamily(query)).toBe("phone");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Provider capability map
// ─────────────────────────────────────────────────────────────────────────────

describe("provider search capabilities", () => {
  it("gives eBay a category filter but never a condition filter", () => {
    const caps = getProviderSearchCapabilities("ebay");
    expect(caps.supportsCategoryFilter).toBe(true);
    expect(caps.supportsConditionFilter).toBe(false);
  });

  it("gives AliExpress generic keyword expansion for device families", () => {
    const caps = getProviderSearchCapabilities("aliexpress");
    expect(caps.queryMode).toBe("keyword-expand");
    expect(caps.deviceAppendTerms?.phone).toEqual(
      expect.arrayContaining(["smartphone", "unlocked"]),
    );
  });

  it("falls back to safe keyword-only defaults for unknown providers", () => {
    const caps = getProviderSearchCapabilities("some-new-provider");
    expect(caps).toMatchObject({
      queryMode: "keyword",
      supportsCategoryFilter: false,
      supportsConditionFilter: false,
    });
  });

  it("never enables a forced condition filter for any known provider", () => {
    for (const id of ["ebay", "aliexpress", "admitad", "cjdropshipping", "amazon"]) {
      expect(getProviderSearchCapabilities(id).supportsConditionFilter).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. AliExpress generic query expansion
// ─────────────────────────────────────────────────────────────────────────────

describe("AliExpress generic device query expansion", () => {
  const iphoneIntent = analyzeSearchQueryIntent("iphone 15");

  it("expands a phone query with generic family terms when optimized", () => {
    const queries = buildAliExpressSearchQueries("iphone 15", {
      optimizeForDeviceIntent: true,
      intent: iphoneIntent,
    });
    expect(queries[0]).toBe("iphone 15");
    expect(queries).toContain("iphone 15 smartphone");
    expect(queries).toContain("iphone 15 unlocked");
    expect(queries.length).toBeLessThanOrEqual(3);
  });

  it("never expands accessory queries", () => {
    expect(
      buildAliExpressSearchQueries("iphone 15 case", { optimizeForDeviceIntent: true }),
    ).toEqual(["iphone 15 case"]);
  });

  it("leaves the legacy (non-optimized) variant list unchanged", () => {
    expect(buildAliExpressSearchQueries("iphone 15")).toEqual([
      "iphone 15",
      "iphone 15 smartphone",
      "iphone 15 unlocked",
    ]);
    expect(buildAliExpressSearchQueries("plain wooden desk")).toEqual([
      "plain wooden desk",
    ]);
  });

  it("skips append terms already present in the query", () => {
    expect(buildExpandedSearchQueries("iphone 15 unlocked", ["smartphone", "unlocked", "mobile phone"])).toEqual(
      ["iphone 15 unlocked", "iphone 15 unlocked smartphone", "iphone 15 unlocked mobile phone"],
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. eBay Browse params + device strategy
// ─────────────────────────────────────────────────────────────────────────────

describe("eBay category strategy", () => {
  it("does not optimize unless the caller opts in", () => {
    expect(resolveEbayDeviceSearchStrategy("iphone 15", undefined)).toEqual({
      pageBatch: 1,
    });
  });

  it("narrows a device query to its category and parallelizes pages", () => {
    expect(
      resolveEbayDeviceSearchStrategy("iphone 15", { optimizeForDeviceIntent: true }),
    ).toEqual({ categoryIds: "9355", pageBatch: 2 });
  });

  it("never category-narrows accessory or uncategorized families", () => {
    expect(
      resolveEbayDeviceSearchStrategy("iphone 15 case", { optimizeForDeviceIntent: true }),
    ).toEqual({ pageBatch: 2 });
    expect(
      resolveEbayDeviceSearchStrategy("airpods pro", { optimizeForDeviceIntent: true }),
    ).toEqual({ pageBatch: 2 });
  });

  it("builds Browse params with q/limit/offset and only adds category_ids when given", () => {
    const plain = buildBrowseSearchParams({ q: "iphone 15", limit: 50, offset: 0 });
    expect(plain.get("q")).toBe("iphone 15");
    expect(plain.get("limit")).toBe("50");
    expect(plain.get("offset")).toBe("0");
    expect(plain.get("category_ids")).toBeNull();

    const filtered = buildBrowseSearchParams({
      q: "iphone 15",
      limit: 50,
      offset: 0,
      categoryIds: "9355",
    });
    expect(filtered.get("category_ids")).toBe("9355");
  });

  it("never emits a condition filter", () => {
    const params = buildBrowseSearchParams({
      q: "iphone 15",
      limit: 50,
      offset: 0,
      categoryIds: "9355",
    });
    expect(params.toString()).not.toContain("condition");
  });
});

describe("eBay connector — category narrowing preserves Used/Refurbished", () => {
  it("passes the category to the client and keeps Renewed/Used listings", async () => {
    const client = new EbayAffiliateClient();
    const spy = vi.spyOn(client, "searchByKeyword").mockResolvedValue([
      rawEbayProduct({ itemId: "284393027916", title: "Apple iPhone 15 128GB Unlocked Smartphone" }),
      rawEbayProduct({ itemId: "284393027917", title: "Apple iPhone 15 128GB (Renewed Premium)" }),
      rawEbayProduct({
        itemId: "284393027918",
        title: "Apple iPhone 15 128GB Unlocked - Used, Grade A",
      }),
    ]);

    const results = await searchEbayWithClient(client, "iphone 15", {
      optimizeForDeviceIntent: true,
      intent: analyzeSearchQueryIntent("iphone 15"),
    });

    expect(results).toHaveLength(3);
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ categoryIds: "9355", pageBatch: 2 });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("condition");
    const titles = results.map((r) => r.title).join(" | ");
    expect(titles).toContain("Renewed");
    expect(titles).toContain("Used");
  });

  it("falls back to an uncategorized keyword search when the category fetch fails", async () => {
    const client = new EbayAffiliateClient();
    const spy = vi
      .spyOn(client, "searchByKeyword")
      .mockRejectedValueOnce(new Error("HTTP 400 Bad Request"))
      .mockResolvedValueOnce([rawEbayProduct({ title: "Apple iPhone 15 128GB Unlocked" })]);

    const results = await searchEbayWithClient(client, "iphone 15", {
      optimizeForDeviceIntent: true,
      intent: analyzeSearchQueryIntent("iphone 15"),
    });

    expect(results).toHaveLength(1);
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ categoryIds: "9355" });
    expect(spy.mock.calls[1]?.[1]?.categoryIds).toBeUndefined();
  });

  it("falls back when the category fetch returns nothing", async () => {
    const client = new EbayAffiliateClient();
    const spy = vi
      .spyOn(client, "searchByKeyword")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([rawEbayProduct({ title: "Apple iPhone 15 128GB Unlocked" })]);

    const results = await searchEbayWithClient(client, "iphone 15", {
      optimizeForDeviceIntent: true,
      intent: analyzeSearchQueryIntent("iphone 15"),
    });

    expect(results).toHaveLength(1);
    expect(spy.mock.calls[1]?.[1]?.categoryIds).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Engine opt-in propagation + locked default
// ─────────────────────────────────────────────────────────────────────────────

describe("engine device-intent opt-in", () => {
  beforeEach(() => {
    vi.spyOn(providerConfig, "getActiveProductionProviders").mockResolvedValue([
      "aliexpress",
      "ebay",
    ]);
  });

  it("propagates the intent to adapters only when explicitly requested", async () => {
    const adapter = capturingAdapter("ebay", rawListing({ providerId: "ebay", externalId: "e1" }));
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([adapter]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    await searchProducts(`iphone 15 opt${Date.now()}`, 20, {
      optimizeForDeviceIntent: true,
    });

    // The exact-query leg carries the opt-in intent.
    expect(adapter.captured[0]?.optimizeForDeviceIntent).toBe(true);
    expect(adapter.captured[0]?.intent?.family).toBe("phone");
  });

  it("keeps the default (homepage/compare) adapter options byte-identical", async () => {
    const adapter = capturingAdapter("ebay", rawListing({ providerId: "ebay", externalId: "e2" }));
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([adapter]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    await searchProducts(`locked-default-${Date.now()}`, 20);

    expect(adapter.captured).toHaveLength(1);
    expect(adapter.captured[0] && "optimizeForDeviceIntent" in adapter.captured[0]).toBe(false);
    expect(adapter.captured[0]?.intent).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Graceful timeout / failure degradation
// ─────────────────────────────────────────────────────────────────────────────

describe("provider timeout and failure degradation", () => {
  beforeEach(() => {
    vi.spyOn(providerConfig, "getActiveProductionProviders").mockResolvedValue([
      "aliexpress",
      "ebay",
    ]);
  });

  it("drops a stalled provider at the budget and keeps the fast provider's results", async () => {
    setProviderFetchTimeoutForTests(60);

    const query = `iphone 15 fast${Date.now()}`;
    const fast = capturingAdapter(
      "aliexpress",
      rawListing({ externalId: "fast-1", title: `Apple ${query} 128GB Unlocked Smartphone` }),
    );
    const stalled: ProviderAdapter = {
      id: "ebay",
      name: "eBay",
      async isAvailable() {
        return true;
      },
      normalize() {
        return null;
      },
      normalizeBatch() {
        return [];
      },
      search() {
        return new Promise(() => {
          /* never settles */
        });
      },
    };
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([fast, stalled]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    const started = Date.now();
    const items = await searchProducts(query, 20);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(2_000);
    expect(items.some((i) => i.storeSlug === "aliexpress")).toBe(true);
  });

  it("keeps other providers' results when one provider throws", async () => {
    const query = `iphone 15 slow${Date.now()}`;
    const fast = capturingAdapter(
      "aliexpress",
      rawListing({ externalId: "fast-2", title: `Apple ${query} 128GB Unlocked Smartphone` }),
    );
    const broken: ProviderAdapter = {
      id: "ebay",
      name: "eBay",
      async isAvailable() {
        return true;
      },
      normalize() {
        return null;
      },
      normalizeBatch() {
        return [];
      },
      async search() {
        throw new Error("HTTP 503 Service Unavailable");
      },
    };
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([fast, broken]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    const items = await searchProducts(query, 20);
    expect(items.some((i) => i.storeSlug === "aliexpress")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Multi-provider assembly
// ─────────────────────────────────────────────────────────────────────────────

describe("cross-provider assembly — genuine devices lead, no padding", () => {
  const QUERY = "samsung galaxy s24 ultra";

  function device(providerId: SearchProviderId, n: number): RawProviderListing {
    return rawListing({
      providerId,
      externalId: `${providerId}-device-${n}`,
      title: `Samsung Galaxy S24 Ultra ${256 + n}GB Unlocked Smartphone`,
    });
  }

  function accessory(n: number): RawProviderListing {
    const names = [
      "Silicone Case for Samsung Galaxy S24 Ultra",
      "Tempered Glass Screen Protector for Samsung Galaxy S24 Ultra",
      "Fast Charger for Samsung Galaxy S24 Ultra",
      "Car Mount Holder for Samsung Galaxy S24 Ultra",
    ];
    return rawListing({
      providerId: "admitad",
      externalId: `admitad-acc-${n}`,
      title: names[n % names.length]!,
    });
  }

  it("lists every genuine device ahead of every accessory across providers", () => {
    const raw = [
      device("ebay", 1),
      device("ebay", 2),
      device("ebay", 3),
      device("aliexpress", 4),
      device("aliexpress", 5),
      accessory(0),
      accessory(1),
      accessory(2),
      accessory(3),
    ];

    const results = assembleProductionSearchResults(raw, QUERY, 20);
    expect(results).toHaveLength(9);

    const isAccessory = (name: string) =>
      /Case|Protector|Charger|Holder/i.test(name);
    const firstAccessory = results.findIndex((r) => isAccessory(r.name));
    const lastDevice = results.findLastIndex((r) => !isAccessory(r.name));

    expect(firstAccessory).toBeGreaterThan(-1);
    expect(lastDevice).toBeLessThan(firstAccessory);
    expect(lastDevice).toBe(4); // 5 genuine devices, contiguous at the top
  });

  it("does not pad or fabricate — genuine counts reflect real inventory", () => {
    const raw = [
      device("ebay", 1),
      device("ebay", 2),
      ...Array.from({ length: 8 }, (_, i) => accessory(i)),
    ];

    const results = assembleProductionSearchResults(raw, QUERY, 50);
    const ebayCount = results.filter((r) => r.storeSlug === "ebay").length;

    expect(ebayCount).toBe(2);
    expect(results.some((r) => r.storeSlug === "cjdropshipping")).toBe(false);
  });

  it("still surfaces accessories when a query genuinely has no devices", () => {
    const results = assembleProductionSearchResults([accessory(0), accessory(1)], QUERY, 10);
    expect(results.length).toBe(2);
  });
});
