"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import DealsPageHero from "@/components/deals/DealsPageHero";
import DealsPageSection from "@/components/deals/DealsPageSection";
import DealsDealCard from "@/components/deals/DealsDealCard";
import { buildDealSections } from "@/components/deals/deal-sections";
import { PageEmptyState, PageFilterBar, PageLayout } from "@/components/pages";
import type { Deal } from "@/lib/types/entities";
import "@/components/deals/deals-page.css";

type DealsPageClientProps = {
  deals: Deal[];
};

type QuickFilter = "all" | "featured" | "big_savings" | "ending_soon";

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "all", label: "All Deals" },
  { id: "featured", label: "Featured" },
  { id: "big_savings", label: "Biggest Savings" },
  { id: "ending_soon", label: "Ending Soon" },
];

function daysUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function daysLeft(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function DealsPageClient({ deals }: DealsPageClientProps) {
  const t = useTranslations("deals");
  const tCommon = useTranslations("common");
  const [selectedStore, setSelectedStore] = useState("");
  const [sortBy, setSortBy] = useState("discount");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const storeOptions = useMemo(() => {
    const names = [...new Set(deals.map((d) => d.store?.name).filter(Boolean))] as string[];
    return [{ value: "", label: "All Stores" }, ...names.map((n) => ({ value: n, label: n }))];
  }, [deals]);

  const sortOptions = [
    { value: "discount", label: "Highest Discount" },
    { value: "price_low", label: "Price: Low to High" },
    { value: "price_high", label: "Price: High to Low" },
    { value: "ending_soon", label: "Ending Soon" },
  ];

  const stats = useMemo(() => {
    const maxDiscount = deals.reduce((max, deal) => Math.max(max, deal.discount), 0);
    const featuredCount = deals.filter((deal) => deal.isFeatured).length;
    const endingSoonCount = deals.filter((deal) => daysLeft(deal.endsAt) <= 3).length;
    return {
      liveCount: deals.length,
      maxDiscount: Math.round(maxDiscount),
      featuredCount,
      endingSoonCount,
    };
  }, [deals]);

  const sections = useMemo(() => buildDealSections(deals), [deals]);

  const filtered = useMemo(() => {
    return [...deals]
      .filter((deal) => !selectedStore || deal.store?.name === selectedStore)
      .filter((deal) => {
        if (quickFilter === "featured") return deal.isFeatured;
        if (quickFilter === "big_savings") return deal.discount >= 15;
        if (quickFilter === "ending_soon") return daysLeft(deal.endsAt) <= 5;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_low") return a.price - b.price;
        if (sortBy === "price_high") return b.price - a.price;
        if (sortBy === "ending_soon") {
          return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
        }
        return b.discount - a.discount;
      });
  }, [deals, selectedStore, sortBy, quickFilter]);

  const showCuratedSections =
    quickFilter === "all" && !selectedStore && sortBy === "discount";

  const endsInLabel = (deal: Deal) => `${t("dealEndsIn")} ${daysUntil(deal.endsAt)}`;

  return (
    <PageLayout>
      <div className="zor-deals-page">
        <DealsPageHero
          title={t("title")}
          subtitle={t("subtitle")}
          liveCount={stats.liveCount}
          maxDiscount={stats.maxDiscount}
          featuredCount={stats.featuredCount}
          endingSoonCount={stats.endingSoonCount}
        />

        <div className="zor-deals-page__toolbar">
          <div
            className="zor-deals-page__quick-filters"
            role="tablist"
            aria-label="Quick deal filters"
          >
            {QUICK_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={quickFilter === item.id}
                className={`zor-deals-page__quick-filter${
                  quickFilter === item.id ? " is-active" : ""
                }`}
                onClick={() => setQuickFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <PageFilterBar className="zor-deals-page__filters">
            <div className="zor-deals-page__filter-grid">
              <Select
                label={t("filterByStore")}
                options={storeOptions}
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
              />
              <Select
                label={tCommon("sortBy")}
                options={sortOptions}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              />
              <div className="zor-deals-page__filter-action">
                <Button className="w-full">{tCommon("filter")}</Button>
              </div>
            </div>
          </PageFilterBar>
        </div>

        <div className="zor-deals-page__results-bar">
          <p className="zor-deals-page__results-count">
            {showCuratedSections ? (
              <>
                <strong>{stats.liveCount}</strong> active promotional deals
              </>
            ) : (
              <>
                Showing <strong>{filtered.length}</strong> promotional{" "}
                {filtered.length === 1 ? "deal" : "deals"}
              </>
            )}
          </p>
        </div>

        {showCuratedSections ? (
          <div className="zor-deals-page__sections">
            {sections.map((section) => (
              <DealsPageSection
                key={section.id}
                sectionId={section.id}
                deals={section.deals}
                endsInLabel={endsInLabel}
                featuredLabel={tCommon("featured")}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PageEmptyState
            title="No deals found"
            description="Try adjusting your filters or check back later for new deals."
          />
        ) : (
          <div className="listing-products-grid zor-deals-page__grid">
            {filtered.map((deal) => (
              <DealsDealCard
                key={deal.id}
                deal={deal}
                endsInLabel={endsInLabel(deal)}
                featuredLabel={tCommon("featured")}
              />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
