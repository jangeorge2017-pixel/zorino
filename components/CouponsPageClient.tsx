"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import CouponsPageHero from "@/components/coupons/CouponsPageHero";
import CouponsPageSection from "@/components/coupons/CouponsPageSection";
import CouponsCouponCard from "@/components/coupons/CouponsCouponCard";
import { buildCouponSections } from "@/components/coupons/coupon-sections";
import PageIdentityCta from "@/components/page-identity/PageIdentityCta";
import { PageEmptyState, PageFilterBar, PageLayout } from "@/components/pages";
import type { TopCouponCard } from "@/lib/types/entities";
import "@/components/coupons/coupons-page.css";

type CouponsPageClientProps = {
  coupons: TopCouponCard[];
};

type QuickFilter = "all" | "verified" | "popular" | "big_offers";

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "all", label: "All Codes" },
  { id: "verified", label: "Verified" },
  { id: "popular", label: "Most Popular" },
  { id: "big_offers", label: "Big Offers" },
];

export default function CouponsPageClient({ coupons }: CouponsPageClientProps) {
  const t = useTranslations("coupons");
  const tCommon = useTranslations("common");
  const [selectedStore, setSelectedStore] = useState("");
  const [sortBy, setSortBy] = useState("popular");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
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

  const stats = useMemo(() => {
    const verifiedCount = coupons.filter((coupon) => coupon.verified).length;
    const storeCount = new Set(coupons.map((coupon) => coupon.store)).size;
    const totalUses = coupons.reduce((sum, coupon) => sum + coupon.usedTimes, 0);
    return { couponCount: coupons.length, verifiedCount, storeCount, totalUses };
  }, [coupons]);

  const sections = useMemo(() => buildCouponSections(coupons), [coupons]);

  const filtered = useMemo(() => {
    return [...coupons]
      .filter((coupon) => !selectedStore || coupon.store === selectedStore)
      .filter((coupon) => {
        if (quickFilter === "verified") return coupon.verified;
        if (quickFilter === "popular") return coupon.usedTimes >= 1000;
        if (quickFilter === "big_offers") return /%|\$|off/i.test(coupon.offer);
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "store") return a.store.localeCompare(b.store);
        if (sortBy === "code") return a.code.localeCompare(b.code);
        return b.usedTimes - a.usedTimes;
      });
  }, [coupons, selectedStore, sortBy, quickFilter]);

  const showCuratedSections =
    quickFilter === "all" && !selectedStore && sortBy === "popular";

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <PageLayout>
      <div className="zor-coupons-page">
        <CouponsPageHero
          title={t("title")}
          subtitle={t("subtitle")}
          couponCount={stats.couponCount}
          verifiedCount={stats.verifiedCount}
          storeCount={stats.storeCount}
          totalUses={stats.totalUses}
        />

        <div className="zor-coupons-page__toolbar">
          <div className="zor-coupons-page__quick-filters" role="tablist" aria-label="Quick coupon filters">
            {QUICK_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={quickFilter === item.id}
                className={`zor-coupons-page__quick-filter${quickFilter === item.id ? " is-active" : ""}`}
                onClick={() => setQuickFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <PageFilterBar className="zor-coupons-page__filters">
            <div className="zor-coupons-page__filter-grid">
              <Select
                label="Filter by Store"
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
              <div className="zor-coupons-page__filter-action">
                <Button className="w-full">{tCommon("filter")}</Button>
              </div>
            </div>
          </PageFilterBar>
        </div>

        <div className="zor-coupons-page__results-bar">
          <p className="zor-coupons-page__results-count">
            {showCuratedSections ? (
              <>
                <strong>{stats.couponCount}</strong> verified coupon codes
              </>
            ) : (
              <>
                Showing <strong>{filtered.length}</strong>{" "}
                {filtered.length === 1 ? "code" : "codes"}
              </>
            )}
          </p>
        </div>

        {showCuratedSections ? (
          <div className="zor-coupons-page__sections">
            {sections.map((section) => (
              <CouponsPageSection
                key={section.id}
                sectionId={section.id}
                coupons={section.coupons}
                copyLabel={t("copyCode")}
                copiedLabel={t("codeCopied")}
                useLabel={t("useCoupon")}
                copiedCode={copiedCode}
                onCopy={copyToClipboard}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PageEmptyState
            title="No coupons available yet"
            description="Try adjusting your filters or check back later for new codes."
          />
        ) : (
          <div className="zor-coupons-page__grid">
            {filtered.map((coupon) => (
              <CouponsCouponCard
                key={coupon.id}
                coupon={coupon}
                copyLabel={t("copyCode")}
                copiedLabel={t("codeCopied")}
                useLabel={t("useCoupon")}
                isCopied={copiedCode === coupon.code}
                onCopy={copyToClipboard}
              />
            ))}
          </div>
        )}

        <PageIdentityCta
          block="zor-coupons-page"
          title="Stack coupons with deals"
          description="Combine verified codes with live deals and price comparisons to maximize every purchase."
        >
          <Link href="/deals"><Button>Browse Deals</Button></Link>
          <Link href="/compare"><Button variant="outline">Compare Prices</Button></Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
