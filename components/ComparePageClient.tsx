"use client";

import { Link } from "@/i18n/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import ComparePageHero from "@/components/compare/ComparePageHero";
import ComparePageSection from "@/components/compare/ComparePageSection";
import CompareProductCard from "@/components/compare/CompareProductCard";
import { buildCompareSections } from "@/components/compare/compare-sections";
import PageIdentityCta from "@/components/page-identity/PageIdentityCta";
import { PageEmptyState, PageFilterBar, PageLayout } from "@/components/pages";
import type { CompareProductResult } from "@/services/compare";
import "@/components/compare/compare-page.css";

type ComparePageClientProps = {
  products: CompareProductResult[];
};

type QuickFilter = "all" | "savings" | "lowest" | "multi_store";

export default function ComparePageClient({ products }: ComparePageClientProps) {
  const t = useTranslations("compare");
  const tCommon = useTranslations("common");
  const [sortBy, setSortBy] = useState("savings");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
    { id: "all", label: t("quickAll") },
    { id: "savings", label: t("quickSavings") },
    { id: "lowest", label: t("quickLowest") },
    { id: "multi_store", label: t("quickMultiStore") },
  ];

  const stats = useMemo(() => {
    const storeCount = products.reduce((sum, item) => sum + item.providerCount, 0);
    const avgSavings =
      products.length > 0
        ? Math.round(
            products.reduce((sum, item) => sum + item.savingsPercent, 0) / products.length,
          )
        : 0;
    const bestDeal = products.reduce((max, item) => Math.max(max, item.savingsVsHighest), 0);
    return { productCount: products.length, storeCount, avgSavings, bestDeal };
  }, [products]);

  const sections = useMemo(() => buildCompareSections(products), [products]);

  const filtered = useMemo(() => {
    return [...products]
      .filter((item) => {
        if (quickFilter === "savings") return item.savingsPercent >= 5;
        if (quickFilter === "lowest") return item.lowestPrice <= 500;
        if (quickFilter === "multi_store") return item.providerCount >= 3;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "lowest") return a.lowestPrice - b.lowestPrice;
        if (sortBy === "stores") return b.providerCount - a.providerCount;
        return b.savingsPercent - a.savingsPercent || b.savingsVsHighest - a.savingsVsHighest;
      });
  }, [products, sortBy, quickFilter]);

  const showCuratedSections = quickFilter === "all" && sortBy === "savings";

  return (
    <PageLayout>
      <div className="zor-compare-page">
        <ComparePageHero
          title={t("title")}
          subtitle={t("subtitle")}
          productCount={stats.productCount}
          storeCount={stats.storeCount}
          avgSavings={stats.avgSavings}
          bestDeal={stats.bestDeal}
        />

        <div className="zor-compare-page__toolbar">
          <div className="zor-compare-page__quick-filters" role="tablist" aria-label={t("quickFiltersAria")}>
            {QUICK_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={quickFilter === item.id}
                className={`zor-compare-page__quick-filter${quickFilter === item.id ? " is-active" : ""}`}
                onClick={() => setQuickFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <PageFilterBar className="zor-compare-page__filters">
            <div className="zor-compare-page__filter-grid">
              <Select
                label={tCommon("sortBy")}
                options={[
                  { value: "savings", label: t("sortSavings") },
                  { value: "lowest", label: t("sortLowestPrice") },
                  { value: "stores", label: t("sortMostStores") },
                ]}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              />
              <div className="zor-compare-page__filter-action">
                <Link href="/products" className="w-full block">
                  <Button variant="outline" className="w-full">{t("browseProducts")}</Button>
                </Link>
              </div>
              <div className="zor-compare-page__filter-action">
                <Button className="w-full">{tCommon("filter")}</Button>
              </div>
            </div>
          </PageFilterBar>
        </div>

        <div className="zor-compare-page__results-bar">
          <p className="zor-compare-page__results-count">
            {showCuratedSections ? (
              <>{t("productsReadyToCompare", { count: stats.productCount })}</>
            ) : (
              <>{t("showingComparisons", { count: filtered.length })}</>
            )}
          </p>
        </div>

        {products.length === 0 ? (
          <PageEmptyState
            title={t("noProductsToCompare")}
            description={t("emptyDescription")}
            actionLabel={t("browseProducts")}
            onAction={() => {
              window.location.href = "/products";
            }}
          />
        ) : showCuratedSections ? (
          <div className="zor-compare-page__sections">
            {sections.map((section) => (
              <ComparePageSection key={section.id} sectionId={section.id} products={section.products} />
            ))}
          </div>
        ) : (
          <div className="zor-compare-page__stack">
            {filtered.map((item) => (
              <CompareProductCard key={item.product.id} item={item} />
            ))}
          </div>
        )}

        <PageIdentityCta
          block="zor-compare-page"
          title={t("ctaTitle")}
          description={t("ctaDescription")}
        >
          <Link href="/coupons"><Button>{t("viewCoupons")}</Button></Link>
          <Link href="/stores"><Button variant="outline">{t("exploreStores")}</Button></Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
