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
import {
  normalizeProductImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/images/product-image";
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
 * Providers that carry real, image-bearing products in `lowest_prices_today`.
 * Used to (a) enumerate the real merchant universe and (b) filter the catalog.
 * Stub-only providers (temu, walmart, jumia, noon, best-buy) are excluded so
 * their legacy rows never surface in the homepage catalog or stats.
 */
const REAL_CATALOG_PROVIDERS = ["admitad", "aliexpress", "ebay", "cjdropshipping"];

/** Reciprocal of the .in() filter above — kept for the per-merchant query. */
function realProviderOr(): string {
  return `provider.in.(${REAL_CATALOG_PROVIDERS.join(",")})`;
}

/**
 * Enumerate the distinct real merchants present in `lowest_prices_today`.
 *
 * IMPORTANT: rows are heavily concentrated by merchant (one merchant can own
 * tens of thousands of rows, another only a handful at the very tail), so a
 * bounded "first N" slice would miss whole merchants. We page the full
 * real-provider set and dedupe on store_name to get every real merchant.
 * Runs once per 5-min catalog cache, so the full scan is acceptable.
 */
export async function getRealMerchantNames(supabase?: SupabaseDb): Promise<string[]> {
  const client = supabase ?? createSupabaseAnonClient();
  if (!client) return [];
  const names = new Set<string>();
  let offset = 0;
  // IMPORTANT: the Supabase anon client caps responses at 1000 rows regardless
  // of the requested range, so stepping by >1000 silently truncates and stops
  // early (missing whole merchants at the tail). Step by exactly 1000.
  const page = 1000;

  for (;;) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from("lowest_prices_today")
      .select("store_name")
      .eq("country_code", "US")
      .eq("currency", "USD")
      .not("image_url", "is", null)
      .neq("image_url", "")
      .or(realProviderOr())
      .range(offset, offset + page - 1);

    if (error) break;
    const rows = (data ?? []) as Array<{ store_name: string | null }>;
    if (rows.length === 0) break;

    for (const r of rows) {
      const name = r.store_name?.trim();
      if (name) names.add(name);
    }

    offset += page;
    if (rows.length < page) break;
    if (offset > 130_000) break; // hard safety cap
  }

  return Array.from(names);
}
/**
 * Read a merchant-breadth sample of the Supabase `lowest_prices_today` table.
 * Returns NormalizedCatalogItems that can be merged with live search results.
 *
 * Unlike a single discount-limited slice (which a single dominant merchant can
 * flood and thereby hide every other real store), this pulls a bounded number
 * of the top products FROM EACH real merchant. Every real store in the DB is
 * therefore represented in the homepage catalog — so the store count is real
 * and the rendered feed stays diverse. Gracefully returns [] when Supabase is
 * not configured.
 */
export async function getCatalogItemsFromDatabase(): Promise<NormalizedCatalogItem[]> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return [];

  const storeNames = await getRealMerchantNames(supabase);
  if (storeNames.length === 0) return [];

  const PER_MERCHANT = 40;
  const collected: LowestPriceRow[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  for (const storeName of storeNames) {
    const { data, error } = await sb
      .from("lowest_prices_today")
      .select(
        "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
      )
      .eq("country_code", "US")
      .eq("currency", "USD")
      .eq("store_name", storeName)
      // Only real, image-bearing products enter the homepage catalog. The DB is
      // ~92% image-covered (120K rows), but some store feeds stored empty image
      // URLs that would otherwise resolve to placeholder cards. Filtering here
      // surfaces real products with real images so valid URLs render.
      .not("image_url", "is", null)
      .neq("image_url", "")
      .order("discount_percent", { ascending: false })
      .order("lowest_price", { ascending: false })
      .limit(PER_MERCHANT);

    if (error || !data) continue;

    for (const row of data as LowestPriceRow[]) {
      if (
        row.product_name &&
        row.image_url &&
        // Reject rows whose image normalizes to the placeholder (empty,
        // http-only, or invalid URLs all land there) — never placeholder cards.
        normalizeProductImageUrl(row.image_url) !== PRODUCT_IMAGE_PLACEHOLDER
      ) {
        collected.push(row);
      }
    }
  }

  // Dedupe on product_id so a product present across multiple merchants/rows
  // (rare) is not double-counted in the catalog feed.
  const byId = new Map<string, LowestPriceRow>();
  for (const row of collected) {
    if (!byId.has(row.product_id)) byId.set(row.product_id, row);
  }
  const rows = Array.from(byId.values());
  if (rows.length === 0) return [];

  // Batch-fetch category_slug from products table for these product IDs
  const productIds = rows.map((r) => r.product_id);
  const { data: productRows } = await sb
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

/**
 * Total count of real, image-bearing products in `lowest_prices_today` across
 * the live providers. This is the honest product-catalog size (not the bounded
 * in-memory feed), so the homepage "Products" stat reflects reality.
 * Returns 0 when Supabase is not configured or the count is unavailable.
 */
export async function getRealCatalogProductCount(): Promise<number> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase as any)
    .from("lowest_prices_today")
    .select("product_id", { count: "exact", head: true })
    .eq("country_code", "US")
    .eq("currency", "USD")
    .or(realProviderOr());

  if (error || typeof count !== "number") return 0;
  return count;
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
    (row) =>
      row.product_name &&
      row.image_url &&
      normalizeProductImageUrl(row.image_url) !== PRODUCT_IMAGE_PLACEHOLDER,
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

/**
 * Fetch a single lowest_prices_today row by its product_id (the id embedded in
 * `db-<product_id>` catalog ids) and map it to a SearchResultItem.
 * Used by the marketplace PDP resolver for Admitad/DB-sourced products.
 */
export async function getDatabaseSearchItemByProductId(
  productId: string,
): Promise<SearchResultItem | null> {
  const trimmed = productId.trim();
  if (!trimmed) return null;

  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .eq("product_id", trimmed)
    .limit(1);

  const row = (data as LowestPriceRow[] | null)?.[0];
  if (
    error ||
    !row ||
    !row.product_name ||
    !row.image_url ||
    normalizeProductImageUrl(row.image_url) === PRODUCT_IMAGE_PLACEHOLDER
  ) {
    return null;
  }

  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .eq("id", row.product_id)
    .limit(1);

  row.category_slug = productRows?.[0]?.category_slug ?? null;
  return rowToSearchResultItem(row);
}

/**
 * Look up a single lowest_prices_today row by its Admitad product_slug
 * (`admitad-<campaignId>-<offerId>`) and map it to a SearchResultItem.
 * This is the persisted-row counterpart of the live `admitad-…` feed products,
 * used as a fallback by the PDP resolver when the live feed cache is cold.
 * Only real rows (real name + real image) are ever returned.
 */
export async function getDatabaseSearchItemByProductSlug(
  productSlug: string,
): Promise<SearchResultItem | null> {
  const trimmed = productSlug.trim();
  if (!trimmed) return null;

  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .eq("product_slug", trimmed)
    .limit(1);

  const row = (data as LowestPriceRow[] | null)?.[0];
  if (
    error ||
    !row ||
    !row.product_name ||
    !row.image_url ||
    normalizeProductImageUrl(row.image_url) === PRODUCT_IMAGE_PLACEHOLDER
  ) {
    return null;
  }

  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .eq("id", row.product_id)
    .limit(1);

  row.category_slug = productRows?.[0]?.category_slug ?? null;
  return rowToSearchResultItem(row);
}
