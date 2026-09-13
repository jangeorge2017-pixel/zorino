/**
 * Deterministic matching tests (Phase 1).
 */
import { describe, expect, it } from "vitest";

import {
  attributesCompatible,
  canonicalProductKey,
  matchOffers,
  variantFingerprint,
} from "@/lib/canonical";
import type { OfferIdentifier } from "@/lib/canonical";

type OfferOverrides = Partial<{
  providerId: string;
  externalOfferId: string;
  brand?: string | undefined;
  model?: string | undefined;
  title: string;
  identifiers: OfferIdentifier[];
  attributes: Record<string, string>;
}>;

function offer(partial: OfferOverrides = {}) {
  const defaults = {
    providerId: "aliexpress",
    externalOfferId: "id-1",
    brand: "Sony",
    model: "XM5",
    title: "Sony WH-1000XM5",
    identifiers: [] as OfferIdentifier[],
    attributes: undefined as Record<string, string> | undefined,
  };
  return { ...defaults, ...partial };
}

describe("matchOffers — provider-native id", () => {
  it("exact match on the same provider external id", () => {
    const m = matchOffers(offer({ externalOfferId: "ae-77" }), offer({ externalOfferId: "ae-77" }));
    expect(m.confidence).toBe("exact");
    expect(m.sameVariant).toBe(true);
  });
  it("does NOT exact-match different ids on the same provider", () => {
    const m = matchOffers(offer({ externalOfferId: "ae-77" }), offer({ externalOfferId: "ae-78" }));
    expect(m.confidence).not.toBe("exact");
    expect(m.signals).not.toContain("same-provider-external-id");
  });
});

describe("matchOffers — global identifiers", () => {
  it("exact on shared GTIN/EAN/UPC numeric space", () => {
    const a = offer({ identifiers: [{ type: "ean", value: "0 19519 80556 87" }] });
    const b = offer({ identifiers: [{ type: "upc", value: "0195198055687" }] });
    const m = matchOffers(a, b);
    expect(m.confidence).toBe("exact");
  });
  it("conflict on differing identifiers never merges", () => {
    const a = offer({ identifiers: [{ type: "ean", value: "111" }] });
    const b = offer({
      providerId: "ebay",
      externalOfferId: "e2",
      identifiers: [{ type: "mpn", value: "222" }],
    });
    const m = matchOffers(a, b);
    expect(m.confidence).not.toBe("exact");
    expect(m.confidence).not.toBe("strong");
    expect(m.signals).toContain("identifier-conflict");
  });
});

describe("matchOffers — brand + model", () => {
  it("strong match when brand and model agree", () => {
    const m = matchOffers(offer({}), offer({ title: "Sony WH-1000XM5 Wireless", externalOfferId: "x2" }));
    expect(m.confidence).toBe("strong");
    expect(m.sameVariant).toBe(true);
  });
  it("no strong match when brand differs", () => {
    const m = matchOffers(offer({ brand: "Bose" }), offer({ externalOfferId: "x2" }));
    expect(m.confidence).not.toBe("strong");
  });
});

describe("matchOffers — title last resort", () => {
  it("suggested (never exact/strong) on strong title similarity", () => {
    const m = matchOffers(
      offer({
        providerId: "ebay",
        externalOfferId: "e1",
        brand: undefined,
        model: undefined,
        title: "iPhone 15 Pro Max 256GB Natural Titanium",
      }),
      offer({
        providerId: "amazon",
        externalOfferId: "e2",
        brand: undefined,
        model: undefined,
        title: "iPhone 15 Pro Max 256GB Natural Titanium",
      }),
    );
    expect(m.confidence).toBe("suggested");
  });
});

describe("variant handling", () => {
  it("variant fingerprint differentiates capacity", () => {
    expect(
      variantFingerprint({ capacity: "128GB" }),
    ).not.toBe(variantFingerprint({ capacity: "256GB" }));
  });
  it("attributesCompatible true when no conflicting shared key", () => {
    expect(attributesCompatible({ capacity: "128GB" }, { color: "Black" })).toBe(true);
    expect(attributesCompatible({ capacity: "128GB" }, { capacity: "128GB" })).toBe(true);
  });
  it("attributesCompatible false on conflicting shared key", () => {
    expect(attributesCompatible({ capacity: "128GB" }, { capacity: "256GB" })).toBe(false);
  });
});

describe("canonicalProductKey", () => {
  it("prefers brand+model over title", () => {
    expect(canonicalProductKey({ title: "Sony XM5", brand: "Sony", model: "XM5" })).toBe(
      "bm|sony|xm5",
    );
  });
  it("falls back to normalized title", () => {
    expect(canonicalProductKey({ title: "Sony XM5  " })).toBe("title|sony xm5");
  });
});