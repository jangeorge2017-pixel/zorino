"use client";

import { useMemo, useState } from "react";
import { Flame, Trophy, Zap, TrendingDown, Globe } from "lucide-react";
import TrendingProductCardView from "@/components/TrendingProductCard";
import HomeSectionHeader from "@/components/HomeSectionHeader";
import { HOME_SECTIONS } from "@/lib/homepage/sections";
import type { TrendingProductCard, TrendingRankingType } from "@/lib/types/entities";
import { getRankingLabel } from "@/lib/trending/labels";

type TrendingProductsSectionProps = {
  data: Record<TrendingRankingType, TrendingProductCard[]>;
  countryCode?: string;
  title?: string;
};

const TABS: {
  id: TrendingRankingType;
  icon: typeof Flame;
}[] = [
  { id: "trending_today", icon: Flame },
  { id: "best_sellers", icon: Trophy },
  { id: "hot_deals", icon: Zap },
  { id: "biggest_drops", icon: TrendingDown },
  { id: "popular_country", icon: Globe },
];

const EMPTY_TRENDING_DATA: Record<TrendingRankingType, TrendingProductCard[]> = {
  trending_today: [],
  best_sellers: [],
  hot_deals: [],
  biggest_drops: [],
  popular_country: [],
};

function normalizeTrendingData(
  data: Record<TrendingRankingType, TrendingProductCard[]> | null | undefined,
): Record<TrendingRankingType, TrendingProductCard[]> {
  return {
    trending_today: data?.trending_today ?? [],
    best_sellers: data?.best_sellers ?? [],
    hot_deals: data?.hot_deals ?? [],
    biggest_drops: data?.biggest_drops ?? [],
    popular_country: data?.popular_country ?? [],
  };
}

export default function TrendingProductsSection({
  data,
  countryCode = "US",
  title = "Featured Products",
}: TrendingProductsSectionProps) {
  const [activeTab, setActiveTab] = useState<TrendingRankingType>("trending_today");

  const safeData = useMemo(() => normalizeTrendingData(data ?? EMPTY_TRENDING_DATA), [data]);

  const products = useMemo(() => {
    const tabProducts = safeData[activeTab] ?? [];
    if (tabProducts.length > 0) return tabProducts;

    for (const tab of TABS) {
      const fallback = safeData[tab.id] ?? [];
      if (fallback.length > 0) return fallback;
    }

    return tabProducts;
  }, [safeData, activeTab]);

  return (
    <section
      id={HOME_SECTIONS["trending-products"].sectionId}
      className="home-section-shell home-section-shell--trending-products trending-products-section"
      aria-labelledby="trending-products-heading"
    >
      <HomeSectionHeader
        variant="trending-products"
        headingId="trending-products-heading"
        title={title}
        subtitle="Ranked by views, clicks and purchases — refreshed every 4 hours"
        updatedLabel="Updated 4 min ago"
        link={{ href: "/search" }}
        animatedIcon
      />

      <div
        className="section-pills-scroll section-pills-scroll--orange"
        role="tablist"
        aria-label="Trending categories"
      >
        <div className="section-pills">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={`section-pill section-pill--orange ${
                activeTab === id ? "is-active" : ""
              }`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} />
              <span>{getRankingLabel(id)}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className="trending-products-grid"
        role="tabpanel"
        aria-label={getRankingLabel(activeTab)}
      >
        {products.map((product) => (
          <TrendingProductCardView
            key={`${activeTab}-${product.id}`}
            product={product}
          />
        ))}
      </div>

      <p className="trending-region-note">
        Showing rankings for <strong>{countryCode}</strong>
      </p>
    </section>
  );
}