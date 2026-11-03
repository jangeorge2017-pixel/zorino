import TrendingProductsSection from "@/components/TrendingProductsSection";
import { getHomepageTrendingSection } from "@/lib/data/trending";
import type {
  TrendingProductCard,
  TrendingRankingType,
} from "@/lib/types/entities";

const EMPTY_TRENDING_DATA: Record<TrendingRankingType, TrendingProductCard[]> = {
  trending_today: [],
  best_sellers: [],
  hot_deals: [],
  biggest_drops: [],
  popular_country: [],
};

function normalizeTrendingData(
  data: Partial<Record<TrendingRankingType, TrendingProductCard[]>> | null | undefined,
): Record<TrendingRankingType, TrendingProductCard[]> {
  return {
    trending_today: data?.trending_today ?? [],
    best_sellers: data?.best_sellers ?? [],
    hot_deals: data?.hot_deals ?? [],
    biggest_drops: data?.biggest_drops ?? [],
    popular_country: data?.popular_country ?? [],
  };
}

export default async function TrendingProductsContainer() {
  let data = EMPTY_TRENDING_DATA;

  try {
    const result = await getHomepageTrendingSection("US");
    data = normalizeTrendingData(result);
  } catch {
    // Keep the stable empty fallback shape.
  }

  return <TrendingProductsSection data={data} countryCode="US" />;
}