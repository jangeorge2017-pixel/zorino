import type { AdmitadFeedOffer } from "./types";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import {
  normalizeProductImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/images/product-image";
import { retargetIndirectFeedOffer } from "@/lib/canonical/adapters";
import { ADMITAD_PROVIDER_ID } from "./config";
import { admitadFeedToIndirectFeedOffer } from "./adapter";

export { ADMITAD_FEEDS, ADMITAD_PROVIDER_ID, FEED_CACHE_TTL_MS } from "./config";
export { fetchAdmitadFeedProducts, isAdmitadFeedReady } from "./feed-fetcher";
export { obtainAccessToken, getAccessToken, invalidateToken } from "./auth";
export { runAdmitadIngestion } from "./ingestion";
export {
  admitadFeedToIndirectFeedOffer,
  admitadFeedToRawOffer,
  createAdmitadFeedAcquirer,
  type AdmitadFeedToRawMeta,
} from "./adapter";
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
 *
 * Phase 5: Admitad now enters the canonical spine through the UNIFORM indirect
 * adapter — `admitadFeedToIndirectFeedOffer` → `retargetIndirectFeedOffer`.
 * This emitter consumes the adapter's RawOffer and applies the UI acceptance
 * pre-filter (url + placeholder image), keeping the emitted items byte-identical
 * to what production produced before the migration.
 */
export function admitadFeedsToCatalogItems(
  feeds: AdmitadFeedResult[],
): NormalizedCatalogItem[] {
  const items: NormalizedCatalogItem[] = [];
  for (const feed of feeds) {
    for (const offer of feed.offers.slice(0, 500)) {
      if (!offer.url) continue;

      const raw = retargetIndirectFeedOffer(
        admitadFeedToIndirectFeedOffer(offer),
        {
          providerId: ADMITAD_PROVIDER_ID,
          merchantName: feed.feedName,
          sourceRef: `feed:${feed.feedSlug}`,
        },
      );

      // Real, image-bearing products only. An offer with no usable image
      // resolves to the local placeholder — skip it so real products do not
      // surface as placeholder-only cards (mirrors the database-catalog rule).
      const imageUrl = normalizeProductImageUrl(raw.images?.[0]?.url ?? "");
      if (!imageUrl || imageUrl === PRODUCT_IMAGE_PLACEHOLDER) continue;

      const discount =
        offer.oldprice && offer.oldprice > offer.price
          ? Math.round(((offer.oldprice - offer.price) / offer.oldprice) * 100)
          : 0;
      const id = `${feed.feedSlug}-${raw.externalOfferId ?? offer.id}`;
      items.push({
        id,
        slug: id,
        title: raw.title ?? offer.name,
        imageUrl,
        emoji: "🛍️",
        categorySlug: "general",
        rating: 0,
        reviewCount: 0,
        countryCode: "US",
        currency: raw.currency ?? offer.currencyId,
        price: raw.price ?? offer.price,
        originalPrice: offer.oldprice ?? offer.price,
        discount,
        discountType: "percentage",
        providerIds: [ADMITAD_PROVIDER_ID],
        offers: [
          {
            providerId: ADMITAD_PROVIDER_ID,
            storeSlug: feed.feedSlug,
            storeName: feed.feedName,
            externalId: raw.externalOfferId ?? offer.id,
            price: offer.price,
            originalPrice: offer.oldprice ?? offer.price,
            currency: offer.currencyId,
            countryCode: "US",
            affiliateUrl: raw.affiliateUrl ?? offer.url,
            productUrl: raw.productUrl ?? offer.url,
            inStock: true,
          },
        ],
        fetchedAt: new Date().toISOString(),
      });
    }
  }
  return items;
}
