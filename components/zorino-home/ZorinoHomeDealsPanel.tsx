"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import ZorinoHomeViewAllLink from "@/components/zorino-home/ZorinoHomeViewAllLink";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DealsDealCard from "@/components/deals/DealsDealCard";
import ZorinoHomeTrendingDealsSkeleton from "@/components/zorino-home/ZorinoHomeTrendingDealsSkeleton";
import { ZH_TRENDING_DEALS_META } from "@/lib/zorino-home/home-section-meta";
import {
  TRENDING_DEAL_FILTERS,
  TRENDING_DEAL_SORTS,
  enrichTrendingDeals,
  filterTrendingDeals,
  sortTrendingDeals,
  type TrendingDealFilter,
  type TrendingDealSort,
} from "@/lib/zorino-home/trending-deals-section";
import {
  trendingDealEndsInLabel,
  trendingDealToDeal,
} from "@/lib/zorino-home/trending-deal-to-deal";
import type { TrendingDealCard } from "@/lib/types/entities";
import "./zorino-home-deals.css";

type ZorinoHomeDealsPanelProps = {
  deals: TrendingDealCard[];
};

export default function ZorinoHomeDealsPanel({ deals }: ZorinoHomeDealsPanelProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<TrendingDealFilter>("all");
  const [sort, setSort] = useState<TrendingDealSort>("biggest_discount");
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showSkeleton, setShowSkeleton] = useState(false);

  const enrichedDeals = useMemo(() => enrichTrendingDeals(deals), [deals]);

  const visibleDeals = useMemo(() => {
    const filtered = filterTrendingDeals(enrichedDeals, filter);
    return sortTrendingDeals(filtered, sort);
  }, [enrichedDeals, filter, sort]);

  const syncButtons = useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    setCanScrollLeft(node.scrollLeft > 4);
    setCanScrollRight(node.scrollLeft < node.scrollWidth - node.clientWidth - 4);
  }, []);

  useEffect(() => {
    syncButtons();
    window.addEventListener("resize", syncButtons);
    return () => window.removeEventListener("resize", syncButtons);
  }, [visibleDeals.length, syncButtons]);

  useEffect(() => {
    setShowSkeleton(true);
    const timer = window.setTimeout(() => setShowSkeleton(false), 180);
    return () => window.clearTimeout(timer);
  }, [filter, sort]);

  const handleFilterChange = (next: TrendingDealFilter) => {
    startTransition(() => setFilter(next));
  };

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    startTransition(() => setSort(event.target.value as TrendingDealSort));
  };

  const scroll = (direction: -1 | 1) => {
    const node = trackRef.current;
    if (!node) return;
    const slide = node.querySelector(".zh-trending-deals__slide");
    const slideWidth = slide instanceof HTMLElement ? slide.offsetWidth : 280;
    node.scrollBy({ left: direction * (slideWidth + 16), behavior: "smooth" });
    window.setTimeout(syncButtons, 420);
  };

  const isLoading = isPending || showSkeleton;
  const TrendingIcon = ZH_TRENDING_DEALS_META.icon;

  return (
    <section
      className="zh-panel zh-deals-panel zh-trending-deals zh-deals-preview zor-deals-page zor-deals-page__section zor-deals-page__section--trending"
      id="zh-section-trending-deals"
      aria-labelledby="zh-deals-title"
    >
      <div className="zh-trending-deals__head">
        <header className="zor-deals-page__section-head zh-trending-deals__title-row">
          <div className="zor-deals-page__section-title-wrap">
            <span className="zor-deals-page__section-icon" aria-hidden>
              <TrendingIcon size={18} />
            </span>
            <div>
              <h2 id="zh-deals-title" className="zor-deals-page__section-title">
                Trending Deals
              </h2>
              <p className="zor-deals-page__section-subtitle">
                {ZH_TRENDING_DEALS_META.subtitle}
              </p>
            </div>
          </div>
          <ZorinoHomeViewAllLink href="/deals" variant="deals" />
        </header>

        <div className="zh-trending-deals__controls">
          <div
            className="zh-trending-deals__filters zor-deals-page__quick-filters"
            role="tablist"
            aria-label="Filter trending deals"
          >
            {TRENDING_DEAL_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={`zh-trending-deals__filter zor-deals-page__quick-filter${
                  filter === item.id ? " is-active" : ""
                }`}
                onClick={() => handleFilterChange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="zh-trending-deals__sort">
            <span className="zh-trending-deals__sort-label">Sort by</span>
            <select
              value={sort}
              onChange={handleSortChange}
              aria-label="Sort trending deals"
              className="zh-trending-deals__sort-select"
            >
              {TRENDING_DEAL_SORTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {deals.length === 0 ? (
        <p className="zh-panel__empty">No trending deals right now. Check back soon.</p>
      ) : visibleDeals.length === 0 ? (
        <p className="zh-panel__empty">No deals match this filter. Try another category.</p>
      ) : (
        <div className="zh-trending-deals__carousel">
          <button
            type="button"
            className="zh-trending-deals__nav zh-trending-deals__nav--prev"
            aria-label="Previous deals"
            disabled={!canScrollLeft}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft size={18} />
          </button>

          {isLoading ? (
            <ZorinoHomeTrendingDealsSkeleton count={Math.min(visibleDeals.length, 4)} />
          ) : (
            <div
              className="zh-trending-deals__track"
              ref={trackRef}
              onScroll={syncButtons}
              aria-live="polite"
            >
              {visibleDeals.map((deal) => (
                <div key={deal.id} className="zh-trending-deals__slide">
                  <DealsDealCard
                    deal={trendingDealToDeal(deal, {
                      featured: deal.displayBadge === "hot" || deal.displayBadge === "limited",
                    })}
                    endsInLabel={trendingDealEndsInLabel(deal)}
                    featuredLabel="Featured"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="zh-trending-deals__nav zh-trending-deals__nav--next"
            aria-label="Next deals"
            disabled={!canScrollRight}
            onClick={() => scroll(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
