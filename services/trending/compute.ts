import type { TrendingRankingType, TrendingBadge } from "@/lib/types/entities";
import { engagementScore } from "@/services/trending/events";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type RankedProduct = {
  productId: string;
  score: number;
  badge: TrendingBadge | null;
  metadata: Record<string, unknown>;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  rating: number | null;
  review_count: number;
  last_synced_at: string | null;
  country_code: string | null;
};

type DailyStat = {
  product_id: string;
  views: number;
  clicks: number;
  favorites: number;
  purchases: number;
};

type PriceRow = {
  product_id: string;
  price: number;
  original_price: number | null;
  store_id: string;
};

type DealRow = {
  product_id: string | null;
  discount: number;
  is_active: boolean;
  ends_at: string;
};

const DEFAULT_COUNTRIES = ["US", "GB", "AE", "SA", "DE"] as const;
const TOP_N = 12;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: NonNullable<ReturnType<typeof createSupabaseServiceClient>>): any {
  return client;
}

export async function computeAllTrendingRankings(): Promise<{
  ranked: number;
  error?: string;
}> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ranked: 0, error: "Supabase not configured" };

  let totalRanked = 0;

  for (const countryCode of DEFAULT_COUNTRIES) {
    const products = await loadActiveProducts(supabase);
    const dailyStats = await loadDailyStats(supabase, countryCode);
    const prices = await loadCurrentPrices(supabase, countryCode);
    const deals = await loadActiveDeals(supabase);
    const favoriteCounts = await loadFavoriteCounts(supabase);

    const statsMap = mapStats(dailyStats);
    const priceMap = mapPrices(prices);
    const dealMap = mapDeals(deals);

    const rankings: Record<TrendingRankingType, RankedProduct[]> = {
      trending_today: computeTrendingToday(products, statsMap, priceMap, favoriteCounts),
      best_sellers: computeBestSellers(products, statsMap, favoriteCounts),
      hot_deals: computeHotDeals(products, dealMap, statsMap, priceMap),
      biggest_drops: computeBiggestDrops(products, priceMap, statsMap),
      popular_country: computePopularByCountry(products, statsMap, countryCode),
    };

    for (const [rankingType, ranked] of Object.entries(rankings) as [
      TrendingRankingType,
      RankedProduct[],
    ][]) {
      await persistRankings(supabase, rankingType, countryCode, ranked.slice(0, TOP_N));
      totalRanked += Math.min(ranked.length, TOP_N);
    }
  }

  await db(supabase)
    .from("trending_refresh_jobs")
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: new Date(Date.now() + 240 * 60_000).toISOString(),
      last_status: "completed",
      last_error: null,
      items_ranked: totalRanked,
    })
    .not("id", "is", null);

  return { ranked: totalRanked };
}

function computeTrendingToday(
  products: ProductRow[],
  statsMap: Map<string, DailyStat>,
  priceMap: Map<string, PriceRow>,
  favoriteCounts: Map<string, number>
): RankedProduct[] {
  return products
    .map((product) => {
      const stats = statsMap.get(product.id);
      const base = stats
        ? engagementScore(stats)
        : fallbackEngagement(product, favoriteCounts.get(product.id) ?? 0);
      const velocity = stats ? (stats.views + stats.clicks * 2) * 1.5 : base * 0.3;
      const syncBoost = product.last_synced_at ? 2 : 0;
      const price = priceMap.get(product.id);
      const providerBoost = price ? 1 : 0;

      return {
        productId: product.id,
        score: base + velocity + syncBoost + providerBoost,
        badge: "trending" as TrendingBadge,
        metadata: { algorithm: "trending_today", engagement: base, velocity },
      };
    })
    .sort((a, b) => b.score - a.score);
}

function computeBestSellers(
  products: ProductRow[],
  statsMap: Map<string, DailyStat>,
  favoriteCounts: Map<string, number>
): RankedProduct[] {
  return products
    .map((product) => {
      const stats = statsMap.get(product.id);
      const purchases = stats?.purchases ?? 0;
      const clicks = stats?.clicks ?? 0;
      const favorites = (stats?.favorites ?? 0) + (favoriteCounts.get(product.id) ?? 0);
      const reviewBoost = (product.review_count ?? 0) * 0.01;
      const ratingBoost = (product.rating ?? 0) * 2;

      const score =
        purchases * 10 + clicks * 2 + favorites * 3 + reviewBoost + ratingBoost ||
        fallbackEngagement(product, favorites);

      return {
        productId: product.id,
        score,
        badge: "bestseller" as TrendingBadge,
        metadata: { algorithm: "best_sellers", purchases, clicks, favorites },
      };
    })
    .sort((a, b) => b.score - a.score);
}

function computeHotDeals(
  products: ProductRow[],
  dealMap: Map<string, DealRow>,
  statsMap: Map<string, DailyStat>,
  priceMap: Map<string, PriceRow>
): RankedProduct[] {
  const results: RankedProduct[] = [];

  for (const product of products) {
    const deal = dealMap.get(product.id);
    const price = priceMap.get(product.id);
    const discount =
      deal?.discount ??
      (price?.original_price && price.original_price > price.price
        ? Math.round(((price.original_price - price.price) / price.original_price) * 100)
        : 0);
    const stats = statsMap.get(product.id);
    const engagement = stats ? engagementScore(stats) : 0;
    const score = discount * 0.6 + engagement + (deal ? 15 : 0);

    if (discount < 5 && !deal) continue;

    results.push({
      productId: product.id,
      score,
      badge: "hot",
      metadata: { algorithm: "hot_deals", discount, hasDeal: !!deal },
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

function computeBiggestDrops(
  products: ProductRow[],
  priceMap: Map<string, PriceRow>,
  statsMap: Map<string, DailyStat>
): RankedProduct[] {
  const results: RankedProduct[] = [];

  for (const product of products) {
    const price = priceMap.get(product.id);
    if (!price?.original_price || price.original_price <= price.price) continue;

    const dropPct = ((price.original_price - price.price) / price.original_price) * 100;
    const stats = statsMap.get(product.id);
    const engagement = stats ? engagementScore(stats) * 0.1 : 0;

    results.push({
      productId: product.id,
      score: dropPct + engagement,
      badge: "price_drop",
      metadata: {
        algorithm: "biggest_drops",
        dropPercent: Math.round(dropPct),
        saved: price.original_price - price.price,
      },
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

function computePopularByCountry(
  products: ProductRow[],
  statsMap: Map<string, DailyStat>,
  countryCode: string
): RankedProduct[] {
  return products
    .map((product) => {
      const stats = statsMap.get(product.id);
      const countryMatch = product.country_code === countryCode ? 5 : 0;
      const score = stats
        ? engagementScore(stats) + countryMatch
        : fallbackEngagement(product, 0) + countryMatch;

      return {
        productId: product.id,
        score,
        badge: "popular" as TrendingBadge,
        metadata: { algorithm: "popular_country", countryCode },
      };
    })
    .sort((a, b) => b.score - a.score);
}

function fallbackEngagement(product: ProductRow, favorites: number): number {
  return (
    (product.rating ?? 4) * 2 +
    Math.min(product.review_count ?? 0, 5000) * 0.002 +
    favorites * 2 +
    (product.last_synced_at ? 3 : 0)
  );
}

async function loadActiveProducts(supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>) {
  const { data } = await db(supabase)
    .from("products")
    .select("id, slug, name, rating, review_count, last_synced_at, country_code")
    .eq("is_active", true);
  return (data ?? []) as ProductRow[];
}

async function loadDailyStats(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  countryCode: string
) {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
  const { data } = await db(supabase)
    .from("product_engagement_daily")
    .select("product_id, views, clicks, favorites, purchases")
    .eq("country_code", countryCode)
    .gte("stat_date", since);
  return (data ?? []) as DailyStat[];
}

async function loadCurrentPrices(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  countryCode: string
) {
  const { data } = await db(supabase)
    .from("prices")
    .select("product_id, price, original_price, store_id")
    .eq("is_current", true)
    .eq("country_code", countryCode);
  return (data ?? []) as PriceRow[];
}

async function loadActiveDeals(supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>) {
  const now = new Date().toISOString();
  const { data } = await db(supabase)
    .from("deals")
    .select("product_id, discount, is_active, ends_at")
    .eq("is_active", true)
    .gte("ends_at", now);
  return (data ?? []) as DealRow[];
}

async function loadFavoriteCounts(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>
) {
  const { data } = await db(supabase).from("favorites").select("product_id");
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = (row as { product_id: string }).product_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function mapStats(rows: DailyStat[]) {
  const map = new Map<string, DailyStat>();
  for (const row of rows) {
    const existing = map.get(row.product_id);
    if (existing) {
      map.set(row.product_id, {
        product_id: row.product_id,
        views: existing.views + row.views,
        clicks: existing.clicks + row.clicks,
        favorites: existing.favorites + row.favorites,
        purchases: existing.purchases + row.purchases,
      });
    } else {
      map.set(row.product_id, { ...row });
    }
  }
  return map;
}

function mapPrices(rows: PriceRow[]) {
  const map = new Map<string, PriceRow>();
  for (const row of rows) {
    const existing = map.get(row.product_id);
    if (!existing || row.price < existing.price) {
      map.set(row.product_id, row);
    }
  }
  return map;
}

function mapDeals(rows: DealRow[]) {
  const map = new Map<string, DealRow>();
  for (const row of rows) {
    if (row.product_id) map.set(row.product_id, row);
  }
  return map;
}

async function persistRankings(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  rankingType: TrendingRankingType,
  countryCode: string,
  ranked: RankedProduct[]
) {
  await db(supabase)
    .from("trending_rankings")
    .delete()
    .eq("ranking_type", rankingType)
    .eq("country_code", countryCode);

  if (ranked.length === 0) return;

  const rows = ranked.map((item, index) => ({
    ranking_type: rankingType,
    country_code: countryCode,
    product_id: item.productId,
    rank: index + 1,
    score: item.score,
    badge: item.badge,
    metadata: item.metadata,
    computed_at: new Date().toISOString(),
  }));

  await db(supabase).from("trending_rankings").insert(rows);
}

export async function isTrendingRefreshDue(): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return false;

  const { data } = await db(supabase)
    .from("trending_refresh_jobs")
    .select("next_run_at, is_enabled")
    .limit(1)
    .maybeSingle();

  if (!data?.is_enabled) return false;
  if (!data.next_run_at) return true;
  return new Date(data.next_run_at).getTime() <= Date.now();
}

export async function executeTrendingRefresh() {
  return computeAllTrendingRankings();
}
