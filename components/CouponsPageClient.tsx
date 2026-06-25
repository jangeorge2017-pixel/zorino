"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import AssetImage from "@/components/AssetImage";
import { Copy, CheckCircle, ExternalLink } from "lucide-react";
import type { TopCouponCard } from "@/lib/types/entities";

type CouponsPageClientProps = {
  coupons: TopCouponCard[];
};

export default function CouponsPageClient({ coupons }: CouponsPageClientProps) {
  const t = useTranslations("coupons");
  const [selectedStore, setSelectedStore] = useState("");
  const [sortBy, setSortBy] = useState("popular");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const storeOptions = useMemo(() => {
    const names = [...new Set(coupons.map((c) => c.store))];
    return [{ value: "", label: "All Stores" }, ...names.map((n) => ({ value: n, label: n }))];
  }, [coupons]);

  const sortOptions = [
    { value: "popular", label: "Most Popular" },
    { value: "store", label: "Store Name" },
    { value: "code", label: "Code A-Z" },
  ];

  const filtered = useMemo(() => {
    return [...coupons]
      .filter((c) => !selectedStore || c.store === selectedStore)
      .sort((a, b) => {
        if (sortBy === "store") return a.store.localeCompare(b.store);
        if (sortBy === "code") return a.code.localeCompare(b.code);
        return b.usedTimes - a.usedTimes;
      });
  }, [coupons, selectedStore, sortBy]);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

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
              label="Filter by Store"
              options={storeOptions}
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            />
            <Select
              label="Sort By"
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
          <p className="text-gray-400">No coupons available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((coupon) => (
              <Card key={coupon.id} hover>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <AssetImage
                      src={coupon.storeLogoSrc}
                      alt=""
                      width={42}
                      height={42}
                      className="coupon-store-logo-img rounded-xl"
                      fallback={<span className="coupon-store-initial">{coupon.storeInitial}</span>}
                    />
                    <div>
                      <h3 className="text-lg font-semibold text-white">{coupon.store}</h3>
                      <p className="text-sm text-gray-400">{coupon.offer}</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300">{coupon.minSpend}</p>

                  <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                    <code className="text-lg font-mono text-purple-400">{coupon.code}</code>
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(coupon.code)}
                      className="flex items-center gap-2"
                    >
                      {copiedCode === coupon.code ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          {t("codeCopied")}
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          {t("copyCode")}
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="text-sm text-gray-400">
                    Used {coupon.usedTimes.toLocaleString("en-US")} times
                    {coupon.verified && (
                      <span className="ml-2 text-green-400 inline-flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>

                  <Button className="w-full flex items-center justify-center gap-2">
                    {t("useCoupon")}
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
