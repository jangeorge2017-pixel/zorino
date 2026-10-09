/**
 * Strict product clustering (lib/search/cluster.ts): identifier-first,
 * [Brand]+[Model]+[Storage], storage-variant-strict, cross-orthography.
 * Locks the absolute-precision contract — a shared identifier wins outright,
 * different storage never merges, Arabic and English spellings produce the
 * SAME structured signature.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyListingPair,
  clusterSignature,
  extractBrand,
  extractModelKey,
  extractStorageKey,
  listingPairProvenDifferent,
  resetClusterSignatureCacheForTests,
  resetClusterTransliterationCacheForTests,
} from "@/lib/search/cluster";

const pair = (titleA: string, titleB: string) => {
  return classifyListingPair({ title: titleA }, { title: titleB });
};

afterEach(() => {
  resetClusterSignatureCacheForTests();
  resetClusterTransliterationCacheForTests();
});

describe("cluster: universal identifiers win outright", () => {
  it("shares an explicit EAN — same product regardless of title", () => {
    const conf = classifyListingPair(
      { title: "Wireless Headset 123", identifiers: { ean: "0123456789012" } },
      { title: "Headphones Deluxe", identifiers: { ean: "0123456789012" } },
    );
    expect(conf).toBe(1);
  });

  it("MPN matches across stores", () => {
    const conf = classifyListingPair(
      { title: "Brand New Galaxy S24", identifiers: { mpn: "SM-S24" } },
      { title: "Samsung Galaxy S24 256GB", identifiers: { mpn: "sm-s24" } },
    );
    expect(conf).toBe(1);
  });

  it("title-extracted EAN/UPC participates too", () => {
    expect(pair("Camera Body EAN 4006381333931", "Gehäuse 4006381333931")).toBe(1);
  });
});

describe("cluster: structured signature", () => {
  it("extracts brand, model and storage", () => {
    expect(extractBrand("Apple iPhone 15 Pro Max 256GB")).toBe("apple");
    expect(extractModelKey("Apple iPhone 15 Pro Max 256GB")).toBe("iphone-15-pro-max");
    expect(extractStorageKey("Apple iPhone 15 Pro Max 256GB")).toBe("256gb");
    expect(extractModelKey("Samsung Galaxy S24 Ultra 1TB")).toBe("galaxy-s24-ultra");
    expect(extractStorageKey("Samsung Galaxy S24 Ultra 1TB")).toBe("1tb");
  });

  it("clusters identical brand+model+storage across stores", () => {
    const conf = pair(
      "Apple iPhone 15 Pro 256GB Natural Titanium Unlocked",
      "iPhone 15 Pro 256GB Original",
    );
    expect(conf).toBeGreaterThanOrEqual(0.95);
  });

  it("clusters Arabic titles to the SAME signature as English", () => {
    expect(extractBrand("آيفون 15 برو 256 جيجابايت")).toBe("apple");
    expect(extractModelKey("آيفون 15 برو 256 جيجابايت")).toBe("iphone-15-pro");
    expect(extractStorageKey("آيفون 15 برو 256 جيجابايت")).toBe("256gb");
    expect(
      pair("آيفون 15 برو 256 جيجابايت تيتانيوم", "Apple iPhone 15 Pro 256GB"),
    ).toBeGreaterThanOrEqual(0.95);
  });

  it("different storage is variant-strict — NEVER clusters", () => {
    expect(pair("iPhone 15 Pro 256GB", "iPhone 15 Pro 512GB")).toBeNull();
    expect(pair("Galaxy S24 128GB", "Galaxy S24 256GB")).toBeNull();
  });

  it("different generation never clusters (no fuzzy over model numbers)", () => {
    expect(pair("Apple iPhone 15 Pro 256GB", "Apple iPhone 14 Pro 256GB")).toBeNull();
    expect(pair("Apple iPhone 15 Pro 256GB", "Apple iPhone 16 Pro 256GB")).toBeNull();
  });

  it("family-word typos are absorbed into the same signature", () => {
    expect(pair("Samsung Galaxy S24 Ultra", "Samsung Glalaxy S24 Ultra")).toBe(0.95);
  });

  it("different brand on the same model never clusters", () => {
    const a = { title: "Samsung Galaxy S24", identifiers: { ean: "1111111111116" } };
    const b = { title: "Apple Galaxy S24", identifiers: { ean: "1111111111116" } };
    // A shared identifier overrides title-derived brand disagreement (same thing).
    expect(classifyListingPair(a, b)).toBe(1);
  });

  it("signature key is stable and memoized", () => {
    const a = clusterSignature("Apple iPhone 15 Pro 256GB");
    const b = clusterSignature("Apple iPhone 15 Pro 256GB");
    expect(a.key).toBe("apple|iphone-15-pro|256gb");
    expect(a).toBe(b);
  });
});

describe("cluster: proven-different conflicts", () => {
  it("conflicting shared identifier type blocks a merge", () => {
    expect(
      listingPairProvenDifferent(
        { title: "X", identifiers: { ean: "0000000000001" } },
        { title: "X", identifiers: { ean: "0000000000002" } },
      ),
    ).toBe(true);
  });

  it("equal model with different storage is proven different", () => {
    expect(
      listingPairProvenDifferent(
        { title: "iPhone 15 Pro 256GB" },
        { title: "iPhone 15 Pro 512GB" },
      ),
    ).toBe(true);
  });

  it("a different model is not a conflict (no proof, caller falls back)", () => {
    expect(
      listingPairProvenDifferent(
        { title: "Apple iPhone 15 Pro 256GB" },
        { title: "Apple iPhone 14 Pro 256GB" },
      ),
    ).toBe(false);
  });

  it("no proof (no model) is NOT a conflict", () => {
    expect(
      listingPairProvenDifferent({ title: "Wireless Headphones" }, { title: "Headset" }),
    ).toBe(false);
  });
});