"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import ZorinoHomeSectionHeader from "@/components/zorino-home/ZorinoHomeSectionHeader";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import { getCarouselScrollState, attachVerticalWheelPassthrough } from "@/lib/ui/carousel-scroll";
import "./zorino-home-deals.css";

const FILTER_KEYS: Record<TrendingDealFilter, string> = {
  all: "filterAll",
  trending: "filterTrending",
  hot: "filterHot",
  limited: "filterLimited",
  "best-value": "filterBestValue",
};

const SORT_KEYS: Record<TrendingDealSort, string> = {
  biggest_discount: "sortBiggestDiscount",
  most_popular: "sortMostPopular",
  newest: "sortNewest",
  lowest_price: "sortLowestPrice",
};

type ZorinoHomeDealsPanelProps = {
  deals: TrendingDealCard[];
};

export default function ZorinoHomeDealsPanel({ deals }: ZorinoHomeDealsPanelProps) {
  const t = useTranslations("home");
  const locale = useLocale();
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
    const { canScrollPrev, canScrollNext } = getCarouselScrollState(node);
    setCanScrollLeft(canScrollPrev);
    setCanScrollRight(canScrollNext);
  }, []);

  useEffect(() => {
    syncButtons();
    window.addEventListener("resize", syncButtons);
    return () => window.removeEventListener("resize", syncButtons);
  }, [visibleDeals.length, syncButtons]);

  useEffect(() => {
    if (isPending || showSkeleton) return;
    const node = trackRef.current;
    if (!node) return;
    return attachVerticalWheelPassthrough(node);
  }, [visibleDeals.length, isPending, showSkeleton]);

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
    const rtlFactor = locale === "ar" ? -1 : 1;
    node.scrollBy({
      left: direction * rtlFactor * (slideWidth + 16),
      behavior: "smooth",
    });
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
      {/*
        Inline so the CSS bundler cannot strip `backdrop-filter: none`
        (it drops it as an “initial” value). Track cards must match Top
        Coupons paint — no filter compositing layer under sticky chrome.
      */}
      <style>{`
        #zh-section-trending-deals .zh-trending-deals__track .deal-card,
        #zh-section-trending-deals .zh-trending-deals__track .product-card {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
      `}</style>
      <ZorinoHomeSectionHeader
        className="zh-trending-deals__head"
        titleId="zh-deals-title"
        title={t("trendingDeals")}
        subtitle={t("trendingDealsSubtitle")}
        icon={<TrendingIcon size={18} aria-hidden />}
        viewAll={{ href: "/deals", variant: "deals" }}
        actions={
          <label className="zh-trending-deals__sort">
            <span className="zh-trending-deals__sort-label">{t("sortBy")}</span>
            <select
              value={sort}
              onChange={handleSortChange}
              aria-label={t("sortBy")}
              className="zh-trending-deals__sort-select"
            >
              {TRENDING_DEAL_SORTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(SORT_KEYS[item.id] as "sortNewest")}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <div className="zh-trending-deals__controls">
          <div
            className="zh-trending-deals__filters zor-deals-page__quick-filters"
            role="tablist"
            aria-label={t("filterDeals")}
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
                {t(FILTER_KEYS[item.id] as "filterAll")}
              </button>
            ))}
          </div>
        </div>
      </ZorinoHomeSectionHeader>

      {deals.length === 0 ? (
        <p className="zh-panel__empty">{t("emptyTrending")}</p>
      ) : visibleDeals.length === 0 ? (
        <p className="zh-panel__empty">{t("emptyFilter")}</p>
      ) : (
        <div className="zh-trending-deals__carousel">
          <button
            type="button"
            className="zh-trending-deals__nav zh-trending-deals__nav--prev"
            aria-label={t("prevDeals")}
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
                    featuredLabel={t("featured")}
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="zh-trending-deals__nav zh-trending-deals__nav--next"
            aria-label={t("nextDeals")}
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
