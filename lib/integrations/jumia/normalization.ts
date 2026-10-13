import type { JumiaRawProduct } from "./types";
import { JUMIA_PROVIDER_ID } from "./config";
import type {
  NormalizedCatalogItem,
  ProviderOffer,
} from "@/lib/integration/catalog-types";
import {
  normalizeProductImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/images/product-image";

/**
 * Jumia raw product → canonical catalog item. Real data only: skipping offers
 * with no usable image/url/price (mirrors the database-catalog rule) — a
 * placeholder-only card is never emitted.
 */
export function jumiaRawToCatalogItem(
  raw: JumiaRawProduct,
  countryCode = "EG",
): NormalizedCatalogItem | null {
  if (!raw.externalId || !raw.title || !raw.price || raw.price <= 0) return null;

  const imageUrl = normalizeProductImageUrl(raw.imageUrl ?? "");
  if (!imageUrl || imageUrl === PRODUCT_IMAGE_PLACEHOLDER) return null;

  const productUrl = raw.productUrl ?? "";
  if (!productUrl) return null;

  const originalPrice =
    raw.originalPrice && raw.originalPrice > raw.price ? raw.originalPrice : raw.price;
  const discount =
    originalPrice > raw.price
      ? Math.round(((originalPrice - raw.price) / originalPrice) * 100)
      : 0;
  const currency = (raw.currency ?? "EGP").toUpperCase();
  const id = `jumia-${raw.externalId}`;

  const offer: ProviderOffer = {
    providerId: JUMIA_PROVIDER_ID,
    storeSlug: "jumia",
    storeName: "Jumia",
    externalId: raw.externalId,
    price: raw.price,
    originalPrice,
    currency,
    countryCode,
    productUrl,
    affiliateUrl: productUrl,
    inStock: true,
  };

  return {
    id,
    slug: id,
    title: raw.title.trim(),
    imageUrl,
    emoji: "🛍️",
    categorySlug:
      raw.category?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "general",
    rating: raw.rating ?? 0,
    reviewCount: raw.reviewCount ?? 0,
    countryCode,
    currency,
    price: raw.price,
    originalPrice,
    discount,
    discountType: "percentage",
    offers: [offer],
    providerIds: [JUMIA_PROVIDER_ID],
    fetchedAt: new Date().toISOString(),
  };
}