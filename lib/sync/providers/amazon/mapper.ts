import type { AmazonRawProduct } from "@/lib/integrations/amazon/client";
import { getAmazonAssociateTag } from "@/lib/integrations/amazon/config";
import type { SyncContext } from "@/lib/sync/types";
import type { ExternalProduct } from "@/lib/sync/types";
import { finalizeExternalProduct, slugifyTitle } from "@/lib/sync/providers/shared/product-utils";
import { mapProviderCategory } from "@/lib/sync/providers/shared/category-map";

/** PA-API product → ExternalProduct for sync/catalog pipeline. */
export function mapAmazonProduct(
  ctx: SyncContext,
  raw: AmazonRawProduct
): ExternalProduct | null {
  if (!raw.asin || !raw.title || !raw.affiliateUrl.includes(getAmazonAssociateTag())) {
    return null;
  }

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
    brand: raw.brand,
    categorySlug: mapProviderCategory(raw.category, raw.title),
    imageUrl: raw.imageUrl,
    imageUrls: [raw.imageUrl],
    price: raw.price,
    originalPrice,
    discount: discount > 0 ? discount : undefined,
    discountType: discount > 0 ? "percentage" : undefined,
    currency: raw.currency,
    inStock: raw.inStock,
    productUrl: raw.productUrl,
    affiliateUrl: raw.affiliateUrl,
    rating: raw.rating,
    reviewCount: raw.reviewCount,
  });
}

/** Legacy mapper used by paapi-types tests. */
export { mapAmazonProduct as mapAmazonItemToNormalizedExternal };
