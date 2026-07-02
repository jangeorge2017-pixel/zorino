"use client";

import type { TrendingDealDisplayBadge } from "@/lib/zorino-home/trending-deals-section";

const BADGE_LABELS: Record<TrendingDealDisplayBadge, string> = {
  trending: "Trending",
  hot: "Hot",
  limited: "Limited",
  "best-value": "Best Value",
};

type TrendingDealBadgeProps = {
  badge: TrendingDealDisplayBadge;
};

export default function TrendingDealBadge({ badge }: TrendingDealBadgeProps) {
  return (
    <span className={`zh-td-badge zh-td-badge--${badge}`}>
      {BADGE_LABELS[badge]}
    </span>
  );
}
