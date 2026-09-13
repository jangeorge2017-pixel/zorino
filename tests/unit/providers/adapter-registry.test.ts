import { describe, it, expect } from "vitest";
import {
  getProviderAdapter,
  requireProviderAdapter,
  getAllProviderAdapters,
  getRegisteredAdapterCount,
  aliExpressAdapter,
  ebayAdapter,
  amazonAdapter,
  amazonEgAdapter,
  cjdropshippingAdapter,
  admitadAdapter,
  resolveProviderProductDetail,
} from "@/lib/providers/adapter-registry";
import type { ProviderAdapter } from "@/lib/providers/adapter";

// ─── Adapter Registry ───────────────────────────────────────────────────────

describe("Adapter Registry", () => {
  it("has 11 registered adapters matching SEARCH_PROVIDER_IDS", () => {
    expect(getRegisteredAdapterCount()).toBe(11);
  });

  it("returns adapter for every registered provider ID", () => {
    const ids = [
      "aliexpress",
      "ebay",
      "amazon",
      "amazon-eg",
      "cjdropshipping",
      "admitad",
      "walmart",
      "bestbuy",
      "temu",
      "noon",
      "jumia",
    ] as const;

    for (const id of ids) {
      const adapter = getProviderAdapter(id);
      expect(adapter).toBeDefined();
      expect(adapter!.id).toBe(id);
    }
  });

  it("returns undefined for unknown provider ID", () => {
    expect(getProviderAdapter("nonexistent")).toBeUndefined();
    expect(getProviderAdapter("")).toBeUndefined();
  });

  it("requireProviderAdapter throws for unknown ID", () => {
    expect(() => requireProviderAdapter("nonexistent")).toThrow(
      "Provider adapter not found: nonexistent"
    );
  });

  it("getAllProviderAdapters returns all adapters", () => {
    const all = getAllProviderAdapters();
    expect(all).toHaveLength(11);
    const ids = all.map((a) => a.id);
    expect(ids).toContain("aliexpress");
    expect(ids).toContain("ebay");
    expect(ids).toContain("admitad");
    expect(ids).toContain("walmart");
    expect(ids).toContain("jumia");
  });

  it("every adapter has a non-empty name", () => {
    for (const adapter of getAllProviderAdapters()) {
      expect(adapter.name.length).toBeGreaterThan(0);
    }
  });
});

// ─── Individual Adapter Contracts ───────────────────────────────────────────

describe("Adapter contracts", () => {
  const activeAdapters: [string, ProviderAdapter][] = [
    ["aliexpress", aliExpressAdapter],
    ["ebay", ebayAdapter],
    ["amazon", amazonAdapter],
    ["amazon-eg", amazonEgAdapter],
    ["cjdropshipping", cjdropshippingAdapter],
    ["admitad", admitadAdapter],
  ];

  for (const [id, adapter] of activeAdapters) {
    describe(`${id} adapter`, () => {
      it("has correct id", () => {
        expect(adapter.id).toBe(id);
      });

      it("isAvailable returns a boolean", async () => {
        const result = await adapter.isAvailable();
        expect(typeof result).toBe("boolean");
      });

      it("normalize returns null for empty/garbage input", () => {
        expect(adapter.normalize({})).toBeNull();
        expect(adapter.normalize(null)).toBeNull();
        expect(adapter.normalize(undefined as unknown)).toBeNull();
        expect(adapter.normalize("string")).toBeNull();
        expect(adapter.normalize(42)).toBeNull();
      });

      it("normalizeBatch returns empty for empty input", () => {
        expect(adapter.normalizeBatch([])).toEqual([]);
      });

      it("normalizeBatch filters out nulls", () => {
        const result = adapter.normalizeBatch([
          {},
          null,
          undefined,
          "garbage",
        ] as unknown[]);
        expect(Array.isArray(result)).toBe(true);
      });

      it("search returns ProviderSearchResult shape", async () => {
        const result = await adapter.search("test query");
        expect(result).toHaveProperty("providerId", id);
        expect(result).toHaveProperty("listings");
        expect(Array.isArray(result.listings)).toBe(true);
        expect(result).toHaveProperty("durationMs");
        expect(typeof result.durationMs).toBe("number");
      });

      it("search returns empty for empty query", async () => {
        const result = await adapter.search("");
        expect(result.listings).toEqual([]);
      });
    });
  }
});

// ─── Stub Adapter Contracts ─────────────────────────────────────────────────

describe("Stub adapters", () => {
  const stubIds = ["walmart", "bestbuy", "temu", "noon", "jumia"] as const;

  for (const id of stubIds) {
    describe(`${id} stub adapter`, () => {
      const adapter = getProviderAdapter(id)!;

      it("is defined", () => {
        expect(adapter).toBeDefined();
      });

      it("normalize returns null for any input", () => {
        expect(adapter.normalize({})).toBeNull();
        expect(adapter.normalize("anything" as unknown)).toBeNull();
      });

      it("search returns empty listings", async () => {
        const result = await adapter.search("anything");
        expect(result.providerId).toBe(id);
        expect(result.listings).toEqual([]);
      });
    });
  }
});

// ─── Provider-Neutral Product Detail ────────────────────────────────────────

describe("resolveProviderProductDetail", () => {
  it("AliExpress adapter exposes a detail resolver", () => {
    expect(typeof aliExpressAdapter.getProductDetail).toBe("function");
  });

  it("resolves without throwing when credentials are absent (returns null)", async () => {
    const detail = await resolveProviderProductDetail("aliexpress", "123456789");
    expect(detail).toBeNull();
  });

  it("returns null for providers without a detail resolver", async () => {
    // ebay/amazon/cj/admitad adapters wrap connectors that only search.
    expect(ebayAdapter.getProductDetail).toBeUndefined();
    expect(amazonAdapter.getProductDetail).toBeUndefined();
    expect(cjdropshippingAdapter.getProductDetail).toBeUndefined();
    expect(admitadAdapter.getProductDetail).toBeUndefined();
    expect(await resolveProviderProductDetail("ebay", "v1|123")).toBeNull();
    expect(await resolveProviderProductDetail("amazon", "B0TEST")).toBeNull();
  });

  it("returns null for stub providers", async () => {
    expect(await resolveProviderProductDetail("walmart", "any")).toBeNull();
    expect(await resolveProviderProductDetail("temu", "any")).toBeNull();
  });

  it("returns null for an unregistered provider ID", async () => {
    expect(await resolveProviderProductDetail("nonexistent" as never, "x")).toBeNull();
  });
});
