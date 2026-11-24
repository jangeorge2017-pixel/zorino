import { EGYPT_STORE_ADAPTERS } from "@/lib/integrations/egypt-stores";
import type { StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import {
  isUsableRemoteProductImageUrl,
  normalizeProductImageUrl,
} from "@/lib/images/product-image";
import { mapProviderCategory } from "@/lib/sync/providers/shared/category-map";
import { finalizeExternalProduct, slugifyTitle } from "@/lib/sync/providers/shared/product-utils";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import type { RawProviderListing } from "@/lib/search/types";

export const STOREFRONT_CATALOG_QUERIES = [
  "iphone",
  "samsung galaxy",
  "laptop",
  "electronics",
  "gaming",
  "playstation",
  "smart tv",
  "home appliances",
  "air fryer",
  "coffee machine",
  "vacuum cleaner",
  "headphones",
] as const;

const STORE_ADAPTERS = new Map<string, StoreSearchAdapter>(
  EGYPT_STORE_ADAPTERS.map((adapter) => [adapter.id, adapter]),
);

export function hasStoreSearchAdapter(providerId: string): boolean {
  return STORE_ADAPTERS.has(providerId);
}

export function rawListingToExternalProduct(
  providerId: string,
  listing: RawProviderListing,
  ctx: SyncContext,
): ExternalProduct | null {
  if (!listing.externalId || !listing.title || !listing.productUrl) return null;
  if (!Number.isFinite(listing.price) || listing.price <= 0) return null;
  if (!/^https?:\/\//i.test(listing.productUrl)) return null;

  const imageUrl = normalizeProductImageUrl(listing.imageUrl);
  if (!isUsableRemoteProductImageUrl(imageUrl)) return null;

  const originalPrice =
    Number.isFinite(listing.originalPrice) && listing.originalPrice > listing.price
      ? listing.originalPrice
      : listing.price;
  const discount =
    Number.isFinite(listing.discount) && listing.discount > 0
      ? listing.discount
      : originalPrice > listing.price
        ? Math.round(((originalPrice - listing.price) / originalPrice) * 100)
        : 0;

  return finalizeExternalProduct(ctx, {
    externalId: listing.externalId,
    title: listing.title,
    slug: slugifyTitle(`${providerId}-${listing.externalId}-${listing.title}`),
    categorySlug: mapProviderCategory(listing.category, listing.title, "home"),
    imageUrl,
    imageUrls: [imageUrl],
    price: listing.price,
    originalPrice,
    currency: listing.currency || ctx.currency,
    countryCode: listing.countryCode || ctx.countryCode,
    rating: listing.rating,
    reviewCount: listing.reviewCount,
    inStock: listing.inStock !== false,
    productUrl: listing.productUrl,
    affiliateUrl: listing.affiliateUrl,
    discount,
    discountType: "percentage",
  });
}

export function externalProductsToDeals(products: ExternalProduct[]): ExternalDeal[] {
  return products
    .filter(
      (product) => (product.discount ?? 0) > 0 || (product.originalPrice ?? product.price) > product.price,
    )
    .slice(0, 12)
    .map((product) => ({
      externalProductId: product.externalId,
      title: product.title,
      discount: product.discount ?? 0,
      discountType: product.discountType ?? "percentage",
      price: product.price,
      originalPrice: product.originalPrice ?? product.price,
      currency: product.currency,
      countryCode: product.countryCode,
      imageUrl: product.imageUrl,
      productUrl: product.affiliateUrl ?? product.productUrl,
    }));
}

async function searchStorefrontWithRetries(
  adapter: StoreSearchAdapter,
  query: string,
  options: Parameters<StoreSearchAdapter["search"]>[1],
  retries: number,
): Promise<RawProviderListing[]> {
  const attempts = Math.max(1, Math.min(retries + 1, 4));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const listings = await adapter.search(query, options);
      if (listings.length > 0) return listings;
    } catch {}
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  return [];
}

export async function fetchStorefrontCatalog(
  providerId: string,
  ctx: SyncContext,
  options?: { maxProducts?: number; retries?: number },
): Promise<ExternalProduct[]> {
  const adapter = STORE_ADAPTERS.get(providerId);
  if (!adapter) throw new Error(`No storefront catalog adapter registered for "${providerId}"`);

  const jobConfig = ctx.jobConfig;
  const queries =
    jobConfig?.keywords && jobConfig.keywords.length > 0
      ? jobConfig.keywords
      : [...STOREFRONT_CATALOG_QUERIES];
  const maxPages = Math.min(Math.max(jobConfig?.maxPages ?? 2, 1), 5);
  const pageSize = Math.min(Math.max(jobConfig?.pageSize ?? 24, 1), 30);
  const maxProducts = Math.max(options?.maxProducts ?? 150, 1);
  const seen = new Set<string>();
  const products: ExternalProduct[] = [];

  for (const query of queries) {
    if (products.length >= maxProducts) break;
    const listings = await searchStorefrontWithRetries(
      adapter,
      query,
      {
        pageSize,
        maxPages,
        countryCode: ctx.countryCode,
        currency: ctx.currency,
      },
      options?.retries ?? 0,
    );
    if (listings.length === 0) continue;

    for (const listing of listings) {
      if (products.length >= maxProducts) break;
      if (!listing.externalId || seen.has(listing.externalId)) continue;
      const product = rawListingToExternalProduct(providerId, listing, ctx);
      if (!product) continue;
      seen.add(listing.externalId);
      products.push(product);
    }
  }

  return products;
}
