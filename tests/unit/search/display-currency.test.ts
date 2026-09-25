/**
 * Render-side currency normalisation (Feature "USD→EGP math, not cosmetic").
 *
 * Provider listings carry their real source currency; the UI renders in the
 * visitor's currency via formatPrice() WITHOUT fromCurrency, so an untouched
 * $849 listing used to show as "849 ج.م". The seam converts the actual value
 * to EGP and stamps currency "EGP" at the search landing surfaces so number
 * and label always agree — while the engine/pool math (floors, dedup, compare
 * ratios) keeps consuming the raw source currency.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  toDisplayCurrency,
  toEgpDisplayCurrency,
  DISPLAY_CURRENCY,
} from "@/lib/search/display-currency";
import {
  searchProductsSurface,
  searchResultsPagedSurface,
  setCanonicalSearchFetcherForTests,
} from "@/lib/canonical/consumption/search";
import {
  setSurfaceEnabledForTests,
  resetSurfaceFlagsForTests,
} from "@/lib/canonical/consumption/feature";
import { setCanonicalEnabledForTests, resetCanonicalFlagForTests } from "@/lib/canonical/feature";
import type { SearchResultItem } from "@/lib/data/homepage";

function item(over: Partial<SearchResultItem> & { id: string }): SearchResultItem {
  return {
    id: over.id,
    name: over.name ?? "Apple iPhone 15 Pro Max 256GB",
    imageSrc: "https://img.example.com/1.jpg",
    emoji: "📱",
    price: over.price ?? 849,
    originalPrice: over.originalPrice ?? 999,
    discount: over.discount ?? Math.round(((999 - 849) / 999) * 100),
    store: over.store ?? "eBay",
    storeSlug: over.storeSlug ?? "ebay",
    rating: over.rating ?? 4.8,
    reviewCount: over.reviewCount ?? 120,
    inStock: over.inStock ?? true,
    category: over.category ?? "Mobile Phones",
    currency: over.currency,
    countryCode: over.countryCode,
    affiliateUrl: over.affiliateUrl ?? "https://ebay.example.com/p?aff=1",
  };
}

describe("toEgpDisplayCurrency (pure helper)", () => {
  it("converts USD price and originalPrice to EGP and stamps the currency", () => {
    const out = toEgpDisplayCurrency([item({ id: "a", price: 849, originalPrice: 999 })]);
    expect(out[0]!.price).toBe(849 * 48.5); // 41176.5
    expect(out[0]!.originalPrice).toBe(999 * 48.5); // 48451.5
    expect(out[0]!.currency).toBe("EGP");
    expect(DISPLAY_CURRENCY).toBe("EGP");
  });

  it("is identity for rows already in EGP (never double-converts)", () => {
    const src = item({ id: "egp-in", price: 20000, originalPrice: 25000, currency: "EGP" });
    const out = toEgpDisplayCurrency([src]);
    expect(out[0]).toBe(src);
    expect(out[0]!.price).toBe(20000);
  });

  it("treats a missing currency field as USD (US-catalog DB default)", () => {
    const out = toEgpDisplayCurrency([item({ id: "no-cur", price: 100 })]);
    expect(out[0]!.price).toBe(4850);
    expect(out[0]!.currency).toBe("EGP");
  });

  it("converts non-USD supported currencies through the USD pivot", () => {
    // EUR → USD → EGP: 10 EUR = 10/0.92 USD * 48.5 EGP = 527.17
    const out = toEgpDisplayCurrency([item({ id: "eur", price: 10, currency: "EUR" })]);
    expect(out[0]!.price).toBe(527.17);
    expect(out[0]!.currency).toBe("EGP");
  });

  it("keeps discount percentage and every non-price field intact", () => {
    const src = item({ id: "meta", price: 849, originalPrice: 999, discount: 15, rating: 4.2 });
    const out = toEgpDisplayCurrency([src])[0]!;
    expect(out.discount).toBe(15);
    expect(out.rating).toBe(4.2);
    expect(out.id).toBe("meta");
    expect(out.name).toBe(src.name);
  });

  it("passes rows through untouched when currency is explicitly unsupported (e.g. UAH)", () => {
    const src = item({ id: "uah", price: 34879, originalPrice: 38200, currency: "UAH" });
    const out = toEgpDisplayCurrency([src]);
    expect(out[0]).toBe(src);
    expect(out[0]!.price).toBe(34879);
    expect(out[0]!.currency).toBe("UAH");
  });

  it("handles originalPrice 0 without NaN", () => {
    const out = toEgpDisplayCurrency([item({ id: "zero", price: 50, originalPrice: 0 })]);
    expect(out[0]!.originalPrice).toBe(0);
    expect(out[0]!.price).toBe(2425);
  });
});

describe("toDisplayCurrency (active-currency generalized seam)", () => {
  it("target USD converts an EGP row to USD and stamps USD", () => {
    // 20,000 EGP ≈ $412.4 (static pivot 48.5). US visitor sees the real number.
    const out = toDisplayCurrency(
      [item({ id: "egp-in-usd", price: 20000, originalPrice: 25000, currency: "EGP" })],
      "USD",
    );
    expect(out[0]!.price).toBeCloseTo(412.37, 1);
    expect(out[0]!.originalPrice).toBeCloseTo(515.46, 1);
    expect(out[0]!.currency).toBe("USD");
  });

  it("target USD leaves a USD row untouched, and passes unsupported rows through", () => {
    const usd = item({ id: "usd-in", price: 849, currency: "USD" });
    const uah = item({ id: "uah-in", price: 34879, currency: "UAH" });
    const out = toDisplayCurrency([usd, uah], "USD");
    expect(out[0]).toBe(usd);
    expect(out[1]).toBe(uah);
  });

  it("target EGP (legacy) equals toEgpDisplayCurrency exactly", () => {
    const src = item({ id: "x", price: 849, originalPrice: 999 });
    expect(toDisplayCurrency([src], "EGP")).toEqual(toEgpDisplayCurrency([src]));
  });

  it("target USD is identity on a plain US-catalog row (missing currency = USD)", () => {
    const src = item({ id: "no-cur", price: 100 });
    const out = toDisplayCurrency([src], "USD");
    expect(out[0]!.price).toBe(100);
    expect(out[0]!.originalPrice).toBe(src.originalPrice);
    expect(out[0]!.currency).toBe("USD");
  });
});

describe("search landing seams emit EGP prices (gate ON)", () => {
  beforeEach(() => {
    setCanonicalEnabledForTests(true);
    setSurfaceEnabledForTests("search", true);
  });

  afterEach(() => {
    resetSurfaceFlagsForTests();
    resetCanonicalFlagForTests();
    setCanonicalSearchFetcherForTests(null);
  });

  it("searchProductsSurface converts every emitted row to EGP", async () => {
    setCanonicalSearchFetcherForTests(async () => ({
      liveListings: [],
      dbItems: [
        item({ id: "db-1", name: "Apple iPhone 15 Pro Max 256GB", price: 849, originalPrice: 999, storeSlug: "admitad" }),
        item({ id: "db-2", name: "Apple iPhone 15 Pro 256GB", price: 1120, originalPrice: 1248, storeSlug: "admitad" }),
      ],
      activeProviders: ["admitad"],
    }));
    const items = await searchProductsSurface("iphone 15 pro max", 10);
    expect(items.length).toBe(2);
    for (const it of items) {
      expect(it.currency).toBe("EGP");
      expect(it.price).toBeGreaterThan(1000);
    }
    expect(items[0]!.price).toBe(849 * 48.5);
  });

  it("paged surface returns EGP prices on the in-window slice", async () => {
    setCanonicalSearchFetcherForTests(async () => ({
      liveListings: [],
      dbItems: [
        item({ id: "pg-1", name: "Apple iPhone 15 Pro Max 256GB", price: 849, storeSlug: "admitad" }),
        item({ id: "pg-2", name: "Samsung Galaxy S24 Ultra", price: 960, storeSlug: "admitad" }),
      ],
      activeProviders: ["admitad"],
    }));
    const page = await searchResultsPagedSurface("wireless earbuds pro pg-egp", 0, 2);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]!.currency).toBe("EGP");
    expect(page.items[0]!.price).toBe(849 * 48.5);
  });

  it("paged surface preserves EGP rows verbatim on the pool window", async () => {
    setCanonicalSearchFetcherForTests(async () => ({
      liveListings: [],
      dbItems: [
        item({ id: "egy-1", name: "إصدار مصري هاتف", price: 15000, originalPrice: 17000, currency: "EGP", storeSlug: "admitad" }),
      ],
      activeProviders: ["admitad"],
    }));
    const page = await searchResultsPagedSurface("هاتف", 0, 1);
    expect(page.items[0]!.currency).toBe("EGP");
    expect(page.items[0]!.price).toBe(15000);
    expect(page.items[0]!.originalPrice).toBe(17000);
  });

  it("searchProductsSurface emits USD when an active USD currency is passed", async () => {
    setCanonicalSearchFetcherForTests(async () => ({
      liveListings: [],
      dbItems: [
        item({ id: "us-1", name: "Apple iPhone 15 Pro Max 256GB", price: 849, originalPrice: 999, storeSlug: "admitad" }),
        item({ id: "eg-1", name: "iPhone 15 Dual SIM", price: 40000, currency: "EGP", storeSlug: "aliexpress" }),
      ],
      activeProviders: ["admitad", "aliexpress"],
    }));
    const items = await searchProductsSurface("iphone 15 pro usd mode", 10, undefined, "USD");
    expect(items.length).toBe(2);
    // USD row untouched; the EGP row is converted to USD and stamped. The
    // canonical pool regenerates ids from the product, so key by name.
    const us = items.find((i) => i.name === "Apple iPhone 15 Pro Max 256GB")!;
    const eg = items.find((i) => i.name === "iPhone 15 Dual SIM")!;
    expect(us.price).toBe(849);
    expect(us.currency).toBe("USD");
    expect(eg.price).toBeCloseTo(40000 / 48.5, 1);
    expect(eg.currency).toBe("USD");
  });

  it("paged surface emits USD when an active USD currency is passed", async () => {
    setCanonicalSearchFetcherForTests(async () => ({
      liveListings: [],
      dbItems: [
        item({ id: "us-in", name: "Apple iPhone 15 Pro Max 256GB", price: 849, storeSlug: "admitad" }),
      ],
      activeProviders: ["admitad"],
    }));
    const page = await searchResultsPagedSurface("iphone 15 pro us", 0, 1, undefined, "USD");
    expect(page.items[0]!.currency).toBe("USD");
    expect(page.items[0]!.price).toBe(849);
  });

  it("live amazon-eg EGP row converts to USD instead of leaking raw EGP digits", async () => {
    // Regression: live-listings cards used to DROP the currency field, so an
    // EGP-priced Amazon Egypt row was treated as a US-catalog USD row and its
    // raw EGP number (94,330) was stamped "USD". The listing mappers must
    // preserve `currency` so the display seam converts to the active currency.
    setCanonicalSearchFetcherForTests(async () => ({
      liveListings: [
        {
          providerId: "amazon-eg",
          externalId: "B0EGPRO",
          title: "Apple iPhone 17 Pro Max (256 GB) - Silver with Face ID | Tax Paid",
          imageUrl: "https://img.example.com/amazon-eg-1.jpg",
          price: 94330,
          originalPrice: 94330,
          discount: 0,
          currency: "EGP",
          storeName: "Amazon Egypt",
          category: "Mobile Phones",
          rating: 4.6,
          reviewCount: 321,
          inStock: true,
          productUrl: "https://www.amazon.eg/dp/B0EGPRO",
          affiliateUrl: "https://www.amazon.eg/dp/B0EGPRO?tag=zorinoeg-21",
        },
      ],
      dbItems: [],
      activeProviders: ["amazon-eg"],
    }));
    const items = await searchProductsSurface("iphone 17 pro max usd", 10, undefined, "USD");
    expect(items.length).toBe(1);
    expect(items[0]!.price).toBeCloseTo(94330 / 48.5, 1);
    expect(items[0]!.currency).toBe("USD");
    expect(items[0]!.store).toBe("Amazon Egypt");
  });
});