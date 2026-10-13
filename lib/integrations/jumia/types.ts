/**
 * Defensive container for a Jumia product as returned by the configurable
 * Jumia partner API JSON contract. Field names are the common JSON-product
 * shape (sku/id, name/title, price/sale_price, images, url); the mapping is
 * permissive on purpose because the exact Jumia affiliate client response
 * shape is not confirmed yet. Every read is null-guarded — an absent API
 * always yields zero products, never fabricated ones.
 */
export type JumiaRawProduct = {
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