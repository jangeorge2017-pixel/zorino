/**
 * Adapter retarget tests (Phases 2 + 5).
 */
import { describe, expect, it } from "vitest";

import {
  retargetCatalogOffer,
  retargetExternalProduct,
  retargetSearchListing,
  retargetIndirectFeedOffer,
} from "@/lib/canonical/adapters";
import type {
  IndirectFeedOffer,
  IndirectFeedMeta,
} from "@/lib/canonical/adapters";
import type { NormalizedCatalogItem, ProviderOffer } from "@/lib/integration/catalog-types";
import type { RawProviderListing } from "@/lib/search/types";
import type { ExternalProduct } from "@/lib/sync/types";
import { providerAcquisitionMode } from "@/lib/canonical";

function listing(over: Partial<RawProviderListing> = {}, providerId = "aliexpress"): RawProviderListing {
  return {
    providerId,
    externalId: "ae-1005006123456789",
    title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
    imageUrl: "https://ae01.alicdn.com/img/gallery.jpg",
    price: 299,
    originalPrice: 399,
    discount: 25,
    currency: "USD",
    storeName: "Sony Official Store",
    category: "Electronics",
    rating: 4.6,
    reviewCount: 1200,
    inStock: true,
    productUrl: "https://www.aliexpress.com/item/1005006123456789.html",
    affiliateUrl: "https://www.aliexpress.com/item/1005006123456789.html?aff=123",
    countryCode: "US",
    ...over,
  };
}

describe("retargetSearchListing — direct provider", () => {
  it("maps every field 1:1 and marks the offer as direct", () => {
    const raw = retargetSearchListing(listing());
    expect(raw.acquisition).toBe("direct");
    expect(raw.providerId).toBe("aliexpress");
    expect(raw.externalOfferId).toBe("ae-1005006123456789");
    expect(raw.title).toBe(listing().title);
    expect(raw.price).toBe(299);
    expect(raw.currency).toBe("USD");
    expect(raw.images?.[0]?.url).toBe(listing().imageUrl);
    expect(raw.productUrl).toBe(listing().productUrl);
    expect(raw.availability).toBe("in_stock");
    // affiliateTrackable is only asserted for indirect feeds, never invented here
    expect(raw.affiliateTrackable).toBeUndefined();
  });

  it("derives availability from inStock", () => {
    const out = retargetSearchListing(listing({ inStock: false }));
    expect(out.availability).toBe("out_of_stock");
  });

  it("keeps originalPrice only when it is really above price (G4 semantics)", () => {
    const above = retargetSearchListing(listing({ originalPrice: 499 }));
    expect(above.originalPrice).toBe(499);
    const clamped = retargetSearchListing(listing({ originalPrice: 299 }));
    expect(clamped.originalPrice).toBeUndefined();
  });

  it("does NOT set merchantName for a direct provider (store = registry)", () => {
    const raw = retargetSearchListing(listing({ storeName: "Sony Official Store" }));
    expect(raw.merchantName).toBeUndefined();
  });
});

describe("retargetSearchListing — indirect provider (admitad)", () => {
  const admitad: RawProviderListing = {
    providerId: "admitad",
    externalId: "admitad-1412197",
    title: "Mechanical Keyboard Mechanical87",
    imageUrl: "https://laz-img-cdn.alicdn.com/images/ims-web/TB1w9Keyphoto.jpg",
    price: 38.9,
    originalPrice: 45,
    discount: 14,
    currency: "USD",
    storeName: "Alibaba",
    category: "General",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    productUrl: "https://go.admitad.com/redirect/123",
    affiliateUrl: "https://go.admitad.com/redirect/123",
  };

  it("marks the offer indirect and preserves the merchant as store identity", () => {
    const raw = retargetSearchListing(admitad);
    expect(raw.acquisition).toBe("indirect");
    expect(raw.merchantName).toBe("Alibaba");
    expect(raw.affiliateUrl).toBe("https://go.admitad.com/redirect/123");
    // Admitad feed URLs are affiliate deep-links by construction.
    expect(raw.affiliateTrackable).toBe(true);
  });
});

describe("retargetCatalogOffer", () => {
  const item: NormalizedCatalogItem = {
    id: "c-1",
    slug: "sony-wh1000xm5",
    title: "Sony WH-1000XM5 Headphones",
    imageUrl: "https://ae01.alicdn.com/img/gallery-cat.jpg",
    emoji: "🎧",
    categorySlug: "audio",
    rating: 4.7,
    reviewCount: 321,
    countryCode: "US",
    currency: "USD",
    price: 289,
    originalPrice: 399,
    discount: 27,
    discountType: "percentage",
    offers: [],
    providerIds: ["aliexpress"],
    fetchedAt: "2026-09-10T08:00:00.000Z",
  };
  const offer: ProviderOffer = {
    providerId: "aliexpress",
    storeSlug: "aliexpress",
    storeName: "AliExpress",
    externalId: "ae-cat-1",
    price: 289,
    originalPrice: 399,
    currency: "USD",
    countryCode: "US",
    productUrl: "https://www.aliexpress.com/item/ae-cat-1.html",
    affiliateUrl: "https://www.aliexpress.com/item/ae-cat-1.html?aff=9",
    inStock: true,
  };

  it("merges parent item identity with offer pricing/links", () => {
    const raw = retargetCatalogOffer(item, offer);
    expect(raw.title).toBe(item.title);
    expect(raw.price).toBe(289);
    expect(raw.productUrl).toBe(offer.productUrl);
    expect(raw.externalOfferId).toBe("ae-cat-1");
    expect(raw.fetchedAt).toBe(item.fetchedAt);
    expect(raw.countryCode).toBe("US");
  });
});

describe("retargetExternalProduct", () => {
  const product: ExternalProduct = {
    externalId: "ebay-284393027916",
    title: "iPhone 15 128GB Black",
    slug: "iphone-15-128gb-black",
    categorySlug: "smartphones",
    imageUrl: "https://i.ebayimg.com/images/g/x/m/s-l1600.jpg",
    price: 699,
    originalPrice: 799,
    currency: "USD",
    countryCode: "US",
    brand: "Apple",
    inStock: true,
    productUrl: "https://www.ebay.com/itm/284393027916",
    affiliateUrl: "https://www.ebay.com/itm/284393027916?campid=111",
    specifications: { capacity: "128GB", color: "Black" },
  };

  it("preserves brand, attributes, and sync fields", () => {
    const raw = retargetExternalProduct(product, "ebay");
    expect(raw.providerId).toBe("ebay");
    expect(raw.brand).toBe("Apple");
    expect(raw.attributes).toEqual({ capacity: "128GB", color: "Black" });
    expect(raw.productUrl).toBe(product.affiliateUrl);
    expect(providerAcquisitionMode("ebay")).toBe("direct");
  });
});

describe("retargetIndirectFeedOffer — uniform indirect adapter (Phase 5)", () => {
  const offer: IndirectFeedOffer = {
    id: "1412197",
    title: "Mechanical Keyboard Mechanical87",
    price: 38.9,
    currency: "USD",
    url: "https://go.admitad.com/redirect/1412197",
    brand: "Ajazz",
    imageUrl: "https://laz-img-cdn.alicdn.com/images/ims-web/TB1w9Keyphoto.jpg",
    originalPrice: 45,
    countryCode: "US",
  };
  const meta: IndirectFeedMeta = {
    providerId: "admitad",
    merchantName: "Ajazz",
    sourceRef: "feed:ajazz",
    fetchedAt: "2026-09-13T00:00:00.000Z",
  };

  it("marks the offer indirect and preserves the feed merchant as store identity", () => {
    const raw = retargetIndirectFeedOffer(offer, meta);
    expect(raw.acquisition).toBe("indirect");
    expect(raw.providerId).toBe("admitad");
    expect(raw.externalOfferId).toBe("1412197");
    expect(raw.title).toBe(offer.title);
    expect(raw.price).toBe(38.9);
    expect(raw.currency).toBe("USD");
    expect(raw.images?.[0]?.url).toBe(offer.imageUrl);
    expect(raw.productUrl).toBe(offer.url);
    expect(raw.countryCode).toBe("US");
    expect(raw.fetchedAt).toBe(meta.fetchedAt);
    // The network hands us the merchant deep-link — trackable by construction.
    expect(raw.affiliateUrl).toBe(offer.url);
    expect(raw.affiliateTrackable).toBe(true);
    // The feed merchant, not the network, is the store the user sees.
    expect(raw.merchantName).toBe("Ajazz");
  });

  it("keeps originalPrice only when genuinely above price (G4 semantics)", () => {
    const withAbove = retargetIndirectFeedOffer(
      { ...offer, originalPrice: 60 },
      meta,
    );
    expect(withAbove.originalPrice).toBe(60);
    const clamped = retargetIndirectFeedOffer(
      { ...offer, originalPrice: 30 },
      meta,
    );
    expect(clamped.originalPrice).toBeUndefined();
  });

  it("carries brand and defaults availability to in_stock for feed offers", () => {
    const raw = retargetIndirectFeedOffer(offer, meta);
    expect(raw.brand).toBe("Ajazz");
    expect(raw.availability).toBe("in_stock");
    const out = retargetIndirectFeedOffer({ ...offer, inStock: false }, meta);
    expect(out.availability).toBe("out_of_stock");
  });

  it("leaves image/merchant empty when the feed provides none", () => {
    const bare = retargetIndirectFeedOffer(
      { ...offer, imageUrl: undefined, merchantName: undefined },
      { ...meta, merchantName: undefined },
    );
    expect(bare.images).toEqual([]);
    expect(bare.merchantName).toBeUndefined();
  });

  it("uses offer.merchantName over meta.merchantName when both present", () => {
    const raw = retargetIndirectFeedOffer(
      { ...offer, merchantName: "Merchant From Offer" },
      { ...meta, merchantName: "Merchant From Meta" },
    );
    expect(raw.merchantName).toBe("Merchant From Offer");
  });
});