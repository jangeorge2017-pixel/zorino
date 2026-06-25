"use client";

import type { TrendingBadge } from "@/lib/types/entities";

const BADGE_CONFIG: Record<
  TrendingBadge,
  { label: string; className: string }
> = {
  trending: { label: "Trending", className: "trending-badge-trending" },
  bestseller: { label: "Best Seller", className: "trending-badge-bestseller" },
  hot: { label: "Hot Deal", className: "trending-badge-hot" },
  price_drop: { label: "Price Drop", className: "trending-badge-drop" },
  popular: { label: "Popular", className: "trending-badge-popular" },
};

type TrendingBadgePillProps = {
  badge: TrendingBadge;
  size?: "sm" | "md";
};

export default function TrendingBadgePill({ badge, size = "md" }: TrendingBadgePillProps) {
  const config = BADGE_CONFIG[badge];
  return (
    <span className={`trending-badge ${config.className} trending-badge-${size}`}>
      {config.label}
    </span>
  );
}

export function getBadgeLabel(badge: TrendingBadge): string {
  return BADGE_CONFIG[badge].label;
}
