/**
 * Direct + indirect acquisition convergence tests (Phases 1 + 5).
 */
import { describe, expect, it } from "vitest";

import { runAcquisition, summarizeRun, runAllAcquisition } from "@/lib/canonical/acquisition";
import { mergeProductBatches } from "@/lib/canonical";
import {
  createDirectAcquirer,
  createIndirectFeedAcquirer,
  type IndirectFeedSource,
} from "@/lib/canonical";
import type { RawOffer } from "@/lib/canonical";

function directRaw(over: Partial<RawOffer> = {}): RawOffer {
  return {
    providerId: "aliexpress",
    externalOfferId: "ae-d1",
    acquisition: "direct",
    title: "Sony WH-1000XM5 Headphones",
    brand: "Sony",
    model: "XM5",
    price: 299,
    currency: "USD",
    images: [{ url: "https://ae01.alicdn.com/img/a.jpg" }],
    productUrl: "https://www.aliexpress.com/item/ae-d1.html",
    availability: "in_stock",
    ...over,
  };
}

function indirectRaw(over: Partial<RawOffer> = {}): RawOffer {
  return {
    providerId: "admitad",
    externalOfferId: "ad-1",
    acquisition: "indirect",
    title: "iPhone 15 128GB Black",
    brand: "Apple",
    model: "iPhone 15",
    price: 699,
    currency: "USD",
    images: [{ url: "https://ae01.alicdn.com/img/i.jpg" }],
    productUrl: "https://www.aliexpress.com/item/ad-1.html",
    affiliateUrl: "https://gotolink.admitad.com/x",
    affiliateTrackable: true,
    availability: "in_stock",
    sourceRef: "feed-batch-2026-09",
    merchantName: "Alibaba",
    ...over,
  };
}

describe("runAcquisition — direct", () => {
  it("converges direct raw offers into canonical products", async () => {
    const result = await runAcquisition({
      mode: "direct",
      strategy: "aliexpress-dpapi",
      fetchOffers: async () => [directRaw()],
    });
    expect(result.counts.acquired).toBe(1);
    expect(result.counts.accepted).toBe(1);
    expect(result.counts.products).toBe(1);
    expect(result.offers[0].acquisition.strategy).toBe("aliexpress-dpapi");
    expect(result.offers[0].acquisition.mode).toBe("direct");
  });

  it("drops raw offers that fail validation and reports them", async () => {
    const result = await runAcquisition({
      mode: "direct",
      strategy: "ebay-browse",
      fetchOffers: async () => [directRaw({ externalOfferId: undefined }), directRaw()],
    });
    expect(result.counts.acquired).toBe(2);
    expect(result.counts.accepted).toBe(1);
    expect(result.counts.rejected).toBe(1);
    expect(result.rejected[0].rejectedCodes).toContain("G1_EXTERNAL_ID_MISSING");
  });
});

describe("runAcquisition — indirect", () => {
  it("converges indirect link-strategy raw offers into canonical products", async () => {
    const result = await runAcquisition({
      mode: "indirect",
      strategy: "admitad-feed",
      fetchOffers: async () => [indirectRaw()],
    });
    expect(result.counts.accepted).toBe(1);
    expect(result.offers[0].acquisition.strategy).toBe("admitad-feed");
    expect(result.offers[0].acquisition.mode).toBe("indirect");
    expect(result.offers[0].storeName).toBe("Alibaba");
  });
});

describe("mergeProductBatches", () => {
  it("deterministically merges same-identity products across batches", async () => {
    const direct = await runAcquisition({
      mode: "direct",
      strategy: "aliexpress-dpapi",
      fetchOffers: async () => [
        directRaw({ identifiers: [{ type: "ean", value: "0195198055687" }] }),
      ],
    });
    const direct2 = await runAcquisition({
      mode: "direct",
      strategy: "aliexpress-dpapi",
      fetchOffers: async () => [
        directRaw({
          externalOfferId: "ae-d2",
          identifiers: [{ type: "ean", value: "0195198055687" }],
          title: "Sony WH-1000XM5 (Full review)",
        }),
      ],
    });
    const merged = mergeProductBatches([direct.products, direct2.products]);
    expect(merged.length).toBe(1);
    expect(merged[0].offerCount).toBe(2);
  });

  it("keeps genuinely different products apart", async () => {
    const a = await runAcquisition({
      mode: "direct",
      strategy: "s1",
      fetchOffers: async () => [directRaw({ identifiers: [{ type: "ean", value: "111" }] })],
    });
    const b = await runAcquisition({
      mode: "direct",
      strategy: "s1",
      fetchOffers: async () => [
        directRaw({ externalOfferId: "ae-d2", identifiers: [{ type: "ean", value: "222" }] }),
      ],
    });
    const merged = mergeProductBatches([a.products, b.products]);
    expect(merged.length).toBe(2);
  });
});

describe("summarizeRun", () => {
  it("produces a compact report string", async () => {
    const result = await runAcquisition({
      mode: "direct",
      strategy: "s",
      fetchOffers: async () => [directRaw()],
    });
    expect(summarizeRun(result)).toContain("1 raw, 1 accepted, 0 rejected, 1 canonical products");
  });
});

describe("createDirectAcquirer — DIRECT layer factory (Phase 5)", () => {
  it("retargets live connector listings into canonical products via runAcquisition", async () => {
    const acquirer = createDirectAcquirer({
      providerId: "aliexpress",
      strategy: "aliexpress-dpapi",
      fetchListings: async () => [
        {
          providerId: "aliexpress",
          externalId: "ae-100",
          title: "Sony WH-1000XM5 Headphones",
          imageUrl: "https://ae01.alicdn.com/img/a.jpg",
          price: 299,
          originalPrice: 399,
          discount: 25,
          currency: "USD",
          storeName: "Sony Official Store",
          category: "Electronics",
          rating: 4.6,
          reviewCount: 1200,
          inStock: true,
          productUrl: "https://www.aliexpress.com/item/ae-100.html",
        },
      ],
    });
    expect(acquirer.mode).toBe("direct");
    const result = await runAcquisition(acquirer);
    expect(result.counts.acquired).toBe(1);
    expect(result.counts.accepted).toBe(1);
    expect(result.offers[0].acquisition.mode).toBe("direct");
    expect(result.offers[0].acquisition.strategy).toBe("aliexpress-dpapi");
  });

  it("excludes listings that do not belong to the acquirer's provider", async () => {
    const acquirer = createDirectAcquirer({
      providerId: "ebay",
      strategy: "ebay-browse",
      fetchListings: async () => [
        {
          providerId: "aliexpress",
          externalId: "foreign",
          title: "Foreign",
          imageUrl: "https://ae01.alicdn.com/img/a.jpg",
          price: 1,
          originalPrice: 1,
          discount: 0,
          currency: "USD",
          storeName: "X",
          category: "General",
          rating: 0,
          reviewCount: 0,
          inStock: true,
          productUrl: "https://www.aliexpress.com/item/foreign.html",
        },
      ],
    });
    const result = await runAcquisition(acquirer);
    expect(result.counts.acquired).toBe(0);
    expect(result.counts.accepted).toBe(0);
  });
});

describe("createIndirectFeedAcquirer — INDIRECT layer factory (Phase 5)", () => {
  const feeds: IndirectFeedSource[] = [
    {
      feedName: "Ajazz",
      feedSlug: "ajazz",
      offers: [
        {
          id: "1412197",
          title: "Mechanical Keyboard Mechanical87",
          price: 38.9,
          currency: "USD",
          url: "https://go.admitad.com/redirect/1412197",
          imageUrl: "https://laz-img-cdn.alicdn.com/images/TB1.jpg",
          originalPrice: 45,
        },
      ],
    },
  ];

  it("adapts feed offers through the uniform indirect adapter into canonical products", async () => {
    const acquirer = createIndirectFeedAcquirer({
      providerId: "admitad",
      strategy: "admitad-feed",
      sourceRefPrefix: "feed",
      fetchFeeds: async () => feeds,
    });
    expect(acquirer.mode).toBe("indirect");
    const result = await runAcquisition(acquirer);
    expect(result.counts.acquired).toBe(1);
    expect(result.counts.accepted).toBe(1);
    expect(result.offers[0].acquisition.mode).toBe("indirect");
    expect(result.offers[0].acquisition.strategy).toBe("admitad-feed");
    expect(result.offers[0].acquisition.sourceRef).toBe("feed:ajazz");
    // feed merchant is the store identity for indirect networks.
    expect(result.offers[0].storeName).toBe("Ajazz");
    expect(result.products[0].offers).toHaveLength(1);
  });
});

describe("runAllAcquisition — separate layers converge in ONE pipeline (Phase 5)", () => {
  it("runs direct + indirect layers in parallel and merges into one result", async () => {
    const direct = createDirectAcquirer({
      providerId: "aliexpress",
      strategy: "aliexpress-dpapi",
      fetchListings: async () => [
        {
          providerId: "aliexpress",
          externalId: "ae-100",
          title: "Sony WH-1000XM5 Headphones",
          imageUrl: "https://ae01.alicdn.com/img/a.jpg",
          price: 299,
          originalPrice: 399,
          discount: 25,
          currency: "USD",
          storeName: "Sony Official Store",
          category: "Electronics",
          rating: 4.6,
          reviewCount: 1200,
          inStock: true,
          productUrl: "https://www.aliexpress.com/item/ae-100.html",
        },
      ],
    });
    const indirect = createIndirectFeedAcquirer({
      providerId: "admitad",
      strategy: "admitad-feed",
      fetchFeeds: async () => [
        {
          feedName: "Ajazz",
          feedSlug: "ajazz",
          offers: [
            {
              id: "1412197",
              title: "Mechanical Keyboard",
              price: 38.9,
              currency: "USD",
              url: "https://go.admitad.com/redirect/1412197",
              imageUrl: "https://laz-img-cdn.alicdn.com/images/TB1.jpg",
            },
          ],
        },
      ],
    });

    const result = await runAllAcquisition([direct, indirect]);
    expect(result.counts.acquired).toBe(2);
    expect(result.counts.accepted).toBe(2);
    expect(result.counts.rejected).toBe(0);
    expect(result.counts.products).toBe(2);
    // Modes are preserved per-offer even after the merged run.
    expect(result.offers.map((o) => o.acquisition.mode).sort()).toEqual([
      "direct",
      "indirect",
    ]);
  });

  it("surfaces rejection telemetry across both layers", async () => {
    const direct = createDirectAcquirer({
      providerId: "aliexpress",
      strategy: "aliexpress-dpapi",
      fetchListings: async () => [
        {
          providerId: "aliexpress",
          externalId: "",
          title: "Broken",
          imageUrl: "https://ae01.alicdn.com/img/a.jpg",
          price: 5,
          originalPrice: 5,
          discount: 0,
          currency: "USD",
          storeName: "Sony",
          category: "Electronics",
          rating: 0,
          reviewCount: 0,
          inStock: true,
          productUrl: "https://www.aliexpress.com/item/x.html",
        },
      ],
    });
    const indirect = createIndirectFeedAcquirer({
      providerId: "admitad",
      strategy: "admitad-feed",
      fetchFeeds: async () => [
        {
          feedName: "Ajazz",
          feedSlug: "ajazz",
          offers: [
            {
              id: "x",
              title: "No image offer",
              price: 10,
              currency: "USD",
              url: "https://go.admitad.com/redirect/x",
            },
          ],
        },
      ],
    });
    const result = await runAllAcquisition([direct, indirect]);
    expect(result.counts.acquired).toBe(2);
    expect(result.counts.accepted).toBe(0);
    expect(result.counts.rejected).toBe(2);
    expect(
      result.rejected.some((r) => r.rejectedCodes.includes("G1_EXTERNAL_ID_MISSING")),
    ).toBe(true);
    expect(
      result.rejected.some((r) => r.rejectedCodes.includes("G2_IMAGE_INVALID")),
    ).toBe(true);
  });
});