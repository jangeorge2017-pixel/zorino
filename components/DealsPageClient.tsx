"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import ListingProductCard from "@/components/ListingProductCard";
import DealsPageHero from "@/components/deals/DealsPageHero";
import { PageEmptyState, PageFilterBar, PageLayout } from "@/components/pages";
import { Clock, Flame } from "lucide-react";
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

  const spotlightDeals = useMemo(() => {
    return [...deals].sort((a, b) => b.discount - a.discount).slice(0, 3);
  }, [deals]);

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

        {spotlightDeals.length > 0 && quickFilter === "all" && !selectedStore ? (
          <section className="zor-deals-page__spotlight" aria-label="Top savings">
            <div className="zor-deals-page__spotlight-head">
              <h2 className="zor-deals-page__spotlight-title">Top savings right now</h2>
              <span className="zor-deals-page__promo-tag">
                <Flame size={12} aria-hidden />
                {t("limitedTimeOffer")}
              </span>
            </div>
            <div className="zor-deals-page__spotlight-grid">
              {spotlightDeals.map((deal) => (
                <Link
                  key={`spotlight-${deal.id}`}
                  href={`/product/${deal.product?.id ?? deal.id}`}
                  className="zor-deals-page__spotlight-card"
                >
                  <span className="zor-deals-page__spotlight-discount">
                    -{Math.round(deal.discount)}%
                  </span>
                  <div className="zor-deals-page__spotlight-copy">
                    <strong>{deal.product?.name ?? deal.title}</strong>
                    <span>
                      ${deal.price.toLocaleString("en-US")} · {deal.store?.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="flex items-end">
              <Button className="w-full">{tCommon("filter")}</Button>
            </div>
          </div>
        </PageFilterBar>

        <div className="zor-deals-page__results-bar">
          <p className="zor-deals-page__results-count">
            Showing <strong>{filtered.length}</strong> promotional{" "}
            {filtered.length === 1 ? "deal" : "deals"}
          </p>
        </div>

        {filtered.length === 0 ? (
          <PageEmptyState
            title="No deals found"
            description="Try adjusting your filters or check back later for new deals."
          />
        ) : (
          <div className="listing-products-grid zor-deals-page__grid">
            {filtered.map((deal) => (
              <div key={deal.id} className="zor-deals-page__card">
                {deal.isFeatured ? (
                  <span className="zor-deals-page__featured-badge">{tCommon("featured")}</span>
                ) : null}
                <ListingProductCard
                  product={{
                    id: deal.product?.id ?? deal.id,
                    name: deal.product?.name ?? deal.title,
                    imageSrc: deal.product?.imageUrl ?? "",
                    emoji: deal.product?.emoji ?? undefined,
                    price: deal.price,
                    originalPrice: deal.originalPrice,
                    discount: Math.round(deal.discount),
                    rating: deal.product?.rating ?? undefined,
                    reviewCount: deal.product?.reviewCount ?? undefined,
                    store: deal.store?.name ?? undefined,
                  }}
                  showWishlist={false}
                />
                <p className="listing-deal-meta">
                  <Clock size={14} aria-hidden />
                  {t("dealEndsIn")} {daysUntil(deal.endsAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
