/**
 * Phase 5 — Admitad emitter migration through the uniform indirect adapter.
 *
 * `admitadFeedsToCatalogItems` is production emission for the Admitad network.
 * After migration it builds every item from the RawOffer produced by the
 * UNIFORM indirect adapter (`retargetIndirectFeedOffer`). These tests pin the
 * emitted NormalizedCatalogItem bytes so the migration cannot change what the
 * UI / database sees.
 */
import { describe, expect, it } from "vitest";

import {
  admitadFeedsToCatalogItems,
  admitadFeedToIndirectFeedOffer,
  ADMITAD_PROVIDER_ID,
} from "@/lib/integrations/admitad";
import type { AdmitadFeedResult } from "@/lib/integrations/admitad";
import type { AdmitadFeedOffer } from "@/lib/integrations/admitad/types";
import { retargetIndirectFeedOffer } from "@/lib/canonical";

function feed(over: { campaign?: string; offers?: AdmitadFeedOffer[] } = {}): AdmitadFeedResult {
  return {
    feedName: "Ajazz",
    feedSlug: "ajazz",
    offers: over.offers ?? [makeDefaultOffer()],
  };
}

function makeDefaultOffer(): AdmitadFeedOffer {
  return {
    id: "1412197",
    name: "Mechanical Keyboard Mechanical87",
    price: 38.9,
    oldprice: 45,
    currencyId: "USD",
    description: "Wireless mechanical keyboard",
    vendor: "Ajazz",
    url: "https://go.admitad.com/redirect/1412197",
    image: "https://laz-img-cdn.alicdn.com/images/ims-web/TB1w9Keyphoto.jpg",
    modified_time: "",
  };
}

describe("admitadFeedToIndirectFeedOffer — adapter adaptation", () => {
  it("maps native Admitad fields onto the neutral indirect feed shape", () => {
    const indirect = admitadFeedToIndirectFeedOffer(feed().offers[0]);
    expect(indirect).toEqual({
      id: "1412197",
      title: "Mechanical Keyboard Mechanical87",
      price: 38.9,
      currency: "USD",
      url: "https://go.admitad.com/redirect/1412197",
      brand: "Ajazz",
      imageUrl: "https://laz-img-cdn.alicdn.com/images/ims-web/TB1w9Keyphoto.jpg",
      originalPrice: 45,
      countryCode: "US",
    });
  });

  it("leaves empty optional fields undefined (never fabricates)", () => {
    const indirect = admitadFeedToIndirectFeedOffer({
      ...makeDefaultOffer(),
      image: "",
      vendor: "",
      oldprice: null,
    });
    expect(indirect.imageUrl).toBeUndefined();
    expect(indirect.brand).toBeUndefined();
    expect(indirect.originalPrice).toBeUndefined();
    expect(indirect.url).toBe("https://go.admitad.com/redirect/1412197");
  });
});

describe("admitadFeedsToCatalogItems — byte-identical after migration", () => {
  it("emits the same NormalizedCatalogItem the pre-migration code produced", () => {
    const items = admitadFeedsToCatalogItems([feed()]);
    expect(items).toHaveLength(1);

    const item = items[0];
    expect(item.id).toBe("ajazz-1412197");
    expect(item.slug).toBe("ajazz-1412197");
    expect(item.title).toBe("Mechanical Keyboard Mechanical87");
    expect(item.imageUrl).toBe(
      "https://laz-img-cdn.alicdn.com/images/ims-web/TB1w9Keyphoto.jpg",
    );
    expect(item.emoji).toBe("🛍️");
    expect(item.categorySlug).toBe("general");
    expect(item.rating).toBe(0);
    expect(item.reviewCount).toBe(0);
    expect(item.countryCode).toBe("US");
    expect(item.currency).toBe("USD");
    expect(item.price).toBe(38.9);
    expect(item.originalPrice).toBe(45);
    expect(item.discount).toBe(14);
    expect(item.discountType).toBe("percentage");
    expect(item.providerIds).toEqual(["admitad"]);
    expect(item.fetchedAt).toEqual(expect.any(String));

    expect(item.offers).toHaveLength(1);
    const offer = item.offers[0];
    expect(offer.providerId).toBe("admitad");
    expect(offer.storeSlug).toBe("ajazz");
    expect(offer.storeName).toBe("Ajazz");
    expect(offer.externalId).toBe("1412197");
    expect(offer.price).toBe(38.9);
    expect(offer.originalPrice).toBe(45);
    expect(offer.currency).toBe("USD");
    expect(offer.countryCode).toBe("US");
    expect(offer.affiliateUrl).toBe("https://go.admitad.com/redirect/1412197");
    expect(offer.productUrl).toBe("https://go.admitad.com/redirect/1412197");
    expect(offer.inStock).toBe(true);
  });

  it("preserves originalPrice = price when the feed has no oldprice", () => {
    const items = admitadFeedsToCatalogItems([
      feed({
        offers: [
          {
            ...feed().offers[0],
            id: "777",
            oldprice: null,
          },
        ],
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("ajazz-777");
    expect(items[0].originalPrice).toBe(38.9);
    expect(items[0].discount).toBe(0);
    expect(items[0].offers[0].originalPrice).toBe(38.9);
  });

  it("keeps oldprice <= price verbatim (UI rule, no rejection)", () => {
    const items = admitadFeedsToCatalogItems([
      feed({
        offers: [
          {
            ...feed().offers[0],
            id: "888",
            oldprice: 30,
          },
        ],
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].originalPrice).toBe(30);
    expect(items[0].discount).toBe(0);
  });

  it("skips offers without a destination URL", () => {
    const items = admitadFeedsToCatalogItems([
      feed({
        offers: [
          {
            ...feed().offers[0],
            id: "999",
            url: "",
          },
        ],
      }),
    ]);
    expect(items.map((i) => i.id)).not.toContain("ajazz-999");
  });

  it("skips offers whose image normalizes to the placeholder", () => {
    const [{ ...noImage }] = feed().offers;
    const items = admitadFeedsToCatalogItems([
      feed({
        offers: [
          {
            ...noImage,
            id: "aaa",
            image: "",
          },
        ],
      }),
    ]);
    expect(items.map((i) => i.id)).toEqual([]);
  });
});

describe("admitad adapter output is the uniform indirect adapter output", () => {
  it("produces the same RawOffer that enters the canonical spine", () => {
    const offer = feed().offers[0];
    const viaMigration = retargetIndirectFeedOffer(admitadFeedToIndirectFeedOffer(offer), {
      providerId: ADMITAD_PROVIDER_ID,
      merchantName: "Ajazz",
      sourceRef: "feed:ajazz",
    });
    expect(viaMigration.acquisition).toBe("indirect");
    expect(viaMigration.merchantName).toBe("Ajazz");
    expect(viaMigration.providerId).toBe("admitad");
    expect(viaMigration.externalOfferId).toBe("1412197");
    expect(viaMigration.affiliateTrackable).toBe(true);
    expect(viaMigration.affiliateUrl).toBe("https://go.admitad.com/redirect/1412197");
    expect(viaMigration.originalPrice).toBe(45);
  });
});