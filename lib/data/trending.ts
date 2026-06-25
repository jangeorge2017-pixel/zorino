import { getTrendingSectionData } from "@/services/trending";
import type { TrendingProductCard, TrendingRankingType } from "@/lib/types/entities";

export type TrendingSectionData = Record<TrendingRankingType, TrendingProductCard[]>;

export async function getHomepageTrendingSection(countryCode = "US"): Promise<TrendingSectionData> {
  return getTrendingSectionData(countryCode);
}
