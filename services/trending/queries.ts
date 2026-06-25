import { mapProduct } from "@/lib/database/mappers";
import type { ProductRow } from "@/lib/database/types";
import { getCurrentPricesForProduct, getPriceHistory } from "@/services/prices";
import type {
  ServiceResult,
  TrendingBadge,
  TrendingProductCard,
  TrendingRankingType,
} from "@/lib/types/entities";
import { ALL_RANKING_TYPES, getRankingLabel } from "@/lib/trending/labels";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

type RankingRow = {
  rank: number;
  score: number;
  badge: string | null;
  metadata: Record<string, unknown>;
  product_id: string;
  ranking_type: TrendingRankingType;
  country_code: string;
  products: ProductRow | null;
};

export { getRankingLabel, ALL_RANKING_TYPES };

/** Fetch precomputed trending products for a ranking type. */
export async function getTrendingProducts(
  rankingType: TrendingRankingType,
  options?: { countryCode?: string; limit?: number }
): Promise<ServiceResult<TrendingProductCard[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const countryCode = options?.countryCode ?? "US";
  const limit = options?.limit ?? 8;

  const { data, error } = await db(supabase)
    .from("trending_rankings")
    .select("rank, score, badge, metadata, product_id, ranking_type, country_code, products (*)")
    .eq("ranking_type", rankingType)
    .eq("country_code", countryCode)
    .order("rank")
    .limit(limit);

  if (error) return { data: [], error: error.message };
  if (!data?.length) {
    return getTrendingProductsFallback(rankingType, countryCode, limit);
  }

  const cards: TrendingProductCard[] = [];
  for (const row of data as RankingRow[]) {
    if (!row.products) continue;
    const card = await productToTrendingCard(
      mapProduct(row.products),
      rankingType,
      row.rank,
      row.score,
      (row.badge as TrendingBadge) ?? null,
      countryCode
    );
    if (card) cards.push(card);
  }

  return { data: cards, error: null };
}

/** Fetch all ranking tabs for homepage section (never returns empty tabs). */
export async function getTrendingSectionData(countryCode = "US") {
  const limit = 8;
  const results = await Promise.all(
    ALL_RANKING_TYPES.map(async (type) => {
      const { data } = await getTrendingProducts(type, { countryCode, limit });
      return [type, data] as const;
    })
  );

  const section = Object.fromEntries(results) as Record<TrendingRankingType, TrendingProductCard[]>;

  for (const type of ALL_RANKING_TYPES) {
    if ((section[type]?.length ?? 0) === 0) {
      const fallback = await getTrendingProductsFallback(type, countryCode, limit);
      section[type] = fallback.data;
    }
  }

  return section;
}

/** Batch lookup badges for product cards. */
export async function getProductBadgesMap(
  productIds: string[],
  countryCode = "US"
): Promise<Map<string, TrendingBadge>> {
  const map = new Map<string, TrendingBadge>();
  if (productIds.length === 0) return map;

  const supabase = createSupabaseAnonClient();
  if (!supabase) return map;

  const { data } = await db(supabase)
    .from("trending_rankings")
    .select("product_id, badge, rank")
    .in("product_id", productIds)
    .eq("country_code", countryCode)
    .order("rank");

  for (const row of (data ?? []) as { product_id: string; badge: string | null }[]) {
    if (!map.has(row.product_id) && row.badge) {
      map.set(row.product_id, row.badge as TrendingBadge);
    }
  }

  return map;
}

/** Lookup badge for a product (for deal cards elsewhere on homepage). */
export async function getProductTrendingBadge(
  productId: string,
  countryCode = "US"
): Promise<TrendingBadge | null> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data } = await db(supabase)
    .from("trending_rankings")
    .select("badge, rank")
    .eq("product_id", productId)
    .eq("country_code", countryCode)
    .order("rank")
    .limit(1)
    .maybeSingle();

  return (data?.badge as TrendingBadge) ?? null;
}

async function productToTrendingCard(
  product: ReturnType<typeof mapProduct>,
  rankingType: TrendingRankingType,
  rank: number,
  rankingScore: number,
  badge: TrendingBadge | null,
  countryCode: string
): Promise<TrendingProductCard | null> {
  const [pricesResult, historyResult] = await Promise.all([
    getCurrentPricesForProduct(product.id, { countryCode }),
    getPriceHistory(product.id, { limit: 5 }),
  ]);

  const prices = pricesResult.data;
  const lowest = prices[0];
  const price = lowest?.price ?? 0;
  const original = lowest?.originalPrice ?? price;
  const discount =
    original > 0 ? Math.max(0, Math.round(((original - price) / original) * 100)) : 0;

  const store = lowest?.store;
  const priceHistory =
    historyResult.data.length > 0
      ? historyResult.data.map((p) => p.price)
      : original > price
        ? [original, price]
        : [price];

  return {
    id: product.id,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    imageSrc: product.imageUrl,
    emoji: product.emoji ?? "🛍️",
    discount,
    rating: product.rating ?? 4.5,
    reviews: product.reviewCount,
    price,
    originalPrice: original || price,
    store: store?.name ?? "Zorino",
    storeLogoSrc: store?.logoUrl ?? `/stores/${store?.slug ?? "default"}.png`,
    storeInitial: store?.logoInitial ?? store?.name.slice(0, 2) ?? "?",
    updatedMins: product.lastSyncedAt
      ? Math.max(1, Math.round((Date.now() - new Date(product.lastSyncedAt).getTime()) / 60_000))
      : 5,
    priceHistory,
    badge,
    providerCount: prices.length,
    rankingScore,
    rankingType,
    rank,
    countryCode,
  };
}

/** Fallback when rankings not yet computed — uses live catalog from all providers. */
async function getTrendingProductsFallback(
  rankingType: TrendingRankingType,
  countryCode: string,
  limit: number
): Promise<ServiceResult<TrendingProductCard[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: [], error: null };

  let query = supabase.from("products").select("*").eq("is_active", true).limit(limit * 2);

  if (rankingType === "best_sellers") {
    query = query.order("review_count", { ascending: false });
  } else if (rankingType === "biggest_drops") {
    query = query.order("rating", { ascending: false });
  } else {
    query = query.order("name");
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  const badgeMap: Record<TrendingRankingType, TrendingBadge> = {
    trending_today: "trending",
    best_sellers: "bestseller",
    hot_deals: "hot",
    biggest_drops: "price_drop",
    popular_country: "popular",
  };

  const cards: TrendingProductCard[] = [];
  for (const [index, row] of ((data ?? []) as ProductRow[]).entries()) {
    if (cards.length >= limit) break;
    const card = await productToTrendingCard(
      mapProduct(row),
      rankingType,
      index + 1,
      0,
      badgeMap[rankingType],
      countryCode
    );
    if (card) cards.push(card);
  }

  if (rankingType === "biggest_drops") {
    cards.sort((a, b) => b.discount - a.discount);
  }

  return { data: cards.slice(0, limit), error: null };
}

export async function getProviderCountForProduct(productId: string): Promise<number> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return 0;

  const { count } = await supabase
    .from("prices")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("is_current", true);

  return count ?? 0;
}

export async function getTrendingRefreshStatus() {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await db(supabase)
    .from("trending_refresh_jobs")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
