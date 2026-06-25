import type { ExternalProduct } from "@/lib/sync/types";
import { computeSyncHash } from "@/lib/sync/normalizer";
import type { ImportProviderId } from "@/lib/sync/providers/types";

export function toExternalProductRow(
  product: ExternalProduct,
  provider: ImportProviderId,
  storeId: string
) {
  const syncHash = computeSyncHash(product);
  return {
    provider,
    store_id: storeId,
    external_id: product.externalId,
    title: product.title,
    title_ar: product.titleAr ?? null,
    slug: product.slug,
    description: product.description ?? null,
    brand: product.brand ?? null,
    category_slug: product.categorySlug,
    image_url: product.imageUrl,
    image_urls: product.imageUrls ?? [product.imageUrl],
    emoji: product.emoji ?? null,
    specifications: product.specifications ?? null,
    tags: product.tags ?? [],
    rating: product.rating ?? null,
    review_count: product.reviewCount ?? 0,
    currency: product.currency,
    country_code: product.countryCode,
    product_url: product.productUrl,
    affiliate_url: product.affiliateUrl ?? null,
    in_stock: product.inStock,
    sync_hash: syncHash,
    sync_status: "synced" as const,
    raw_payload: product as unknown as Record<string, unknown>,
    last_synced_at: new Date().toISOString(),
  };
}

export function toExternalPriceRow(
  product: ExternalProduct,
  provider: ImportProviderId,
  storeId: string,
  externalProductId?: string | null,
  canonicalProductId?: string | null
) {
  return {
    provider,
    store_id: storeId,
    external_product_id: externalProductId ?? null,
    external_id: product.externalId,
    canonical_product_id: canonicalProductId ?? null,
    price: product.price,
    original_price: product.originalPrice ?? null,
    currency: product.currency,
    country_code: product.countryCode,
    in_stock: product.inStock,
    is_current: true,
    recorded_at: new Date().toISOString(),
    merged_at: null,
    raw_payload: {
      externalId: product.externalId,
      price: product.price,
      originalPrice: product.originalPrice,
    },
  };
}
