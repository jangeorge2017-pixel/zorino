"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import AssetImage from "@/components/AssetImage";
import { Clock, Star, ExternalLink } from "lucide-react";
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
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t("title")}</h1>
          <p className="text-gray-400">{t("subtitle")}</p>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 mb-8">
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
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-400">No deals available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((deal) => (
              <Card key={deal.id} hover className="overflow-hidden">
                {deal.isFeatured && (
                  <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white text-xs font-bold px-3 py-1 inline-block">
                    {t("featured")}
                  </div>
                )}

                <div className="deal-image py-6 flex justify-center">
                  <AssetImage
                    src={deal.product?.imageUrl ?? ""}
                    alt=""
                    width={96}
                    height={96}
                    className="deal-product-img"
                    fallback={<span className="deal-emoji text-5xl">{deal.product?.emoji ?? "🛍️"}</span>}
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white line-clamp-2">
                    {deal.product?.name ?? deal.title}
                  </h3>

                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span>{deal.product?.rating ?? 4.5}</span>
                    <span>({deal.product?.reviewCount ?? 0} {t("reviews")})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">${deal.price}</span>
                    <span className="text-gray-500 line-through">${deal.originalPrice}</span>
                    <span className="bg-green-500/20 text-green-400 text-sm font-bold px-2 py-1 rounded">
                      -{Math.round(deal.discount)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>
                      {t("dealEndsIn")} {daysUntil(deal.endsAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>{deal.store?.name ?? "Store"}</span>
                    <ExternalLink className="w-4 h-4" />
                  </div>

                  <Button className="w-full">{t("viewDetails")}</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
