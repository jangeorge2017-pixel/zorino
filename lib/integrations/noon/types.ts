/**
 * Defensive container for a Noon product as returned by the configurable Noon
 * partner API JSON contract. Field names are the common JSON-product shape
 * (id/sku, title/name, price/sale_price, images, url); the mapping is
 * permissive on purpose because the exact Noon affiliate client response shape
 * is not confirmed yet. Every read goes through null-guards — an absent API
 * always yields zero products, never fabricated ones.
 */
export type NoonRawProduct = {
  externalId?: string;
  title?: string;
  imageUrl?: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  countryCode?: string;
  productUrl?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
};