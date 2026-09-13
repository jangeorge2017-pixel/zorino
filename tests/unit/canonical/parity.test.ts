/**
 * Parity conformance tests (Phase 2).
 *
 * Proves the canonical spine (retarget → validate → canonicalize) preserves
 * exactly what production currently produces, for every active provider, and
 * rejects nothing production accepts (and vice versa).
 */
import { describe, expect, it } from "vitest";

import {
  canonicalizeOffer,
  checkListingParity,
  listingParityPasses,
  retargetSearchListing,
  summarizeParity,
  validateOffer,
  CANONICAL_REJECTION_BY_CONDITION,
} from "@/lib/canonical";
import type { RawProviderListing } from "@/lib/search/types";

function fixture(over: Partial<RawProviderListing> = {}, providerId: string = "aliexpress"): RawProviderListing {
  return {
    providerId,
    externalId: providerId === "admitad" ? "admitad-1412197" : `${providerId}-100500612345`,
    title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
    imageUrl: "https://ae01.alicdn.com/img/parity-gallery.jpg",
    price: providerId === "admitad" ? 38.9 : 299,
    originalPrice: providerId === "admitad" ? 45 : 399,
    discount: 20,
    currency: "USD",
    storeName: providerId === "admitad" ? "Alibaba" : `${providerId} Store`,
    category: "Electronics",
    rating: 4.6,
    reviewCount: 1200,
    inStock: true,
    productUrl: "https://www.aliexpress.com/item/100500612345.html",
    affiliateUrl: providerId === "admitad"
      ? "https://go.admitad.com/redirect/123"
      : "https://www.aliexpress.com/item/100500612345.html?aff=42",
    countryCode: "US",
    ...over,
  };
}

const ACTIVE_PROVIDERS = ["aliexpress", "ebay", "cjdropshipping", "admitad"] as const;

describe("listing parity — every active provider passes all clauses", () => {
  for (const providerId of ACTIVE_PROVIDERS) {
    it(`preserves production field semantics for ${providerId}`, () => {
      const listing = fixture({}, providerId);
      const outcome = canonicalizeOffer(retargetSearchListing(listing));
      if (!outcome.offer) {
        throw new Error(`fixture should canonicalize for ${providerId}: ${summarizeParity([])}\n` +
          JSON.stringify(outcome.validation, null, 2));
      }
      const results = checkListingParity(listing, outcome.offer);
      const failed = results.filter((r) => !r.passes);
      expect(failed).toEqual([]);
      expect(listingParityPasses(listing, outcome.offer)).toBe(true);
    });
  }
});

describe("listing parity — details", () => {
  it("preserves provider-native id, price, currency, image, url", () => {
    const listing = fixture({}, "aliexpress");
    const offer = canonicalizeOffer(retargetSearchListing(listing)).offer!;
    const results = checkListingParity(listing, offer);
    const byDim = new Map(results.map((r) => [r.dimension, r]));
    expect(byDim.get("provider")?.passes).toBe(true);
    expect(byDim.get("identity")?.passes).toBe(true);
    expect(byDim.get("price")?.passes).toBe(true);
    expect(byDim.get("currency")?.passes).toBe(true);
    expect(byDim.get("image")?.passes).toBe(true);
    expect(byDim.get("url")?.passes).toBe(true);
    expect(summarizeParity(results)).toContain("parity PASS");
  });

  it("flags a price drift as a parity failure (gate must catch divergence)", () => {
    const listing = fixture({ price: 299 });
    const offer = canonicalizeOffer(
      retargetSearchListing({ ...listing, price: 250 }),
    ).offer!;
    const priceClause = checkListingParity(listing, offer).find(
      (r) => r.dimension === "price",
    );
    expect(priceClause?.passes).toBe(false);
    expect(listingParityPasses(listing, offer)).toBe(false);
  });

  it("maps stock state one-to-one (inStock ↔ availability)", () => {
    const out = canonicalizeOffer(
      retargetSearchListing(fixture({ inStock: false }, "aliexpress")),
    ).offer!;
    expect(out.availability).toBe("out_of_stock");
  });
});

describe("rejection parity — canonical rejects what production refuses", () => {
  it("rejects a listing with a blank title (production normalize returns null)", () => {
    const stale = retargetSearchListing(fixture({}, "aliexpress"));
    const r = validateOffer({ ...stale, title: "   " });
    expect(r.status).toBe("rejected");
    expect(r.rejectedCodes).toContain("G2_TITLE_MISSING");
  });

  it("rejects a non-positive price (production normalize returns null)", () => {
    const stale = retargetSearchListing(fixture({}, "aliexpress"));
    const r = validateOffer({ ...stale, price: 0 });
    expect(r.rejectedCodes).toContain("G2_PRICE_INVALID");
  });

  it("rejects a listing whose image is not http (production normalize returns null)", () => {
    const stale = retargetSearchListing(fixture({}, "aliexpress"));
    const r = validateOffer({ ...stale, images: [{ url: "not-a-url" }] });
    expect(r.status).toBe("rejected");
    expect(
      r.rejectedCodes.some((c) =>
        ["G2_IMAGE_INVALID", "G3_IMAGE_PLACEHOLDER"].includes(c),
      ),
    ).toBe(true);
  });

  it("rejects an indirect listing without a usable affiliate target (production returns null)", () => {
    const raw = retargetSearchListing(fixture({}, "admitad"));
    const r = validateOffer({
      ...raw,
      affiliateUrl: undefined,
      affiliateTrackable: false,
    });
    expect(r.status).toBe("rejected");
    expect(r.rejectedCodes).toContain("G2_AFFILIATE_TARGET_BAD");
  });
});

describe("rejection parity map", () => {
  it("documents the canonical G-codes for each production reject condition", () => {
    // The map is the audit trail: every production refusal has a canonical code.
    expect(CANONICAL_REJECTION_BY_CONDITION["missing-affiliate-target"]).toContain(
      "G2_AFFILIATE_TARGET_BAD",
    );
    expect(CANONICAL_REJECTION_BY_CONDITION["non-positive-price"]).toContain(
      "G2_PRICE_INVALID",
    );
  });
});