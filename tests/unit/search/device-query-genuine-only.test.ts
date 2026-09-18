/**
 * Device-query multi-provider assembly (search surface only).
 *
 * Live problem being locked: `/search` for an explicit device query
 * ("iphone 15 pro max", "macbook air m3", "airpods pro") came back eBay-only
 * once any provider held genuine devices — a hard gate dropped every other
 * provider's relevant inventory. eBay was the only provider whose retrieval
 * surfaced genuine devices for those exact models, so Search read as
 * "eBay-only" even though Accessories (cases, chargers, screen protectors)
 * and imported rows existed elsewhere.
 *
 * Contract:
 *   - Device-intent queries assemble ONE pool from every provider (live +
 *     imported) through the device-first production pipeline.
 *   - Genuine devices from ALL providers lead every page (never displaced by
 *     accessories, live or imported).
 *   - Relevant accessories from the remaining providers balance behind the
 *     devices, so a query is never eBay-only just because only eBay has the
 *     exact device — other providers still surface their real inventory.
 *   - The legacy accessory backfill still applies when no genuine device
 *     exists anywhere, and accessory-intent queries are untouched.
 *   - The default (homepage / Compare Prices) path is untouched — no
 *     `optimizeForDeviceIntent` means byte-identical legacy behaviour.
 *
 * Suite runs isolate:false + singleFork:true, so it uses live-binding spies
 * (`vi.spyOn(module, "fn")`) rather than per-module `vi.mock`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchProducts, setProviderFetchTimeoutForTests } from "@/lib/search/engine";
import * as adapterRegistry from "@/lib/providers/adapter-registry";
import * as providerConfig from "@/lib/integration/provider-config";
import type { ProviderAdapter } from "@/lib/providers/adapter";
import type { ConnectorSearchOptions } from "@/lib/search/connectors/types";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

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

function dbItem(overrides: Partial<SearchResultItem> & { name: string }): SearchResultItem {
  return {
    id: overrides.id ?? `db-${overrides.name}`,
    imageSrc: "https://x.example.com/img.jpg",
    emoji: "📦",
    price: 100,
    originalPrice: 120,
    discount: 0,
    store: "Admitad",
    storeSlug: "admitad",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    category: "General",
    ...overrides,
  };
}

type CapturingAdapter = ProviderAdapter & { captured: ConnectorSearchOptions[] };

function adapter(
  id: SearchProviderId,
  listings: RawProviderListing[],
): CapturingAdapter {
  const captured: ConnectorSearchOptions[] = [];
  const a: CapturingAdapter = {
    id,
    name: id,
    async isAvailable() {
      return true;
    },
    normalize() {
      return null;
    },
    normalizeBatch() {
      return [];
    },
    async search(_query: string, options?: ConnectorSearchOptions) {
      captured.push(options ?? {});
      return { providerId: id, listings, durationMs: 3 };
    },
    captured,
  };
  return a;
}

function device(providerId: SearchProviderId, n: number, title: string): RawProviderListing {
  return rawListing({
    providerId,
    externalId: `${providerId}-d-${n}`,
    title,
  });
}

function accessory(providerId: SearchProviderId, n: number, title: string): RawProviderListing {
  return rawListing({
    providerId,
    externalId: `${providerId}-a-${n}`,
    title,
  });
}

let uniq = 0;
const deviceQuery = () => `iphone 15 pro max genuine${Date.now()}-${uniq++}`;

beforeEach(() => {
  vi.spyOn(providerConfig, "getActiveProductionProviders").mockResolvedValue([
    "ebay",
    "aliexpress",
    "admitad",
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  setProviderFetchTimeoutForTests();
});

describe("device-intent multi-provider assembly", () => {
  it("lists every genuine device ahead of accessories from every provider", async () => {
    const q = deviceQuery();
    const ebay = adapter("ebay", [
      device("ebay", 1, `Apple ${q} 256GB Unlocked Smartphone`),
      device("ebay", 2, `Apple ${q} 512GB Unlocked Smartphone`),
    ]);
    const ali = adapter("aliexpress", [
      accessory("aliexpress", 1, `Silicone Case for ${q}`),
      accessory("aliexpress", 2, `Tempered Glass Screen Protector for ${q}`),
    ]);
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([ebay, ali]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([
      dbItem({ name: `Phone Case Cover for ${q}` }),
    ]);

    const items = await searchProducts(q, 50, { optimizeForDeviceIntent: true });

    // Every source contributes: not eBay-only, accessories never displace a device.
    expect(items.length).toBe(5);
    expect(items[0]!.storeSlug).toBe("ebay");
    expect(items[1]!.storeSlug).toBe("ebay");
    expect(items.some((i) => i.storeSlug === "aliexpress")).toBe(true);
    expect(items.some((i) => i.storeSlug === "admitad" && /Case/.test(i.name))).toBe(true);
  });

  it("never lets an accessory displace a genuine device — imported devices lead too", async () => {
    const q = deviceQuery();
    const ali = adapter("aliexpress", [
      accessory("aliexpress", 1, `Car Mount Holder for ${q}`),
    ]);
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([ali]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([
      dbItem({ id: "db-genuine-1", name: `Apple ${q} 256GB Unlocked` }),
      dbItem({ id: "db-acc-1", name: `Silicone Case for ${q}` }),
    ]);

    const items = await searchProducts(q, 50, { optimizeForDeviceIntent: true });

    // The imported genuine device leads; the live and imported accessories
    // balance behind it rather than disappearing (or standing above it).
    expect(items[0]!.id).toBe("db-genuine-1");
    expect(items.length).toBe(3);
    expect(items.some((i) => i.id === "db-acc-1")).toBe(true);
    expect(items.some((i) => i.storeSlug === "aliexpress")).toBe(true);
  });

  it("falls back to accessories when no genuine device exists anywhere", async () => {
    const q = deviceQuery();
    const ali = adapter("aliexpress", [
      accessory("aliexpress", 1, `Silicone Case for ${q}`),
      accessory("aliexpress", 2, `Fast Charger for ${q}`),
    ]);
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([ali]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    const items = await searchProducts(q, 50, { optimizeForDeviceIntent: true });

    expect(items.length).toBe(2);
    expect(items.every((i) => i.storeSlug === "aliexpress")).toBe(true);
  });

  it("retrieves device-intent searches deeper than the legacy default", async () => {
    const q = deviceQuery();
    const ebay = adapter("ebay", [device("ebay", 1, `Apple ${q} 256GB Unlocked`)]);
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([ebay]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    await searchProducts(q, 50, { optimizeForDeviceIntent: true });
    // The exact-query leg pages deeper; the family-keyword fallback uses the
    // legacy shallow budget that mirrors the category surface.
    expect(ebay.captured).toHaveLength(2);
    expect(ebay.captured[0]).toMatchObject({ targetFetch: 300, maxPages: 8, minFetch: 100 });
    expect(ebay.captured[1]).toMatchObject({ targetFetch: 120, maxPages: 4, minFetch: 60 });
  });

  it("never gates accessory-intent queries", async () => {
    const q = `iphone 15 case${Date.now()}-${uniq++}`;
    const ali = adapter("aliexpress", [
      accessory("aliexpress", 1, `Silicone Case for iphone 15 case`),
      device("aliexpress", 2, `Apple iphone 15 case 256GB Unlocked`),
    ]);
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([ali]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    const items = await searchProducts(q, 50, { optimizeForDeviceIntent: true });
    expect(items.some((i) => /Case/i.test(i.name))).toBe(true);
  });

  it("keeps the default (homepage/compare) path untouched", async () => {
    const q = deviceQuery();
    const ali = adapter("aliexpress", [
      device("aliexpress", 1, `Apple ${q} 256GB Unlocked Smartphone`),
      accessory("aliexpress", 2, `Silicone Case for ${q}`),
    ]);
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([ali]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    const items = await searchProducts(q, 50);

    expect(ali.captured).toHaveLength(1);
    expect(ali.captured[0]).toMatchObject({ targetFetch: 120, maxPages: 4, minFetch: 60 });
    expect(items.some((i) => /Case/i.test(i.name))).toBe(true);
  });

  it("reaches genuine devices through the family-keyword fallback when the exact query is accessory-saturated", async () => {
    const q = deviceQuery();
    // Simulates the live AliExpress reality that motivated the fix: the exact
    // device phrase's first pages are accessories, but a bare family keyword
    // ("phone" — the same word the Phones category page searches) surfaces the
    // genuine device.
    const ali = adapter("aliexpress", []);
    const aliSearch = vi.spyOn(ali, "search").mockImplementation(async (query: string) => {
      if (query === "phone") {
        return {
          providerId: "aliexpress",
          listings: [device("aliexpress", 99, `Apple ${q} 256GB Unlocked Smartphone`)],
          durationMs: 5,
        };
      }
      return {
        providerId: "aliexpress",
        listings: [
          accessory("aliexpress", 1, `Silicone Case for ${q}`),
          accessory("aliexpress", 2, `Tempered Glass Screen Protector for ${q}`),
        ],
        durationMs: 5,
      };
    });
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([ali]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([]);

    const items = await searchProducts(q, 50, { optimizeForDeviceIntent: true });

    expect(aliSearch).toHaveBeenCalledTimes(2);
    expect(aliSearch.mock.calls[0]?.[0]).toBe(q);
    expect(aliSearch.mock.calls[1]?.[0]).toBe("phone");
    // Genuine device leads ahead of the exact-query accessories it saturates.
    expect(items.length).toBe(3);
    expect(items[0]!.storeSlug).toBe("aliexpress");
    expect(items[0]!.name).toContain(q);
    expect(items.some((i) => /Case|Protector/i.test(i.name))).toBe(true);
  });
});