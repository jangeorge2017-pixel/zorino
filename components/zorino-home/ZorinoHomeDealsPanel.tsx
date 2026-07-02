"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronDown, Flame } from "lucide-react";
import ZorinoHomeTrendingDealCard from "@/components/zorino-home/ZorinoHomeTrendingDealCard";
import ZorinoHomeTrendingDealsSkeleton from "@/components/zorino-home/ZorinoHomeTrendingDealsSkeleton";
import type { TrendingDealCard } from "@/lib/types/entities";
import {
  TRENDING_DEAL_FILTERS,
  TRENDING_DEAL_SORTS,
  enrichTrendingDeals,
  filterTrendingDeals,
  sortTrendingDeals,
  type TrendingDealFilter,
  type TrendingDealSort,
} from "@/lib/zorino-home/trending-deals-section";
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
    const card = node.querySelector(".zh-td-card");
    const cardWidth = card instanceof HTMLElement ? card.offsetWidth : 280;
    node.scrollBy({ left: direction * (cardWidth + 16), behavior: "smooth" });
    window.setTimeout(syncButtons, 420);
  };

  const isLoading = isPending || showSkeleton;

  return (
    <section
      className="zh-panel zh-deals-panel zh-trending-deals"
      id="zh-section-trending-deals"
      aria-labelledby="zh-deals-title"
    >
      <div className="zh-trending-deals__head">
        <div className="zh-trending-deals__title-wrap">
          <h2 id="zh-deals-title" className="zh-trending-deals__title">
            <Flame size={22} aria-hidden className="zh-trending-deals__icon" />
            Trending Deals
          </h2>
          <Link href="/deals" className="zh-trending-deals__view-all">
            View all deals
            <ChevronDown size={14} aria-hidden />
          </Link>
        </div>

        <div className="zh-trending-deals__controls">
          <div
            className="zh-trending-deals__filters"
            role="tablist"
            aria-label="Filter trending deals"
          >
            {TRENDING_DEAL_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={`zh-trending-deals__filter${
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
              {visibleDeals.map((deal, index) => (
                <ZorinoHomeTrendingDealCard
                  key={deal.id}
                  deal={deal}
                  priority={index < 2}
                />
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
