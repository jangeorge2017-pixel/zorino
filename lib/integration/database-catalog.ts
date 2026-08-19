/**
 * Bridge between the Supabase product catalog (imported by cron sync jobs)
 * and the NormalizedCatalogItem / SearchResultItem formats used by the
 * unified homepage feed and global search engine.
 *
 * The cron pipeline imports real products from AliExpress / eBay into
 * `products` + `prices` + `lowest_prices_today`. This module reads those
 * rows so every page can show a broader product pool than what the live
 * search engine returns per request.
 */

import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";
import type { NormalizedCatalogItem, ProviderOffer } from "@/lib/integration/catalog-types";
import type { ProductionProviderId } from "@/lib/integration/constants";
import type { SearchResultItem } from "@/lib/data/homepage";
import { normalizeProductImageUrl } from "@/lib/images/product-image";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";
import { HOMEPAGE_CATALOG_FETCH } from "@/lib/integration/homepage-fetch-profile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

type LowestPriceRow = {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  image_url: string;
  emoji: string | null;
  lowest_price: number;
  original_price: number | null;
  discount_percent: number;
  store_name: string;
  provider: string | null;
  affiliate_url: string | null;
  external_url: string | null;
  country_code: string;
  currency: string;
};

function rowToCatalogItem(row: LowestPriceRow): NormalizedCatalogItem {
  const providerId = resolveMarketplaceId(row.provider ?? row.store_name) as ProductionProviderId;
  const affiliateUrl = row.affiliate_url ?? row.external_url ?? "";
  const originalPrice = Number(row.original_price ?? row.lowest_price);
  const price = Number(row.lowest_price);
  const discount =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  const offer: ProviderOffer = {
    providerId,
    storeSlug: providerId,
    storeName: row.store_name,
    externalId: row.product_id,
    price,
    originalPrice,
    currency: row.currency,
    countryCode: row.country_code,
    productUrl: affiliateUrl,
    affiliateUrl,
    inStock: true,
  };

  return {
    id: `db-${row.product_id}`,
    slug: row.product_slug,
    title: row.product_name,
    imageUrl: normalizeProductImageUrl(row.image_url),
    emoji: row.emoji ?? "🛍️",
    categorySlug: "electronics",
    rating: 0,
    reviewCount: 0,
    countryCode: row.country_code,
    currency: row.currency,
    price,
    originalPrice,
    discount,
    discountType: "percentage",
    offers: [offer],
    providerIds: [providerId],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Read products from the Supabase `lowest_prices_today` table.
 * Returns NormalizedCatalogItems that can be merged with live search results.
 * Gracefully returns [] when Supabase is not configured.
 */
export async function getCatalogItemsFromDatabase(): Promise<NormalizedCatalogItem[]> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return [];

  const limit = HOMEPAGE_CATALOG_FETCH.pageSize * 3;

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .eq("country_code", "US")
    .eq("currency", "USD")
    .order("discount_percent", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  return (data as LowestPriceRow[])
    .filter((row) => row.product_name && row.image_url)
    .map(rowToCatalogItem);
}

function rowToSearchResultItem(row: LowestPriceRow): SearchResultItem {
  const providerId = resolveMarketplaceId(row.provider ?? row.store_name);
  const affiliateUrl = row.affiliate_url ?? row.external_url ?? "";
  const originalPrice = Number(row.original_price ?? row.lowest_price);
  const price = Number(row.lowest_price);
  const discount =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  return {
    id: `db-${row.product_id}`,
    name: row.product_name,
    imageSrc: normalizeProductImageUrl(row.image_url),
    emoji: row.emoji ?? "🛍️",
    price,
    originalPrice,
    discount,
    store: row.store_name,
    storeSlug: providerId,
    rating: 0,
    reviewCount: 0,
    inStock: true,
    category: "electronics",
    affiliateUrl,
  };
}

/**
 * Read products from Supabase matching a search query.
 * Returns SearchResultItems that can be merged with live search-engine results.
 */
export async function getSearchResultsFromDatabase(
  query: string,
  limit = 24,
): Promise<SearchResultItem[]> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return [];

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .ilike("product_name", `%${query}%`)
    .eq("country_code", "US")
    .eq("currency", "USD")
    .order("discount_percent", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  return (data as LowestPriceRow[])
    .filter((row) => row.product_name && row.image_url)
    .map(rowToSearchResultItem);
}
