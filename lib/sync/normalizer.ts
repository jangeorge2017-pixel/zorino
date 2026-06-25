import { createHash } from "node:crypto";
import type { ExternalDeal, ExternalProduct } from "@/lib/sync/types";

export function computeSyncHash(product: ExternalProduct): string {
  const payload = JSON.stringify({
    title: product.title,
    price: product.price,
    originalPrice: product.originalPrice,
    imageUrl: product.imageUrl,
    inStock: product.inStock,
    currency: product.currency,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function toProductRow(product: ExternalProduct, categoryId?: string | null) {
  return {
    slug: product.slug,
    name: product.title,
    name_ar: product.titleAr ?? null,
    description: product.description ?? null,
    image_url: product.imageUrl,
    emoji: product.emoji ?? null,
    category_slug: product.categorySlug,
    category_id: categoryId ?? null,
    brand: product.brand ?? null,
    rating: product.rating ?? null,
    review_count: product.reviewCount ?? 0,
    currency: product.currency,
    country_code: product.countryCode,
    in_stock: product.inStock,
    specifications: product.specifications ?? null,
    tags: product.tags ?? [],
    sync_status: "synced" as const,
    last_synced_at: new Date().toISOString(),
  };
}

export function toPriceRow(
  productId: string,
  storeId: string,
  product: ExternalProduct
) {
  return {
    product_id: productId,
    store_id: storeId,
    price: product.price,
    original_price: product.originalPrice ?? null,
    currency: product.currency,
    country_code: product.countryCode,
    external_url: product.productUrl,
    external_product_id: product.externalId,
    in_stock: product.inStock,
    is_current: true,
  };
}

export function toDealRow(
  productId: string,
  storeId: string,
  deal: ExternalDeal
) {
  return {
    product_id: productId,
    store_id: storeId,
    title: deal.title,
    discount: deal.discount,
    discount_type: deal.discountType,
    price: deal.price,
    original_price: deal.originalPrice,
    currency: deal.currency,
    country_code: deal.countryCode,
    is_featured: deal.isFeatured ?? false,
    is_active: true,
    sort_order: deal.sortOrder ?? 0,
  };
}

export function toProductSourceRow(
  productId: string,
  storeId: string,
  product: ExternalProduct,
  syncHash: string
) {
  return {
    product_id: productId,
    store_id: storeId,
    external_product_id: product.externalId,
    external_url: product.productUrl,
    affiliate_url: product.affiliateUrl ?? null,
    country_code: product.countryCode,
    currency: product.currency,
    sync_hash: syncHash,
    raw_payload: product as unknown as Record<string, unknown>,
    last_synced_at: new Date().toISOString(),
    is_active: true,
  };
}

export function toProductImageRows(productId: string, product: ExternalProduct) {
  const urls = product.imageUrls?.length ? product.imageUrls : [product.imageUrl];
  return urls.map((url, index) => ({
    product_id: productId,
    url,
    is_primary: index === 0,
    sort_order: index,
    source: "api" as const,
    last_synced_at: new Date().toISOString(),
  }));
}
