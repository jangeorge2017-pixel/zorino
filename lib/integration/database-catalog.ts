/**
 * Bridge between the Supabase product catalog (imported by cron sync jobs)
 * and the NormalizedCatalogItem / SearchResultItem formats used by the
 * unified homepage feed and global search engine.
 *
 * Reads from `lowest_prices_today` joined with `products` to get category
 * metadata. Returns NormalizedCatalogItems that feed every homepage section,
 * the /deals page, the Hero orbit, and the search engine's DB fallback.
 */

import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";
import type { NormalizedCatalogItem, ProviderOffer } from "@/lib/integration/catalog-types";
import type { ProductionProviderId } from "@/lib/integration/constants";
import type { SearchResultItem } from "@/lib/data/homepage";
import { normalizeProductImageUrl } from "@/lib/images/product-image";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";

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
  category_slug?: string | null;
};

/** Infer a useful category from the product name when the DB stores "general". */
function inferCategoryFromName(name: string): string {
  const lower = name.toLowerCase();
  if (/\b(phone|iphone|samsung|galaxy|xiaomi|redmi|oppo|vivo|oneplus|pixel)\b/.test(lower)) return "phones";
  if (/\b(laptop|macbook|notebook|chromebook|thinkpad|surface|dell|hp pavilion)\b/.test(lower)) return "laptops";
  if (/\b(console|playstation|xbox|nintendo|gaming|controller|ps5|ps4|steam deck)\b/.test(lower)) return "gaming";
  if (/\b(tv|television|monitor|display|4k|oled|qled|hisense|tcl)\b/.test(lower)) return "tvs";
  if (/\b(watch|band|tracker|earbuds|headphones|airpods|fitbit|garmin)\b/.test(lower)) return "wearables";
  if (/\b(dress|shirt|jeans|jacket|shoes|sneakers|boots|sandals|fashion|clothing|apparel)\b/.test(lower)) return "fashion";
  if (/\b(home|kitchen|blender|vacuum|air fryer|mattress|pillow|furniture|lamp)\b/.test(lower)) return "home";
  return "electronics";
}

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

  const rawCategory = row.category_slug;
  const categorySlug =
    rawCategory && rawCategory !== "general"
      ? rawCategory
      : inferCategoryFromName(row.product_name);

  return {
    id: `db-${row.product_id}`,
    slug: row.product_slug,
    title: row.product_name,
    imageUrl: normalizeProductImageUrl(row.image_url),
    emoji: row.emoji ?? "🛍️",
    categorySlug,
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

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .eq("country_code", "US")
    .eq("currency", "USD")
    .order("discount_percent", { ascending: false })
    .order("lowest_price", { ascending: false })
    .limit(500);

  if (error || !data?.length) return [];

  const rows = (data as LowestPriceRow[]).filter(
    (row) => row.product_name && row.image_url,
  );

  // Batch-fetch category_slug from products table for these product IDs
  const productIds = rows.map((r) => r.product_id);
  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .in("id", productIds);

  const categoryMap = new Map<string, string | null>();
  for (const p of productRows ?? []) {
    categoryMap.set(p.id, p.category_slug);
  }

  return rows.map((row) => {
    row.category_slug = categoryMap.get(row.product_id) ?? null;
    return rowToCatalogItem(row);
  });
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

  const rawCategory = row.category_slug;
  const category =
    rawCategory && rawCategory !== "general"
      ? rawCategory
      : inferCategoryFromName(row.product_name);

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
    category,
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

  // Word-level OR matching: "nike shoes" → ILIKE '%nike%' OR ILIKE '%shoes%'
  // This finds "Nike Air Max 90" AND "Running Shoes" which the old substring
  // match and AND-match both missed. Word overlap scoring happens post-query.
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) return [];

  const orFilter = words
    .map((w) => `product_name.ilike.%${w}%`)
    .join(",");

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .or(orFilter)
    .eq("country_code", "US")
    .eq("currency", "USD")
    .not("image_url", "is", null)
    .neq("image_url", "")
    .order("discount_percent", { ascending: false })
    .limit(limit * 2);

  if (error || !data?.length) return [];

  const rows = (data as LowestPriceRow[]).filter(
    (row) => row.product_name && row.image_url,
  );

  const productIds = rows.map((r) => r.product_id);
  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .in("id", productIds);

  const categoryMap = new Map<string, string | null>();
  for (const p of productRows ?? []) {
    categoryMap.set(p.id, p.category_slug);
  }

  const results = rows.map((row) => {
    row.category_slug = categoryMap.get(row.product_id) ?? null;
    return rowToSearchResultItem(row);
  });

  // Rank by word overlap: products matching more query words rank higher.
  // "Nike Air Max 90" matches 1/2 words for "nike shoes" → score 1
  // "Nike Running Shoes" matches 2/2 words → score 2 (ranked first).
  const queryWords = words;
  results.sort((a, b) => {
    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();
    const aMatches = queryWords.filter((w) => aLower.includes(w)).length;
    const bMatches = queryWords.filter((w) => bLower.includes(w)).length;
    if (aMatches !== bMatches) return bMatches - aMatches;
    return b.discount - a.discount || a.price - b.price;
  });

  return results.slice(0, limit);
}
