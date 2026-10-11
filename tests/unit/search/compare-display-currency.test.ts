/**
 * Compare-side currency normalisation (the `toDisplayCurrencyOffers` seam).
 *
 * Comparison offers keep their real source currency end-to-end (USD AliExpress/
 * Admitad, EGP amazon-eg). The compare surfaces stamp the VISITOR's active
 * currency so number and label always agree — mirroring the search seam but at
 * offer/aggregate level, so `compareImportedProductPrices` stats and the
 * `PriceComparisonTable`/PDP renders agree on one currency.
 */
import { describe, expect, it } from "vitest";
import { toDisplayCurrencyOffers, type CompareOffer } from "@/services/compare";
import { computeCompareStats } from "@/lib/compare/merge";

function offer(
  id: string,
  over: Partial<CompareOffer> & { price: number },
): CompareOffer {
  return {
    id,
    productId: "p-1",
    storeId: `store-${id}`,
    originalPrice: over.originalPrice ?? null,
    currency: over.currency ?? "USD",
    countryCode: over.countryCode ?? "US",
    inStock: over.inStock ?? true,
    isCurrent: true,
    recordedAt: "2026-01-01T00:00:00Z",
    externalUrl: `https://merchant.example/${id}`,
    provider: over.provider ?? "aliexpress",
    discountPercent: over.discountPercent ?? 0,
    ...over,
  };
}

describe("toDisplayCurrencyOffers (pure helper)", () => {
  it("converts price and originalPrice to the target currency and stamps it", () => {
    const out = toDisplayCurrencyOffers(
      [offer("a", { price: 849, originalPrice: 999 })],
      "EGP",
    );
    expect(out[0]!.price).toBe(849 * 48.5);
    expect(out[0]!.originalPrice).toBe(999 * 48.5);
    expect(out[0]!.currency).toBe("EGP");
  });

  it("is identity for offers already in the target currency (never double-converts)", () => {
    const src = offer("egp", { price: 20000, originalPrice: 25000, currency: "EGP" });
    const out = toDisplayCurrencyOffers([src], "EGP");
    expect(out[0]).toBe(src);
    expect(out[0]!.price).toBe(20000);
  });

  it("converts non-USD supported currencies through the USD pivot", () => {
    // 10 EUR → USD pivot → EGP: 10/0.92 * 48.5 = 527.17
    const out = toDisplayCurrencyOffers(
      [offer("eur", { price: 10, originalPrice: 12, currency: "EUR" })],
      "EGP",
    );
    expect(out[0]!.price).toBeCloseTo(527.17, 2);
    expect(out[0]!.currency).toBe("EGP");
  });

  it("passes offers through untouched when currency is explicitly unsupported (e.g. UAH)", () => {
    const src = offer("uah", { price: 34879, originalPrice: 38200, currency: "UAH" });
    const out = toDisplayCurrencyOffers([src], "EGP");
    expect(out[0]).toBe(src);
    expect(out[0]!.price).toBe(34879);
    expect(out[0]!.currency).toBe("UAH");
  });

  it("returns a copy for a null/absent target and never mutates input", () => {
    const src = [offer("a", { price: 849 }), offer("b", { price: 1120 })];
    const out = toDisplayCurrencyOffers(src);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
    expect(src[0]!.currency).toBe("USD");
  });

  it("keeps non-price fields, provider identity, and discount intact", () => {
    const src = offer("meta", {
      price: 849,
      originalPrice: 999,
      provider: "admitad",
      discountPercent: 15,
    });
    const out = toDisplayCurrencyOffers([src], "EGP")[0]!;
    expect(out.provider).toBe("admitad");
    expect(out.discountPercent).toBe(15);
    expect(out.id).toBe("meta");
    expect(out.externalUrl).toBe(src.externalUrl);
  });

  it("recomputes aggregate stats over a converted set so rank order is preserved", () => {
    const usdHigh = offer("h", { price: 1120, originalPrice: 1248 });
    const usdLow = offer("l", { price: 849, originalPrice: 999 });
    const offers = toDisplayCurrencyOffers([usdHigh, usdLow], "EGP");
    const stats = computeCompareStats([...offers].sort((a, b) => a.price - b.price));
    expect(stats.lowestPrice).toBeCloseTo(849 * 48.5, 2);
    expect(offers.find((o) => o.id === "l")!.price).toBeCloseTo(849 * 48.5, 2);
    expect(offers.every((o) => o.currency === "EGP")).toBe(true);
  });
});