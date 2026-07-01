"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import ListingProductCard from "@/components/ListingProductCard";
import { PageEmptyState, PageFilterBar, PageHeader, PageLayout } from "@/components/pages";
import { Clock } from "lucide-react";
import type { Deal } from "@/lib/types/entities";

type DealsPageClientProps = {
  deals: Deal[];
};

function daysUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export default function DealsPageClient({ deals }: DealsPageClientProps) {
  const t = useTranslations("deals");
  const [selectedStore, setSelectedStore] = useState("");
  const [sortBy, setSortBy] = useState("discount");

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

  const filtered = useMemo(() => {
    return [...deals]
      .filter((deal) => !selectedStore || deal.store?.name === selectedStore)
      .sort((a, b) => {
        if (sortBy === "price_low") return a.price - b.price;
        if (sortBy === "price_high") return b.price - a.price;
        if (sortBy === "ending_soon") {
          return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
        }
        return b.discount - a.discount;
      });
  }, [deals, selectedStore, sortBy]);

  return (
    <PageLayout>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <PageFilterBar>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label={t("filterByStore")}
              options={storeOptions}
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            />
            <Select
              label={t("sortBy")}
              options={sortOptions}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            />
            <div className="flex items-end">
              <Button className="w-full">{t("filter")}</Button>
            </div>
          </div>
      </PageFilterBar>

        {filtered.length === 0 ? (
          <PageEmptyState
            title="No deals found"
            description="Try adjusting your filters or check back later for new deals."
          />
        ) : (
          <div className="listing-products-grid">
            {filtered.map((deal) => (
              <div key={deal.id} className="relative">
                {deal.isFeatured && (
                  <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-purple-600 to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t("featured")}
                  </div>
                )}
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
                  <Clock size={14} />
                  {t("dealEndsIn")} {daysUntil(deal.endsAt)}
                </p>
              </div>
            ))}
          </div>
        )}
    </PageLayout>
  );
}
