"use client";

import { useTranslations } from "next-intl";
import type { TrendingDealDisplayBadge } from "@/lib/zorino-home/trending-deals-section";

const BADGE_KEYS: Record<TrendingDealDisplayBadge, string> = {
  trending: "filterTrending",
  hot: "filterHot",
  limited: "filterLimited",
  "best-value": "filterBestValue",
};

type TrendingDealBadgeProps = {
  badge: TrendingDealDisplayBadge;
};

export default function TrendingDealBadge({ badge }: TrendingDealBadgeProps) {
  const t = useTranslations("home");

  return (
    <span className={`zh-td-badge zh-td-badge--${badge}`}>
      {t(BADGE_KEYS[badge] as "filterTrending")}
    </span>
  );
}
