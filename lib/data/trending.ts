import { unstable_cache } from "next/cache";
import { getTrendingSectionData } from "@/services/trending";
import {
  DEFAULT_TRENDING_COUNTRY,
  TRENDING_REVALIDATE_SECONDS,
  TRENDING_TAG,
} from "@/lib/trending/config";
import type { TrendingProductCard, TrendingRankingType } from "@/lib/types/entities";

export type TrendingSectionData = Record<TrendingRankingType, TrendingProductCard[]>;

const getCachedTrendingSection = unstable_cache(
  async (countryCode: string) => getTrendingSectionData(countryCode),
  ["homepage-trending-section"],
  {
    revalidate: TRENDING_REVALIDATE_SECONDS,
    tags: [TRENDING_TAG],
  }
);

/** Cached trending section for homepage — always returns populated tabs. */
export async function getHomepageTrendingSection(
  countryCode = DEFAULT_TRENDING_COUNTRY
): Promise<TrendingSectionData> {
  return getCachedTrendingSection(countryCode);
}
