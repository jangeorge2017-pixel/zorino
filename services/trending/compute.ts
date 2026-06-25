import type { TrendingRankingType, TrendingBadge } from "@/lib/types/entities";
import {
  TRENDING_ENGAGEMENT_WEIGHTS,
  TRENDING_LOOKBACK_DAYS,
  TRENDING_REFRESH_INTERVAL_MINUTES,
} from "@/lib/trending/config";
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

type EngagementStat = {
  product_id: string;
  views: number;
  clicks: number;
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

/** Score from real user engagement: views, clicks, purchases. */
export function trendingEngagementScore(stats: {
  views: number;
  clicks: number;
  purchases: number;
}): number {
  return (
    stats.views * TRENDING_ENGAGEMENT_WEIGHTS.views +
    stats.clicks * TRENDING_ENGAGEMENT_WEIGHTS.clicks +
    stats.purchases * TRENDING_ENGAGEMENT_WEIGHTS.purchases
  );
}

export async function computeAllTrendingRankings(): Promise<{
  ranked: number;
  error?: string;
}> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ranked: 0, error: "Supabase not configured" };

  await db(supabase)
    .from("trending_refresh_jobs")
    .update({ last_status: "running", last_error: null })
    .not("id", "is", null);

  let totalRanked = 0;

  try {
    for (const countryCode of DEFAULT_COUNTRIES) {
      const products = await loadActiveProducts(supabase);
      const engagementMap = await loadEngagementStats(supabase, countryCode);
      const prices = await loadCurrentPrices(supabase, countryCode);
      const deals = await loadActiveDeals(supabase);

      const priceMap = mapPrices(prices);
      const dealMap = mapDeals(deals);

      const rankings: Record<TrendingRankingType, RankedProduct[]> = {
        trending_today: computeTrendingToday(products, engagementMap),
        best_sellers: computeBestSellers(products, engagementMap),
        hot_deals: computeHotDeals(products, dealMap, engagementMap, priceMap),
        biggest_drops: computeBiggestDrops(products, priceMap, engagementMap),
        popular_country: computePopularByCountry(products, engagementMap, countryCode),
      };

      for (const [rankingType, ranked] of Object.entries(rankings) as [
        TrendingRankingType,
        RankedProduct[],
      ][]) {
        const filled = backfillRankings(
          ranked,
          products,
          TOP_N,
          badgeForRankingType(rankingType as TrendingRankingType)
        );
        await persistRankings(supabase, rankingType, countryCode, filled.slice(0, TOP_N));
        totalRanked += Math.min(filled.length, TOP_N);
      }
    }

    await db(supabase)
      .from("trending_refresh_jobs")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: new Date(
          Date.now() + TRENDING_REFRESH_INTERVAL_MINUTES * 60_000
        ).toISOString(),
        last_status: "completed",
        last_error: null,
        items_ranked: totalRanked,
      })
      .not("id", "is", null);

    return { ranked: totalRanked };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trending compute failed";
    await db(supabase)
      .from("trending_refresh_jobs")
      .update({ last_status: "failed", last_error: message })
      .not("id", "is", null);
    return { ranked: totalRanked, error: message };
  }
}

function computeTrendingToday(
  products: ProductRow[],
  engagementMap: Map<string, EngagementStat>
): RankedProduct[] {
  return products
    .map((product) => {
      const stats = engagementMap.get(product.id);
      const views = stats?.views ?? 0;
      const clicks = stats?.clicks ?? 0;
      const purchases = stats?.purchases ?? 0;
      const score = trendingEngagementScore({ views, clicks, purchases });

      return {
        productId: product.id,
        score,
        badge: score > 0 ? ("trending" as TrendingBadge) : null,
        metadata: {
          algorithm: "engagement",
          views,
          clicks,
          purchases,
          lookbackDays: TRENDING_LOOKBACK_DAYS,
        },
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function computeBestSellers(
  products: ProductRow[],
  engagementMap: Map<string, EngagementStat>
): RankedProduct[] {
  return products
    .map((product) => {
      const stats = engagementMap.get(product.id);
      const purchases = stats?.purchases ?? 0;
      const clicks = stats?.clicks ?? 0;
      const views = stats?.views ?? 0;
      const reviewBoost = (product.review_count ?? 0) * 0.01;
      const score =
        purchases * TRENDING_ENGAGEMENT_WEIGHTS.purchases * 2 +
        clicks * TRENDING_ENGAGEMENT_WEIGHTS.clicks +
        views * 0.5 +
        reviewBoost;

      return {
        productId: product.id,
        score,
        badge: purchases > 0 ? ("bestseller" as TrendingBadge) : null,
        metadata: { algorithm: "best_sellers", purchases, clicks, views },
      };
    })
    .sort((a, b) => b.score - a.score);
}

function computeHotDeals(
  products: ProductRow[],
  dealMap: Map<string, DealRow>,
  engagementMap: Map<string, EngagementStat>,
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
    const stats = engagementMap.get(product.id);
    const engagement = stats ? trendingEngagementScore(stats) : 0;
    const score = discount * 0.6 + engagement + (deal ? 15 : 0);

    if (discount < 5 && !deal && engagement === 0) continue;

    results.push({
      productId: product.id,
      score,
      badge: "hot",
      metadata: { algorithm: "hot_deals", discount, hasDeal: !!deal, engagement },
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

function computeBiggestDrops(
  products: ProductRow[],
  priceMap: Map<string, PriceRow>,
  engagementMap: Map<string, EngagementStat>
): RankedProduct[] {
  const results: RankedProduct[] = [];

  for (const product of products) {
    const price = priceMap.get(product.id);
    if (!price?.original_price || price.original_price <= price.price) continue;

    const dropPct = ((price.original_price - price.price) / price.original_price) * 100;
    const stats = engagementMap.get(product.id);
    const engagement = stats ? trendingEngagementScore(stats) * 0.1 : 0;

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
  engagementMap: Map<string, EngagementStat>,
  countryCode: string
): RankedProduct[] {
  return products
    .map((product) => {
      const stats = engagementMap.get(product.id);
      const countryMatch = product.country_code === countryCode ? 5 : 0;
      const score = stats
        ? trendingEngagementScore(stats) + countryMatch
        : catalogFallbackScore(product) + countryMatch;

      return {
        productId: product.id,
        score,
        badge: "popular" as TrendingBadge,
        metadata: { algorithm: "popular_country", countryCode },
      };
    })
    .sort((a, b) => b.score - a.score);
}

function catalogFallbackScore(product: ProductRow): number {
  return (
    (product.rating ?? 4) * 2 +
    Math.min(product.review_count ?? 0, 5000) * 0.002 +
    (product.last_synced_at ? 3 : 0)
  );
}

function badgeForRankingType(type: TrendingRankingType): TrendingBadge {
  const map: Record<TrendingRankingType, TrendingBadge> = {
    trending_today: "trending",
    best_sellers: "bestseller",
    hot_deals: "hot",
    biggest_drops: "price_drop",
    popular_country: "popular",
  };
  return map[type];
}

function backfillRankings(
  ranked: RankedProduct[],
  products: ProductRow[],
  max: number,
  badge: TrendingBadge
): RankedProduct[] {
  const seen = new Set(ranked.map((item) => item.productId));
  const result = [...ranked];

  for (const product of products) {
    if (result.length >= max) break;
    if (seen.has(product.id)) continue;
    result.push({
      productId: product.id,
      score: catalogFallbackScore(product) * 0.01,
      badge,
      metadata: { algorithm: "catalog_fallback" },
    });
    seen.add(product.id);
  }

  return result;
}

async function loadActiveProducts(supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>) {
  const { data } = await db(supabase)
    .from("products")
    .select("id, slug, name, rating, review_count, last_synced_at, country_code")
    .eq("is_active", true);
  return (data ?? []) as ProductRow[];
}

/** Load engagement from daily aggregates, falling back to raw events. */
async function loadEngagementStats(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  countryCode: string
): Promise<Map<string, EngagementStat>> {
  const daily = await loadDailyStats(supabase, countryCode);
  const map = aggregateDailyStats(daily);

  if ([...map.values()].some((s) => s.views + s.clicks + s.purchases > 0)) {
    return map;
  }

  return loadEngagementFromEvents(supabase, countryCode);
}

async function loadDailyStats(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  countryCode: string
) {
  const since = new Date(Date.now() - TRENDING_LOOKBACK_DAYS * 24 * 60 * 60_000)
    .toISOString()
    .slice(0, 10);
  const { data } = await db(supabase)
    .from("product_engagement_daily")
    .select("product_id, views, clicks, purchases")
    .eq("country_code", countryCode)
    .gte("stat_date", since);
  return (data ?? []) as EngagementStat[];
}

async function loadEngagementFromEvents(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  countryCode: string
) {
  const since = new Date(Date.now() - TRENDING_LOOKBACK_DAYS * 24 * 60 * 60_000).toISOString();
  const { data } = await db(supabase)
    .from("product_engagement_events")
    .select("product_id, event_type")
    .eq("country_code", countryCode)
    .gte("created_at", since);

  const map = new Map<string, EngagementStat>();

  for (const row of data ?? []) {
    const event = row as { product_id: string; event_type: string };
    const stat = map.get(event.product_id) ?? {
      product_id: event.product_id,
      views: 0,
      clicks: 0,
      purchases: 0,
    };

    if (event.event_type === "view") stat.views += 1;
    else if (event.event_type === "click") stat.clicks += 1;
    else if (event.event_type === "purchase") stat.purchases += 1;

    map.set(event.product_id, stat);
  }

  return map;
}

function aggregateDailyStats(rows: EngagementStat[]) {
  const map = new Map<string, EngagementStat>();
  for (const row of rows) {
    const existing = map.get(row.product_id);
    if (existing) {
      map.set(row.product_id, {
        product_id: row.product_id,
        views: existing.views + row.views,
        clicks: existing.clicks + row.clicks,
        purchases: existing.purchases + row.purchases,
      });
    } else {
      map.set(row.product_id, { ...row });
    }
  }
  return map;
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
