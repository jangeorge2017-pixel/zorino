import { getAmazonScraperAssociateTag } from "@/lib/integrations/amazon-scraper";
import type { AmazonScrapedSearchResult } from "@/lib/integrations/amazon-scraper";
import type { SyncContext } from "@/lib/sync/types";
import type { ExternalProduct } from "@/lib/sync/types";
import { finalizeExternalProduct, slugifyTitle } from "@/lib/sync/providers/shared/product-utils";
import { mapProviderCategory } from "@/lib/sync/providers/shared/category-map";

/**
 * Storefront-scraped Amazon search result → ExternalProduct for sync/catalog.
 * Builds the affiliate URL locally from the real storefront product page so the
 * resulting product carries a valid, trackable outgoing link (mirrors the
 * normalizer used by the search/homepage pipeline).
 */
export function mapAmazonScraperSyncProduct(
  ctx: SyncContext,
  raw: AmazonScrapedSearchResult
): ExternalProduct | null {
  if (!raw.asin || !raw.title || !raw.price || raw.price <= 0) return null;
  if (!raw.imageUrl.startsWith("http")) return null;

  const partnerTag = getAmazonScraperAssociateTag(raw.marketplace);
  const separator = raw.productUrl.includes("?") ? "&" : "?";
  const affiliateUrl = `${raw.productUrl}${separator}tag=${partnerTag}`;

  const originalPrice = raw.originalPrice > raw.price ? raw.originalPrice : raw.price;
  const discount =
    originalPrice > raw.price
      ? Math.round(((originalPrice - raw.price) / originalPrice) * 100)
      : 0;

  return finalizeExternalProduct(ctx, {
    externalId: raw.asin,
    title: raw.title,
    slug: slugifyTitle(raw.title),
    description: raw.title,
    categorySlug: mapProviderCategory("General", raw.title),
    imageUrl: raw.imageUrl,
    imageUrls: [raw.imageUrl],
    price: raw.price,
    originalPrice,
    discount: discount > 0 ? discount : undefined,
    discountType: discount > 0 ? "percentage" : undefined,
    currency: raw.currency,
    inStock: true,
    productUrl: raw.productUrl,
    affiliateUrl,
    rating: raw.rating,
    reviewCount: raw.reviewCount,
  });
}