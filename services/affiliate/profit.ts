import { createSupabaseServiceClient } from "@/lib/supabase/server";

const ESTIMATED_ORDER_VALUE = 45;

export type ProfitAnalytics = {
  estimatedConversions: number;
  estimatedRevenue: number;
  estimatedCommission: number;
  conversionRate: number;
  avgCommissionRate: number;
};

/** Estimate profit/commission from click volume and configured rates. */
export async function getProfitAnalytics(
  totalClicks: number,
  clicksLast30Days: number
): Promise<ProfitAnalytics> {
  const supabase = createSupabaseServiceClient();
  let avgCommissionRate = 5;

  if (supabase) {
    const { data } = await supabase
      .from("affiliate_settings")
      .select("commission_rate")
      .eq("is_enabled", true);
    const rates = ((data ?? []) as { commission_rate: number }[]).map((r) =>
      Number(r.commission_rate)
    );
    if (rates.length > 0) {
      avgCommissionRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    }
  }

  const conversionRate = 0.03;
  const estimatedConversions = Math.round(clicksLast30Days * conversionRate);
  const estimatedRevenue = estimatedConversions * ESTIMATED_ORDER_VALUE;
  const estimatedCommission = (estimatedRevenue * avgCommissionRate) / 100;

  return {
    estimatedConversions,
    estimatedRevenue,
    estimatedCommission,
    conversionRate,
    avgCommissionRate,
  };
}
