/**
 * Device-query genuine-only gating (search surface only).
 *
 * Live problem being locked: on `/search`, an explicit device query
 * ("iphone 15 pro max", "airpods pro", "macbook air m3") returned a pool where
 * the few genuine devices were followed by a flood of accessories
 * (cases, chargers, screen protectors, keyboard covers) from providers whose
 * shallow keyword page is accessory-saturated. Because the pool is filled to
 * the full display cap before paging, those accessories landed on page 1.
 *
 * Contract:
 *   - Device-intent queries surface ONLY genuine devices when any provider
 *     (live or imported) actually has one.
 *   - A provider with no genuine match contributes zero (no accessory filler).
 *   - When no genuine device exists anywhere, the legacy accessory backfill
 *     still applies so the query returns real products.
 *   - Accessory-intent queries are untouched.
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

type CapturingAdapter = ProviderAdapter & { captured?: ConnectorSearchOptions };

function adapter(
  id: SearchProviderId,
  listings: RawProviderListing[],
): CapturingAdapter {
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
      a.captured = options;
      return { providerId: id, listings, durationMs: 3 };
    },
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

describe("device-intent genuine-only gating", () => {
  it("drops accessory fillers when genuine devices exist, across providers", async () => {
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

    expect(items.length).toBe(2);
    expect(items.every((i) => i.storeSlug === "ebay")).toBe(true);
    expect(items.some((i) => /Case|Protector/i.test(i.name))).toBe(false);
  });

  it("keeps genuine imported DB devices and drops live accessory filler", async () => {
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

    expect(items.length).toBe(1);
    expect(items[0]!.id).toBe("db-genuine-1");
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
    expect(ebay.captured).toMatchObject({ targetFetch: 300, maxPages: 8, minFetch: 100 });
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

    expect(ali.captured).toMatchObject({ targetFetch: 120, maxPages: 4, minFetch: 60 });
    expect(items.some((i) => /Case/i.test(i.name))).toBe(true);
  });
});
