import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";
import { AFFILIATE_MARKETPLACES } from "@/lib/affiliate/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

export type AffiliateAnalytics = {
  totalClicks: number;
  clicksLast7Days: number;
  clicksLast30Days: number;
  byMarketplace: { marketplace: string; clicks: number }[];
  bySource: { source: string; clicks: number }[];
  topProducts: { productId: string; productName: string; clicks: number }[];
  dailyClicks: { date: string; clicks: number }[];
};

export async function getAffiliateAnalytics(): Promise<AffiliateAnalytics> {
  const supabase = createSupabaseAnonClient();
  const empty: AffiliateAnalytics = {
    totalClicks: 0,
    clicksLast7Days: 0,
    clicksLast30Days: 0,
    byMarketplace: AFFILIATE_MARKETPLACES.map((m) => ({ marketplace: m, clicks: 0 })),
    bySource: [],
    topProducts: [],
    dailyClicks: [],
  };

  if (!supabase) return empty;

  const now = Date.now();
  const since7 = new Date(now - 7 * 24 * 60 * 60_000).toISOString();
  const since30 = new Date(now - 30 * 24 * 60 * 60_000).toISOString();

  const { count: totalClicks } = await supabase
    .from("affiliate_clicks")
    .select("*", { count: "exact", head: true });

  const { count: clicksLast7Days } = await supabase
    .from("affiliate_clicks")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since7);

  const { count: clicksLast30Days } = await supabase
    .from("affiliate_clicks")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since30);

  const { data: clickRows } = await db(supabase)
    .from("affiliate_clicks")
    .select("marketplace, source, product_id, created_at, products (name)")
    .gte("created_at", since30)
    .order("created_at", { ascending: false })
    .limit(500);

  const marketplaceCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const productCounts = new Map<string, { name: string; clicks: number }>();
  const dailyCounts = new Map<string, number>();

  for (const row of clickRows ?? []) {
    const r = row as {
      marketplace: string;
      source: string | null;
      product_id: string | null;
      created_at: string;
      products: { name: string } | null;
    };

    marketplaceCounts.set(r.marketplace, (marketplaceCounts.get(r.marketplace) ?? 0) + 1);

    const source = r.source ?? "direct";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);

    if (r.product_id) {
      const existing = productCounts.get(r.product_id);
      productCounts.set(r.product_id, {
        name: r.products?.name ?? "Product",
        clicks: (existing?.clicks ?? 0) + 1,
      });
    }

    const day = r.created_at.slice(0, 10);
    dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
  }

  return {
    totalClicks: totalClicks ?? 0,
    clicksLast7Days: clicksLast7Days ?? 0,
    clicksLast30Days: clicksLast30Days ?? 0,
    byMarketplace: AFFILIATE_MARKETPLACES.map((marketplace) => ({
      marketplace,
      clicks: marketplaceCounts.get(marketplace) ?? 0,
    })),
    bySource: [...sourceCounts.entries()]
      .map(([source, clicks]) => ({ source, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10),
    topProducts: [...productCounts.entries()]
      .map(([productId, { name, clicks }]) => ({ productId, productName: name, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10),
    dailyClicks: [...dailyCounts.entries()]
      .map(([date, clicks]) => ({ date, clicks }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14),
  };
}
