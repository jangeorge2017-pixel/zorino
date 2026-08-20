import type { AdmitadFeedOffer } from "./types";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import { SEED_FEED_OFFERS } from "./seed";

const SEED_IMAGE_BY_ID = new Map(
  SEED_FEED_OFFERS.filter((o) => o.image).map((o) => [o.id, o.image]),
);

export { ADMITAD_FEEDS, ADMITAD_PROVIDER_ID, FEED_CACHE_TTL_MS } from "./config";
export { fetchAdmitadFeedProducts, isAdmitadFeedReady } from "./feed-fetcher";
export { obtainAccessToken, getAccessToken, invalidateToken } from "./auth";
export { runAdmitadIngestion } from "./ingestion";
export type { AdmitadFeedOffer, AdmitadFeedConfig } from "./types";
export type { IngestionResult } from "./ingestion";

export type AdmitadFeedResult = {
  offers: AdmitadFeedOffer[];
  feedName: string;
  feedSlug: string;
};

export function admitadFeedsToCatalogItems(
  feeds: AdmitadFeedResult[],
): NormalizedCatalogItem[] {
  const items: NormalizedCatalogItem[] = [];
  for (const feed of feeds) {
    for (const offer of feed.offers.slice(0, 500)) {
      const discount =
        offer.oldprice && offer.oldprice > offer.price
          ? Math.round(((offer.oldprice - offer.price) / offer.oldprice) * 100)
          : 0;
      items.push({
        id: `alibaba-${offer.id}`,
        slug: `alibaba-${offer.id}`,
        title: offer.name,
        imageUrl: offer.image || SEED_IMAGE_BY_ID.get(offer.id) || "",
        emoji: "🛍️",
        categorySlug: "general",
        rating: 0,
        reviewCount: 0,
        countryCode: "US",
        currency: offer.currencyId,
        price: offer.price,
        originalPrice: offer.oldprice ?? offer.price,
        discount,
        discountType: "percentage",
        providerIds: ["admitad"],
        offers: [
          {
            providerId: "admitad",
            storeSlug: "alibaba",
            storeName: feed.feedName,
            externalId: offer.id,
            price: offer.price,
            originalPrice: offer.oldprice ?? offer.price,
            currency: offer.currencyId,
            countryCode: "US",
            affiliateUrl: offer.url,
            productUrl: offer.url,
            inStock: true,
          },
        ],
        fetchedAt: new Date().toISOString(),
      });
    }
  }
  return items;
}
