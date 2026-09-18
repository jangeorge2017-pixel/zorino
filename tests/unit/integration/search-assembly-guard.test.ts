/**
 * Regression tests — production search assembly page-1 guard.
 *
 * Production bug (verified against live search renders): when a flaky provider
 * window (eBay returning 0) leaves zero strong (exact/model) device matches,
 * the old secondary fill interleaved wrong-gen phones AND accessories (cases,
 * screen protectors) together, so a case could own slot #2 while genuine
 * wrong-gen devices waited. The page-1 fill must honor device-before-
 * accessory ordering for device queries:
 *
 *   - Phase 1: strong device matches (exact/model).
 *   - Phase 2: remaining real devices (wrong-generation phones, siblings).
 *   - Phase 3: accessories fill only the remaining slots.
 *
 * Accessory-intent queries keep their existing behavior (no device gate).
 */
import { describe, expect, it } from "vitest";

import { assembleProductionSearchResults } from "@/lib/search/production-pipeline";
import {
  exactModelPerProviderCeiling,
  SEARCH_POOL_SINGLE_PROVIDER_EXACT_SHARE,
} from "@/lib/search/production-pipeline";
import type { RawProviderListing } from "@/lib/search/types";

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

describe("production search assembly — device-before-accessory page guard", () => {
  it("leads with real devices and fills with accessories only after devices are exhausted", async () => {
    const wrongGen1 = rawListing({
      externalId: "d1",
      title: "Apple iPhone 11 64GB Unlocked Smartphone",
    });
    const wrongGen2 = rawListing({
      externalId: "d2",
      title: "Apple iPhone 7 32GB Unlocked Phone",
    });
    const phoneCase = rawListing({
      externalId: "a1",
      title: "Clear Soft Silicone Case Compatible With iPhone 15 Pro Max",
    });
    const screenProtector = rawListing({
      externalId: "a2",
      title: "Tempered Glass Screen Protector For iPhone 15 Pro Max",
    });

    const results = assembleProductionSearchResults(
      [wrongGen1, wrongGen2, phoneCase, screenProtector],
      "iphone 15 pro max",
      10,
    );

    expect(results).toHaveLength(4);

    const titles = results.map((r) => r.name);
    const deviceTitles = titles.filter((t) => t.includes("iPhone 11") || t.includes("iPhone 7"));
    const accessoryTitles = titles.filter(
      (t) => t.includes("Case") || t.includes("Screen Protector"),
    );

    expect(deviceTitles).toHaveLength(2);
    expect(accessoryTitles).toHaveLength(2);

    // Every device precedes every accessory — a case must never rank ahead of
    // a real (even wrong-generation) device in a device query.
    const lastDevice = Math.max(
      titles.indexOf(deviceTitles[0]!),
      titles.indexOf(deviceTitles[1]!),
    );
    const firstAccessory = Math.min(
      titles.indexOf(accessoryTitles[0]!),
      titles.indexOf(accessoryTitles[1]!),
    );
    expect(lastDevice).toBeLessThan(firstAccessory);
  });

  it("keeps a genuine strong device match leading over accessories", async () => {
    const genuine = rawListing({
      externalId: "g1",
      title: "Apple iPhone 15 Pro Max 512GB Unlocked",
    });
    const wrongGen = rawListing({
      externalId: "d1",
      title: "Apple iPhone 11 64GB Unlocked Smartphone",
    });
    const phoneCase = rawListing({
      externalId: "a1",
      title: "Clear Soft Silicone Case Compatible With iPhone 15 Pro Max",
    });

    const results = assembleProductionSearchResults(
      [genuine, wrongGen, phoneCase],
      "iphone 15 pro max",
      10,
    );

    expect(results[0]?.name).toContain("15 Pro Max 512GB");
    const lastDevice = results.findIndex(
      (r) => r.name.includes("15 Pro Max 512GB") || r.name.includes("iPhone 11"),
    );
    const caseIndex = results.findIndex((r) => r.name.includes("Case"));
    expect(lastDevice).toBeGreaterThanOrEqual(0);
    expect(caseIndex).toBeGreaterThan(lastDevice);
  });
});

describe("production pool — no single marketplace can crowd out genuine inventory", () => {
  const QUERY = "iphone 15";

  function exactEbay(n: number): RawProviderListing[] {
    return Array.from({ length: n }, (_, i) =>
      rawListing({
        providerId: "ebay",
        externalId: `ebay-e-${i}`,
        title: `Apple iPhone 15 ${128 + i}GB Unlocked GSM Smartphone Variant ${i}`,
      }),
    );
  }

  function exactAli(n: number): RawProviderListing[] {
    return Array.from({ length: n }, (_, i) =>
      rawListing({
        providerId: "aliexpress",
        externalId: `ali-e-${i}`,
        title: `Apple iPhone 15 128GB ${i}% Original Factory Unlocked`,
      }),
    );
  }

  function siblingAli(n: number): RawProviderListing[] {
    return Array.from({ length: n }, (_, i) =>
      rawListing({
        providerId: "aliexpress",
        externalId: `ali-s-${i}`,
        title: `Apple iPhone 14 A-Grade Refurbished 128GB Device ${i}`,
      }),
    );
  }

  function importedRows(n: number): RawProviderListing[] {
    return Array.from({ length: n }, (_, i) =>
      rawListing({
        providerId: "admitad",
        externalId: `adm-${i}`,
        title: `Apple iPhone 14 64GB Grade B Reconditioned Device ${i}`,
      }),
    );
  }

  it("bounds the exact-model ceiling to at most 60% and never below a page", () => {
    expect(SEARCH_POOL_SINGLE_PROVIDER_EXACT_SHARE).toBe(0.6);
    expect(exactModelPerProviderCeiling(200)).toBe(120);
    expect(exactModelPerProviderCeiling(50)).toBe(50);
    expect(exactModelPerProviderCeiling(10)).toBe(50);
  });

  it("keeps the genuine devices of other providers reachable when one provider has far more exact matches", () => {
    // eBay genuinely holds 200 exact iPhone 15 devices; AliExpress holds 10
    // exact + 30 same-family siblings; the imported catalog holds 20 more.
    // Without a leading-phase ceiling, eBay's exact block alone fills the whole
    // 200-slot pool and the ali siblings + imported devices are unreachable.
    const results = assembleProductionSearchResults(
      [
        ...exactEbay(200),
        ...exactAli(10),
        ...siblingAli(30),
        ...importedRows(20),
      ],
      QUERY,
      200,
    );

    expect(results).toHaveLength(200);

    const stores = new Set(results.map((r) => r.storeSlug));
    expect(stores).toEqual(new Set(["ebay", "aliexpress", "admitad"]));

    // Genuine same-family + imported inventory is reachable in the pool.
    expect(results.some((r) => /iPhone 14/.test(r.name))).toBe(true);
    expect(results.some((r) => r.storeSlug === "admitad")).toBe(true);

    // Retention, not just reachability: no genuine listing was dropped.
    // eBay's exact block is capped to 60% of the pool (100) and its overage
    // refills the tail (40); AliExpress keeps its 10 exact + 30 siblings;
    // the imported catalog keeps all 20 rows.
    expect(results.filter((r) => r.storeSlug === "ebay")).toHaveLength(140);
    expect(results.filter((r) => r.storeSlug === "aliexpress")).toHaveLength(40);
    expect(results.filter((r) => r.storeSlug === "admitad")).toHaveLength(20);

    // Relevance is preserved: the whole leading block (every provider's capped
    // exact/model share) precedes the first sibling/imported device.
    const firstSibling = results.findIndex((r) => /iPhone 14/.test(r.name));
    expect(firstSibling).toBeGreaterThanOrEqual(110);
    for (let i = 0; i < firstSibling; i++) {
      expect(results[i]!.name).toContain("iPhone 15");
    }
  });

  it("does not fabricate or trim a genuinely lone provider — real stock fills the pool", () => {
    const results = assembleProductionSearchResults(
      exactEbay(200),
      QUERY,
      200,
    );

    expect(results).toHaveLength(200);
    expect(results.every((r) => r.storeSlug === "ebay")).toBe(true);
    expect(results.every((r) => /iPhone 15/.test(r.name))).toBe(true);
  });
});