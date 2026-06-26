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

export default function TrendingProductsSection({
  data,
  countryCode = "US",
}: TrendingProductsSectionProps) {
  const [activeTab, setActiveTab] = useState<TrendingRankingType>("trending_today");

  const products = useMemo(() => {
    const tabProducts = data[activeTab] ?? [];
    if (tabProducts.length > 0) return tabProducts;
    for (const tab of TABS) {
      const fallback = data[tab.id] ?? [];
      if (fallback.length > 0) return fallback;
    }
    return tabProducts;
  }, [data, activeTab]);

  return (
    <section
      id={HOME_SECTIONS["trending-products"].sectionId}
      className="home-section-shell home-section-shell--trending-products trending-products-section"
      aria-labelledby="trending-products-heading"
    >
      <HomeSectionHeader
        variant="trending-products"
        headingId="trending-products-heading"
        title="Trending Products"
        subtitle="Ranked by views, clicks and purchases — refreshed every 4 hours"
      />

      <div className="trending-tabs-scroll" role="tablist" aria-label="Trending categories">
        <div className="trending-tabs">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={`trending-tab ${activeTab === id ? "trending-tab-active" : ""}`}
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
          <TrendingProductCardView key={`${activeTab}-${product.id}`} product={product} />
        ))}
      </div>

      <p className="trending-region-note">
        Showing rankings for <strong>{countryCode}</strong>
      </p>
    </section>
  );
}
