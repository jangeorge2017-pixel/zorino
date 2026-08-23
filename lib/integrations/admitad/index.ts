import type { AdmitadFeedOffer } from "./types";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import { normalizeProductImageUrl } from "@/lib/images/product-image";

export { ADMITAD_FEEDS, ADMITAD_PROVIDER_ID, FEED_CACHE_TTL_MS } from "./config";
export { fetchAdmitadFeedProducts, isAdmitadFeedReady } from "./feed-fetcher";
export { obtainAccessToken, getAccessToken, invalidateToken } from "./auth";
export { runAdmitadIngestion } from "./ingestion";
export {
  discoverAdmitadMerchants,
  getAdmitadPrograms,
  generateAdmitadDeeplinkForDestination,
} from "./merchant-discovery";
export type {
  AdmitadMerchantProgram,
  MerchantDiscoveryResult,
} from "./merchant-discovery";
export type { AdmitadFeedOffer, AdmitadFeedConfig } from "./types";
export type { IngestionResult } from "./ingestion";

export type AdmitadFeedResult = {
  offers: AdmitadFeedOffer[];
  feedName: string;
  feedSlug: string;
};

/**
 * Convert live feed offers into catalog items while preserving the real
 * merchant identity of every program: slug/id are namespaced by feed slug
 * (`admitad-<campaignId>-<offerId>`), store name is the actual merchant
 * name reported by Admitad.
 */
export function admitadFeedsToCatalogItems(
  feeds: AdmitadFeedResult[],
): NormalizedCatalogItem[] {
  const items: NormalizedCatalogItem[] = [];
  for (const feed of feeds) {
    for (const offer of feed.offers.slice(0, 500)) {
      if (!offer.url) continue;
      const discount =
        offer.oldprice && offer.oldprice > offer.price
          ? Math.round(((offer.oldprice - offer.price) / offer.oldprice) * 100)
          : 0;
      const id = `${feed.feedSlug}-${offer.id}`;
      items.push({
        id,
        slug: id,
        title: offer.name,
        imageUrl: normalizeProductImageUrl(offer.image || ""),
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
            storeSlug: feed.feedSlug,
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
