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
};

type DealRow = {
  product_id: string | null;
  discount: number;
};

const DEFAULT_COUNTRIES = ["US", "GB", "AE", "SA", "DE"] as const;
const TOP_N = 12;
const PAGE_SIZE = 100;

type CountryRankingContext = {
  countryCode: string;
  engagementMap: Map<string, EngagementStat>;
  priceMap: Map<string, PriceRow>;
  dealMap: Map<string, DealRow>;
  rankings: Record<TrendingRankingType, RankedProduct[]>;
};

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
    const contexts: CountryRankingContext[] = [];
    for (const countryCode of DEFAULT_COUNTRIES) {
      contexts.push({
        countryCode,
        engagementMap: await loadEngagementStats(supabase, countryCode),
        priceMap: await loadCurrentPrices(supabase, countryCode),
        dealMap: await loadActiveDeals(supabase),
        rankings: emptyRankings(),
      });
    }

    const productPool: ProductRow[] = [];
    await forEachProductPage(supabase, (product) => {
      if (productPool.length < PAGE_SIZE) productPool.push(product);
      for (const context of contexts) addProductRankings(context, product);
    });

    for (const context of contexts) {
      for (const [rankingType, ranked] of Object.entries(context.rankings) as [
        TrendingRankingType,
        RankedProduct[],
      ][]) {
        const filled = backfillRankings(
          ranked,
          productPool,
          TOP_N,
          badgeForRankingType(rankingType)
        );
        await persistRankings(supabase, rankingType, context.countryCode, filled.slice(0, TOP_N));
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

function emptyRankings(): Record<TrendingRankingType, RankedProduct[]> {
  return {
    trending_today: [],
    best_sellers: [],
    hot_deals: [],
    biggest_drops: [],
    popular_country: [],
  };
}

function pushTopRanked(list: RankedProduct[], item: RankedProduct): void {
  if (list.length < TOP_N) {
    list.push(item);
    list.sort((a, b) => b.score - a.score);
    return;
  }
  if (item.score <= list[list.length - 1].score) return;
  list[list.length - 1] = item;
  list.sort((a, b) => b.score - a.score);
}

function addProductRankings(context: CountryRankingContext, product: ProductRow): void {
  const stats = context.engagementMap.get(product.id);
  const views = stats?.views ?? 0;
  const clicks = stats?.clicks ?? 0;
  const purchases = stats?.purchases ?? 0;
  const engagementScore = trendingEngagementScore({ views, clicks, purchases });

  if (engagementScore > 0) {
    pushTopRanked(context.rankings.trending_today, {
      productId: product.id,
      score: engagementScore,
      badge: "trending",
      metadata: {
        algorithm: "engagement",
        views,
        clicks,
        purchases,
        lookbackDays: TRENDING_LOOKBACK_DAYS,
      },
    });
  }

  const reviewBoost = (product.review_count ?? 0) * 0.01;
  pushTopRanked(context.rankings.best_sellers, {
    productId: product.id,
    score:
      purchases * TRENDING_ENGAGEMENT_WEIGHTS.purchases * 2 +
      clicks * TRENDING_ENGAGEMENT_WEIGHTS.clicks +
      views * 0.5 +
      reviewBoost,
    badge: purchases > 0 ? "bestseller" : null,
    metadata: { algorithm: "best_sellers", purchases, clicks, views },
  });

  const deal = context.dealMap.get(product.id);
  const price = context.priceMap.get(product.id);
  const discount =
    deal?.discount ??
    (price?.original_price && price.original_price > price.price
      ? Math.round(((price.original_price - price.price) / price.original_price) * 100)
      : 0);
  const engagement = stats ? trendingEngagementScore(stats) : 0;

  if (!(discount < 5 && !deal && engagement === 0)) {
    pushTopRanked(context.rankings.hot_deals, {
      productId: product.id,
      score: discount * 0.6 + engagement + (deal ? 15 : 0),
      badge: "hot",
      metadata: { algorithm: "hot_deals", discount, hasDeal: !!deal, engagement },
    });
  }

  if (price?.original_price && price.original_price > price.price) {
    const dropPct = ((price.original_price - price.price) / price.original_price) * 100;
    pushTopRanked(context.rankings.biggest_drops, {
      productId: product.id,
      score: dropPct + engagementScore * 0.1,
      badge: "price_drop",
      metadata: {
        algorithm: "biggest_drops",
        dropPercent: Math.round(dropPct),
        saved: price.original_price - price.price,
      },
    });
  }

  const countryMatch = product.country_code === context.countryCode ? 5 : 0;
  pushTopRanked(context.rankings.popular_country, {
    productId: product.id,
    score: stats
      ? engagementScore + countryMatch
      : catalogFallbackScore(product) + countryMatch,
    badge: "popular",
    metadata: { algorithm: "popular_country", countryCode: context.countryCode },
  });
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

async function forEachPage<T>(
  build: (from: number, to: number) => PromiseLike<unknown>,
  onRow: (row: T) => void
): Promise<void> {
  let offset = 0;

  for (;;) {
    const result = (await build(offset, offset + PAGE_SIZE - 1)) as {
      data: T[] | null;
      error: { message: string } | null;
    };
    if (result.error) throw new Error(result.error.message);

    const rows = result.data ?? [];
    for (const row of rows) onRow(row);

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
}

async function forEachProductPage(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  onProduct: (product: ProductRow) => void
): Promise<void> {
  await forEachPage<ProductRow>(
    (from, to) =>
      db(supabase)
        .from("products")
        .select("id, rating, review_count, last_synced_at, country_code")
        .eq("is_active", true)
        .order("id", { ascending: true })
        .range(from, to),
    onProduct
  );
}

/** Load engagement from daily aggregates, falling back to raw events. */
async function loadEngagementStats(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  countryCode: string
): Promise<Map<string, EngagementStat>> {
  const daily = new Map<string, EngagementStat>();
  const dailySince = new Date(Date.now() - TRENDING_LOOKBACK_DAYS * 24 * 60 * 60_000)
    .toISOString()
    .slice(0, 10);

  await forEachPage<EngagementStat>(
    (from, to) =>
      db(supabase)
        .from("product_engagement_daily")
        .select("product_id, views, clicks, purchases")
        .eq("country_code", countryCode)
        .gte("stat_date", dailySince)
        .order("product_id", { ascending: true })
        .order("stat_date", { ascending: true })
        .range(from, to),
    (row) => addDailyStat(daily, row)
  );

  if ([...daily.values()].some((s) => s.views + s.clicks + s.purchases > 0)) {
    return daily;
  }

  const events = new Map<string, EngagementStat>();
  const eventsSince = new Date(Date.now() - TRENDING_LOOKBACK_DAYS * 24 * 60 * 60_000).toISOString();

  await forEachPage<{ product_id: string; event_type: string }>(
    (from, to) =>
      db(supabase)
        .from("product_engagement_events")
        .select("product_id, event_type")
        .eq("country_code", countryCode)
        .gte("created_at", eventsSince)
        .order("created_at", { ascending: true })
        .order("product_id", { ascending: true })
        .range(from, to),
    (event) => {
      const stat = events.get(event.product_id) ?? {
        product_id: event.product_id,
        views: 0,
        clicks: 0,
        purchases: 0,
      };

      if (event.event_type === "view") stat.views += 1;
      else if (event.event_type === "click") stat.clicks += 1;
      else if (event.event_type === "purchase") stat.purchases += 1;

      events.set(event.product_id, stat);
    }
  );

  return events;
}

function addDailyStat(map: Map<string, EngagementStat>, row: EngagementStat): void {
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

async function loadCurrentPrices(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  countryCode: string
): Promise<Map<string, PriceRow>> {
  const map = new Map<string, PriceRow>();

  await forEachPage<PriceRow>(
    (from, to) =>
      db(supabase)
        .from("prices")
        .select("product_id, price, original_price")
        .eq("is_current", true)
        .eq("country_code", countryCode)
        .order("product_id", { ascending: true })
        .order("store_id", { ascending: true })
        .range(from, to),
    (row) => {
      const existing = map.get(row.product_id);
      if (!existing || row.price < existing.price) map.set(row.product_id, row);
    }
  );

  return map;
}

async function loadActiveDeals(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>
): Promise<Map<string, DealRow>> {
  const now = new Date().toISOString();
  const map = new Map<string, DealRow>();

  await forEachPage<DealRow>(
    (from, to) =>
      db(supabase)
        .from("deals")
        .select("product_id, discount")
        .eq("is_active", true)
        .gte("ends_at", now)
        .order("product_id", { ascending: true })
        .range(from, to),
    (row) => {
      if (row.product_id) map.set(row.product_id, row);
    }
  );

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
