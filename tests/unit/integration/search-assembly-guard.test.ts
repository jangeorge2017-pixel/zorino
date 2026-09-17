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