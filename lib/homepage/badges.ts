import type { TrendingBadge } from "@/lib/types/entities";
import type { HomeSectionVariant } from "@/lib/homepage/sections";

export type DynamicBadgeType =
  | "hot"
  | "new"
  | "flash-deal"
  | "price-dropped"
  | "trending"
  | "editor-pick"
  | "best-price";

export const DYNAMIC_BADGE_LABELS: Record<DynamicBadgeType, string> = {
  hot: "Hot",
  new: "New",
  "flash-deal": "Flash Deal",
  "price-dropped": "Price dropped",
  trending: "Trending",
  "editor-pick": "Editor Pick",
  "best-price": "Best Price",
};

export function resolveDynamicBadge(options: {
  variant: HomeSectionVariant;
  trendingBadge?: TrendingBadge | null;
  isNew?: boolean;
  isNewLow?: boolean;
  discount?: number;
}): DynamicBadgeType {
  if (options.isNew || options.isNewLow) return "new";

  if (options.trendingBadge === "hot") return "hot";
  if (options.trendingBadge === "price_drop") return "price-dropped";
  if (
    options.trendingBadge === "trending" ||
    options.trendingBadge === "bestseller" ||
    options.trendingBadge === "popular"
  ) {
    return "trending";
  }

  switch (options.variant) {
    case "lowest-price":
      return "best-price";
    case "trending-deals":
      return "price-dropped";
    case "recommended-products":
      return "editor-pick";
    case "recommended-for-you":
      return options.discount && options.discount >= 30 ? "hot" : "trending";
    case "trending-products":
      return "trending";
    default:
      return "hot";
  }
}
