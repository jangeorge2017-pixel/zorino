"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import CategoriesPageHero from "@/components/categories/CategoriesPageHero";
import CategoriesPageSection from "@/components/categories/CategoriesPageSection";
import CategoriesCategoryCard from "@/components/categories/CategoriesCategoryCard";
import { buildCategorySections } from "@/components/categories/category-sections";
import PageIdentityCta from "@/components/page-identity/PageIdentityCta";
import { PageEmptyState, PageLayout } from "@/components/pages";
import { Link } from "@/i18n/navigation";
import { Grid3X3, List } from "lucide-react";
import type { Category } from "@/lib/types/entities";
import "@/components/categories/categories-page.css";

type CategoriesPageClientProps = {
  categories: Category[];
};

type QuickFilter = "all" | "popular" | "tech" | "lifestyle";

const TECH_SLUGS = new Set(["phones", "laptops", "gaming", "tvs", "wearables"]);
const LIFESTYLE_SLUGS = new Set(["home", "fashion"]);

export default function CategoriesPageClient({ categories }: CategoriesPageClientProps) {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const quickFilters: { id: QuickFilter; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "popular", label: tCommon("popular") },
    { id: "tech", label: t("filterTech") },
    { id: "lifestyle", label: t("filterLifestyle") },
  ];

  const stats = useMemo(() => {
    const active = categories.filter((category) => category.isActive);
    const productCount = active.reduce((sum, category) => sum + category.productCount, 0);
    const topCategory =
      [...active].sort((a, b) => b.productCount - a.productCount)[0]?.name ?? "—";
    return {
      categoryCount: active.length,
      productCount,
      topCategory,
      activeCount: active.length,
    };
  }, [categories]);

  const sections = useMemo(() => buildCategorySections(categories), [categories]);

  const filtered = useMemo(() => {
    return [...categories]
      .filter((category) => category.isActive)
      .filter((category) => {
        if (quickFilter === "popular") return category.productCount >= 5000;
        if (quickFilter === "tech") return TECH_SLUGS.has(category.slug);
        if (quickFilter === "lifestyle") return LIFESTYLE_SLUGS.has(category.slug);
        return true;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, quickFilter]);

  const showCuratedSections = quickFilter === "all";

  return (
    <PageLayout>
      <div className="zor-categories-page">
        <CategoriesPageHero
          title={t("title")}
          subtitle={t("subtitle")}
          categoryCount={stats.categoryCount}
          productCount={stats.productCount}
          topCategory={stats.topCategory}
          activeCount={stats.activeCount}
        />

        <div className="zor-categories-page__toolbar">
          <div
            className="zor-categories-page__quick-filters"
            role="tablist"
            aria-label={t("quickFiltersAria")}
          >
            {quickFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={quickFilter === item.id}
                className={`zor-categories-page__quick-filter${
                  quickFilter === item.id ? " is-active" : ""
                }`}
                onClick={() => setQuickFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="zor-categories-page__view-toggle">
            <Button
              variant={viewMode === "grid" ? "primary" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              aria-label={t("gridView")}
            >
              <Grid3X3 size={16} aria-hidden />
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              aria-label={t("listView")}
            >
              <List size={16} aria-hidden />
            </Button>
          </div>
        </div>

        <div className="zor-categories-page__results-bar">
          <p className="zor-categories-page__results-count">
            {showCuratedSections ? (
              <>
                <strong>{stats.categoryCount}</strong> {t("resultsActiveLabel")}
              </>
            ) : (
              <>
                {t("resultsShowingPrefix")} <strong>{filtered.length}</strong>{" "}
                {filtered.length === 1 ? t("resultsCategoryOne") : t("resultsCategoryMany")}
              </>
            )}
          </p>
        </div>

        {showCuratedSections ? (
          <div className="zor-categories-page__sections">
            {sections.map((section) => (
              <CategoriesPageSection
                key={section.id}
                sectionId={section.id}
                categories={section.categories}
                viewLabel={tCommon("viewAll")}
                viewMode={viewMode}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PageEmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : viewMode === "grid" ? (
          <div className="zor-categories-page__grid">
            {filtered.map((category) => (
              <CategoriesCategoryCard
                key={category.id}
                category={category}
                viewLabel={tCommon("viewAll")}
              />
            ))}
          </div>
        ) : (
          <div className="zor-categories-page__list">
            {filtered.map((category) => (
              <CategoriesCategoryCard
                key={category.id}
                category={category}
                viewLabel={tCommon("viewAll")}
                variant="list"
              />
            ))}
          </div>
        )}
        <PageIdentityCta
          block="zor-categories-page"
          title={t("ctaTitle")}
          description={t("ctaDescription")}
        >
          <Link href="/deals">
            <Button>{t("ctaViewDeals")}</Button>
          </Link>
          <Link href="/search">
            <Button variant="outline">{t("ctaSearchProducts")}</Button>
          </Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
