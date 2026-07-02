import type { TrendingDealCard } from "@/lib/types/entities";

export type TrendingDealDisplayBadge =
  | "trending"
  | "hot"
  | "limited"
  | "best-value";

export type TrendingDealFilter = "all" | TrendingDealDisplayBadge;

export type TrendingDealSort =
  | "biggest_discount"
  | "most_popular"
  | "newest"
  | "lowest_price";

export const TRENDING_DEAL_FILTERS: {
  id: TrendingDealFilter;
  label: string;
}[] = [
  { id: "all", label: "All Deals" },
  { id: "trending", label: "Trending" },
  { id: "hot", label: "Hot" },
  { id: "limited", label: "Limited" },
  { id: "best-value", label: "Best Value" },
];

export const TRENDING_DEAL_SORTS: {
  id: TrendingDealSort;
  label: string;
}[] = [
  { id: "biggest_discount", label: "Biggest Discount" },
  { id: "most_popular", label: "Most Popular" },
  { id: "newest", label: "Newest" },
  { id: "lowest_price", label: "Lowest Price" },
];

export function resolveTrendingDealBadge(
  deal: TrendingDealCard,
): TrendingDealDisplayBadge {
  if (deal.badge === "hot") return "hot";
  if (deal.badge === "bestseller" || deal.badge === "popular") return "best-value";
  if (deal.badge === "trending") return "trending";

  if (deal.discount >= 14) return "hot";
  if (deal.updatedMins <= 5) return "limited";
  if (deal.reviews >= 1800 || deal.rating >= 4.85) return "best-value";
  if (deal.reviews >= 900) return "trending";

  return "trending";
}

export function enrichTrendingDeals(
  deals: TrendingDealCard[],
): (TrendingDealCard & { displayBadge: TrendingDealDisplayBadge })[] {
  return deals.map((deal) => ({
    ...deal,
    displayBadge: resolveTrendingDealBadge(deal),
  }));
}

export function filterTrendingDeals<
  T extends { displayBadge: TrendingDealDisplayBadge },
>(deals: T[], filter: TrendingDealFilter): T[] {
  if (filter === "all") return deals;
  return deals.filter((deal) => deal.displayBadge === filter);
}

export function sortTrendingDeals<
  T extends TrendingDealCard,
>(deals: T[], sort: TrendingDealSort): T[] {
  const next = [...deals];

  switch (sort) {
    case "biggest_discount":
      return next.sort((a, b) => b.discount - a.discount);
    case "most_popular":
      return next.sort((a, b) => b.reviews - a.reviews);
    case "newest":
      return next.sort((a, b) => a.updatedMins - b.updatedMins);
    case "lowest_price":
      return next.sort((a, b) => a.price - b.price);
    default:
      return next;
  }
}

export function getVisibleTrendingDeals(
  deals: TrendingDealCard[],
  filter: TrendingDealFilter,
  sort: TrendingDealSort,
) {
  const enriched = enrichTrendingDeals(deals);
  const filtered = filterTrendingDeals(enriched, filter);
  return sortTrendingDeals(filtered, sort);
}
