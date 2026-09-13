import { describe, it, expect } from "vitest";
import {
  PROVIDER_IDS,
  PROVIDER_REGISTRY,
  PROVIDER_STORE_META,
  getAllProviderIds,
  getProviderStoreMeta,
  isRegisteredProvider,
} from "@/lib/providers/registry";
import { SEARCH_PROVIDER_IDS } from "@/lib/search/types";
import { PRODUCTION_PROVIDER_IDS } from "@/lib/integration/constants";
import { COMPARISON_STORES } from "@/lib/compare/config";
import { getAllProviderAdapters, getRegisteredAdapterCount } from "@/lib/providers/adapter-registry";

// ─── Single Source of Truth ─────────────────────────────────────────────────

describe("Provider registry is the single source of truth", () => {
  it("PROVIDER_IDS matches the registry order", () => {
    expect(Array.from(PROVIDER_IDS)).toEqual(
      PROVIDER_REGISTRY.map((p) => p.id)
    );
  });

  it("PROVIDER_IDS has no duplicates", () => {
    const set = new Set(PROVIDER_IDS);
    expect(set.size).toBe(PROVIDER_IDS.length);
  });

  it("SEARCH_PROVIDER_IDS is derived from the registry", () => {
    expect(Array.from(SEARCH_PROVIDER_IDS)).toEqual(Array.from(PROVIDER_IDS));
  });

  it("PRODUCTION_PROVIDER_IDS is derived from the registry", () => {
    expect(Array.from(PRODUCTION_PROVIDER_IDS)).toEqual(Array.from(PROVIDER_IDS));
  });

  it("SEARCH_PROVIDER_IDS and PRODUCTION_PROVIDER_IDS agree", () => {
    expect(Array.from(SEARCH_PROVIDER_IDS)).toEqual(
      Array.from(PRODUCTION_PROVIDER_IDS)
    );
  });

  it("original search order is preserved (admitad last)", () => {
    const ids = Array.from(PROVIDER_IDS);
    expect(ids[ids.length - 1]).toBe("admitad");
    expect(ids[0]).toBe("aliexpress");
  });

  it("every registered adapter corresponds to a registry provider ID", () => {
    const adapterIds = getAllProviderAdapters().map((a) => a.id).sort();
    const registryIds = getAllProviderIds().slice().sort();
    expect(adapterIds).toEqual(registryIds);
  });

  it("adapter count equals registry count (11)", () => {
    expect(getRegisteredAdapterCount()).toBe(11);
    expect(PROVIDER_IDS.length).toBe(11);
  });

  it("every registry provider ID resolves as a registered provider", () => {
    for (const id of PROVIDER_IDS) {
      expect(isRegisteredProvider(id)).toBe(true);
    }
  });
});

// ─── Provider Store Display Metadata ────────────────────────────────────────

describe("PROVIDER_STORE_META", () => {
  it("every entry key is a registered provider ID", () => {
    for (const key of Object.keys(PROVIDER_STORE_META)) {
      expect(isRegisteredProvider(key)).toBe(true);
    }
  });

  it("carries canonical display values for core providers", () => {
    expect(getProviderStoreMeta("aliexpress")).toEqual(
      expect.objectContaining({
        id: "aliexpress",
        name: "AliExpress",
        slug: "aliexpress",
        website: "https://www.aliexpress.com",
        logoInitial: "AE",
      })
    );
    expect(getProviderStoreMeta("bestbuy")?.slug).toBe("best-buy");
    expect(getProviderStoreMeta("amazon-eg")?.name).toBe("Amazon Egypt");
  });

  it("returns undefined for unknown slugs so callers keep fallbacks", () => {
    expect(getProviderStoreMeta("nonexistent-store")).toBeUndefined();
    expect(getProviderStoreMeta("")).toBeUndefined();
  });
});

// ─── Price Comparison Stores ────────────────────────────────────────────────

describe("COMPARISON_STORES", () => {
  const expected = ["amazon", "aliexpress", "ebay", "walmart", "temu"];

  it("derives only registered providers", () => {
    for (const id of COMPARISON_STORES) {
      expect(isRegisteredProvider(id)).toBe(true);
    }
  });

  it("contains exactly the comparison allowlist", () => {
    expect(new Set(COMPARISON_STORES)).toEqual(new Set(expected));
  });

  it("preserves registry order", () => {
    expect(Array.from(COMPARISON_STORES)).toEqual([
      "aliexpress",
      "ebay",
      "amazon",
      "walmart",
      "temu",
    ]);
  });
});
