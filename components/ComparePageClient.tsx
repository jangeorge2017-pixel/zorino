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
    { id: "all", label: "All Products" },
    { id: "savings", label: "Best Savings" },
    { id: "lowest", label: "Lowest Prices" },
    { id: "multi_store", label: "Most Stores" },
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
          subtitle="Compare prices across Amazon, AliExpress, eBay, Walmart and more"
          productCount={stats.productCount}
          storeCount={stats.storeCount}
          avgSavings={stats.avgSavings}
          bestDeal={stats.bestDeal}
        />

        <div className="zor-compare-page__toolbar">
          <div className="zor-compare-page__quick-filters" role="tablist" aria-label="Quick compare filters">
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
                  { value: "savings", label: "Highest Savings" },
                  { value: "lowest", label: "Lowest Price" },
                  { value: "stores", label: "Most Stores" },
                ]}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              />
              <div className="zor-compare-page__filter-action">
                <Link href="/products" className="w-full block">
                  <Button variant="outline" className="w-full">Browse Products</Button>
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
              <>
                <strong>{stats.productCount}</strong> products ready to compare
              </>
            ) : (
              <>
                Showing <strong>{filtered.length}</strong>{" "}
                {filtered.length === 1 ? "comparison" : "comparisons"}
              </>
            )}
          </p>
        </div>

        {products.length === 0 ? (
          <PageEmptyState
            title={t("noProductsToCompare")}
            description="Browse products and add them to compare prices across stores."
            actionLabel="Browse Products"
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
          title="Never overpay again"
          description="Track prices, unlock coupons, and shop trusted stores — all from one Zorino workflow."
        >
          <Link href="/coupons"><Button>View Coupons</Button></Link>
          <Link href="/stores"><Button variant="outline">Explore Stores</Button></Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
