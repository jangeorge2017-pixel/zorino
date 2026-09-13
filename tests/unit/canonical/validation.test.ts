/**
 * Central validation tests — G1..G4 reason-coded gates (Phase 1).
 */
import { describe, expect, it } from "vitest";

import {
  qualityScoreFromValidation,
  validateOffer,
  type ValidationProfile,
} from "@/lib/canonical";
import type { RawOffer } from "@/lib/canonical";

const validRaw: RawOffer = {
  providerId: "aliexpress",
  externalOfferId: "ae-1",
  acquisition: "direct",
  title: "Sony WH-1000XM5 Wireless Headphones",
  brand: "Sony",
  price: 299,
  originalPrice: 399,
  currency: "USD",
  images: [{ url: "https://ae01.alicdn.com/img/head.jpg" }],
  productUrl: "https://www.aliexpress.com/item/ae-1.html",
  availability: "in_stock",
};

describe("validateOffer — G1 identity", () => {
  it("rejects an unknown provider", () => {
    const r = validateOffer({ ...validRaw, providerId: "not-a-provider" });
    expect(r.status).toBe("rejected");
    expect(r.rejectedCodes).toContain("G1_PROVIDER_UNKNOWN");
  });
  it("rejects a missing external id", () => {
    const r = validateOffer({ ...validRaw, externalOfferId: undefined });
    expect(r.rejectedCodes).toContain("G1_EXTERNAL_ID_MISSING");
  });
  it("accepts a known registered provider", () => {
    expect(validateOffer(validRaw).status).not.toBe("rejected");
  });
});

describe("validateOffer — G2 required structural", () => {
  it("rejects missing title", () => {
    const r = validateOffer({ ...validRaw, title: "  " });
    expect(r.rejectedCodes).toContain("G2_TITLE_MISSING");
  });
  it("rejects non-positive / non-finite price", () => {
    for (const price of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = validateOffer({ ...validRaw, price });
      expect(r.rejectedCodes).toContain("G2_PRICE_INVALID");
    }
  });
  it("rejects invalid currency", () => {
    const r = validateOffer({ ...validRaw, currency: "US" }); // not 3 letters
    expect(r.rejectedCodes).toContain("G2_CURRENCY_INVALID");
    expect(validateOffer({ ...validRaw, currency: "USD" }).status).not.toBe("rejected");
  });
  it("rejects missing validity of image", () => {
    const r = validateOffer({ ...validRaw, images: [] });
    expect(r.status).toBe("rejected");
    expect([...r.rejectedCodes]).toContain("G2_IMAGE_INVALID");
  });
  it("rejects a missing product url", () => {
    const r = validateOffer({ ...validRaw, productUrl: undefined });
    expect(r.rejectedCodes).toContain("G2_PRODUCT_URL_INVALID");
  });
});

describe("validateOffer — G3 semantic", () => {
  it("rejects prices above a configured hard cap", () => {
    const profile: ValidationProfile = { maxPrice: 1000 };
    const r = validateOffer({ ...validRaw, price: 5000 }, profile);
    expect(r.rejectedCodes).toContain("G3_PRICE_ABOVE_HARD_CAP");
  });
  it("rejects placeholder images", () => {
    const r = validateOffer({
      ...validRaw,
      images: [{ url: "/products/placeholder.svg" }],
    });
    expect(r.rejectedCodes).toContain("G3_IMAGE_PLACEHOLDER");
  });
  it("rejects an invalid availability enum", () => {
    const r = validateOffer({ ...validRaw, availability: "garage" as never });
    expect(r.rejectedCodes).toContain("G3_AVAILABILITY_INVALID");
  });
  it("rejects an invalid fetchedAt", () => {
    const r = validateOffer({ ...validRaw, fetchedAt: "not-a-date" });
    expect(r.rejectedCodes).toContain("G3_FETCHED_AT_INVALID");
  });
});

describe("validateOffer — G4 cross-field", () => {
  it("rejects originalPrice < price when both present", () => {
    const r = validateOffer({ ...validRaw, originalPrice: 200 });
    expect(r.rejectedCodes).toContain("G4_ORIGINAL_ABOVE_PRICE");
  });
  it("accepts originalPrice >= price", () => {
    expect(validateOffer({ ...validRaw, originalPrice: 399 }).status).not.toBe("rejected");
  });
  it("rejects an affiliate host outside the allowlist", () => {
    const profile: ValidationProfile = {
      affiliateAllowlist: ["aliexpress.com"],
      requireAffiliateHost: true,
    };
    const r = validateOffer({
      ...validRaw,
      affiliateUrl: "https://www.badhost.com/?tag=zorino",
      affiliateTrackable: true,
    }, profile);
    expect(r.rejectedCodes).toContain("G4_AFFILIATE_HOST_MISMATCH");
  });
  it("rejects a negative shipping cost", () => {
    const r = validateOffer({
      ...validRaw,
      shipping: { cost: -5 },
    });
    expect(r.rejectedCodes).toContain("G4_SHIPPING_COST_NEGATIVE");
  });
});

describe("validateOffer — profiled warnings downgrade", () => {
  it("downgrades a specific gate to warned status while accepting", () => {
    const profile: ValidationProfile = { warnGates: ["G2_TITLE_MISSING"] };
    const r = validateOffer({ ...validRaw, title: "" }, profile);
    expect(r.status).toBe("warned");
    expect(r.rejectedCodes).not.toContain("G2_TITLE_MISSING");
    expect(r.warnedCodes).toContain("G2_TITLE_MISSING");
  });
  it("qualityScore reflects warnings", () => {
    const profile: ValidationProfile = { warnGates: ["G2_TITLE_MISSING"] };
    const warned = validateOffer({ ...validRaw, title: "" }, profile);
    const clean = validateOffer(validRaw);
    expect(qualityScoreFromValidation(warned)).toBeLessThan(
      qualityScoreFromValidation(clean),
    );
    expect(qualityScoreFromValidation(clean)).toBe(1);
  });
});

describe("validateOffer — indirect requires affiliate", () => {
  it("rejects an indirect offer that lacks affiliateTrackable", () => {
    const r = validateOffer({
      ...validRaw,
      acquisition: "indirect",
      affiliateUrl: "https://gotolink.admitad.com/x",
      affiliateTrackable: false,
    });
    expect(r.rejectedCodes).toContain("G2_AFFILIATE_TARGET_BAD");
  });
  it("accepts an indirect offer with a usable affiliate link", () => {
    const r = validateOffer({
      ...validRaw,
      acquisition: "indirect",
      productUrl: "https://alimama.com/o",
      affiliateUrl: "https://gotolink.admitad.com/x",
      affiliateTrackable: true,
    });
    expect(r.status).not.toBe("rejected");
  });
});