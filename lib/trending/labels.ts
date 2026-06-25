import type { TrendingRankingType } from "@/lib/types/entities";

export const RANKING_LABELS: Record<TrendingRankingType, string> = {
  trending_today: "Trending Today",
  best_sellers: "Best Sellers",
  hot_deals: "Hot Deals",
  biggest_drops: "Biggest Drops",
  popular_country: "Popular Near You",
};

export function getRankingLabel(type: TrendingRankingType): string {
  return RANKING_LABELS[type];
}

export const ALL_RANKING_TYPES: TrendingRankingType[] = [
  "trending_today",
  "best_sellers",
  "hot_deals",
  "biggest_drops",
  "popular_country",
];
