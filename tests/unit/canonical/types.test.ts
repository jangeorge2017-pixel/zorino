/**
 * CanonicalOffer / CanonicalProduct type + id tests (Phase 1).
 */
import { describe, expect, it } from "vitest";

import {
  buildCanonicalOfferId,
  buildCanonicalProductId,
  canonicalizeOffer,
  groupOffersIntoProducts,
  variantFingerprint,
} from "@/lib/canonical";
import type { CanonicalOffer, RawOffer } from "@/lib/canonical";

const baseRaw: RawOffer = {
  providerId: "aliexpress",
  externalOfferId: "ae-123",
  acquisition: "direct",
  title: "iPhone 15 128GB Black Unlocked",
  brand: "Apple",
  model: "iPhone 15",
  price: 599,
  originalPrice: 799,
  currency: "USD",
  images: [{ url: "https://ae01.alicdn.com/img/foo.jpg" }],
  productUrl: "https://www.aliexpress.com/item/ae-123.html",
  availability: "in_stock",
};

describe("canonicalOfferId", () => {
  it("builds a stable provider-scoped id", () => {
    expect(buildCanonicalOfferId("aliexpress", "ae-123")).toBe("po:aliexpress:ae-123");
  });
  it("is deterministic", () => {
    expect(buildCanonicalOfferId("ebay", "x")).toBe(buildCanonicalOfferId("ebay", "x"));
  });
});

describe("canonicalizeOffer", () => {
  it("canonicalizes a valid direct offer", () => {
    const { offer, validation } = canonicalizeOffer(baseRaw);
    expect(validation.status).toBe("accepted");
    expect(offer).toBeDefined();
    expect(offer!.canonicalOfferId).toBe("po:aliexpress:ae-123");
    expect(offer!.providerId).toBe("aliexpress");
    expect(offer!.price).toBe(599);
    expect(offer!.currency).toBe("USD");
    expect(offer!.discount?.percentage).toBeCloseTo(25, 0);
    expect(offer!.availability).toBe("in_stock");
    expect(offer!.acquisition.mode).toBe("direct");
    expect(offer!.images[0].isPrimary).toBe(true);
  });

  it("leaves unknown optional fields undefined (do NOT invent data)", () => {
    const { offer } = canonicalizeOffer({ ...baseRaw });
    // sku absent stays absent:
    expect(offer!.sku).toBeUndefined();
    // no fabricated rating field exists on the canonical offer
    expect("rating" in (offer as CanonicalOffer)).toBe(false);
  });

  it("computes discount only when an original price is present", () => {
    const { offer } = canonicalizeOffer({ ...baseRaw, originalPrice: undefined });
    expect(offer!.originalPrice).toBeUndefined();
    expect(offer!.discount).toBeUndefined();
  });

  it("rejects an offer with missing external id", () => {
    const { offer, validation } = canonicalizeOffer({ ...baseRaw, externalOfferId: undefined });
    expect(validation.status).toBe("rejected");
    expect(validation.rejectedCodes).toContain("G1_EXTERNAL_ID_MISSING");
    expect(offer).toBeUndefined();
  });

  it("rejects an indirect offer without a usable affiliate link", () => {
    const { offer, validation } = canonicalizeOffer({
      ...baseRaw,
      acquisition: "indirect",
      productUrl: "https://alimama.com/x",
      affiliateUrl: undefined,
      affiliateTrackable: false,
    });
    expect(validation.status).toBe("rejected");
    expect(validation.rejectedCodes).toContain("G2_AFFILIATE_TARGET_BAD");
    expect(offer).toBeUndefined();
  });
});

describe("variantFingerprint", () => {
  it("is order-independent and deterministic", () => {
    const a = variantFingerprint({ capacity: "128GB", color: "Black" });
    const b = variantFingerprint({ color: "Black", capacity: "128GB" });
    expect(a).toBe(b);
  });
  it("differs for different specs", () => {
    expect(
      variantFingerprint({ capacity: "128GB" }),
    ).not.toBe(variantFingerprint({ capacity: "256GB" }));
  });
  it("returns empty for no attributes", () => {
    expect(variantFingerprint(undefined)).toBe("");
  });
});

describe("groupOffersIntoProducts", () => {
  it("groups same-identifier offers into one product", () => {
    const a = canonicalizeOffer({ ...baseRaw, identifiers: [{ type: "ean", value: "0195198055687" }] }).offer!;
    const b = canonicalizeOffer({ ...baseRaw, title: "Apple iPhone 15 (128GB) - Unlocked", brand: "Apple", model: "iPhone 15", identifiers: [{ type: "ean", value: "0195198055687" }], externalOfferId: "ae-999" }).offer!;
    const products = groupOffersIntoProducts([a, b]);
    expect(products.length).toBe(1);
    expect(products[0].offerCount).toBe(2);
    expect(products[0].identifiers.some((i) => i.type === "ean")).toBe(true);
  });

  it("keeps identifier-conflicting offers in separate products", () => {
    const a = canonicalizeOffer({ ...baseRaw, identifiers: [{ type: "ean", value: "123" }] }).offer!;
    const b = canonicalizeOffer({ ...baseRaw, title: "Different Product", identifiers: [{ type: "ean", value: "456" }], externalOfferId: "xx" }).offer!;
    const products = groupOffersIntoProducts([a, b]);
    expect(products.length).toBe(2);
  });

  it("computes aggregates over grouped offers", () => {
    const a = canonicalizeOffer({ ...baseRaw, price: 100 }).offer!;
    const b = canonicalizeOffer({ ...baseRaw, title: "iPhone 15 256GB", model: "iPhone 15", price: 250, externalOfferId: "x2" }).offer!;
    const products = groupOffersIntoProducts([a, b]);
    expect(products[0].lowestPrice).toBe(100);
    expect(products[0].highestPrice).toBe(250);
  });
});

describe("buildCanonicalProductId", () => {
  it("is deterministic", () => {
    expect(buildCanonicalProductId("bm:Apple|iPhone 15")).toBe(
      buildCanonicalProductId("bm:Apple|iPhone 15"),
    );
  });
});