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

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "all", label: "All Categories" },
  { id: "popular", label: "Popular" },
  { id: "tech", label: "Tech" },
  { id: "lifestyle", label: "Lifestyle" },
];

export default function CategoriesPageClient({ categories }: CategoriesPageClientProps) {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

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
            aria-label="Quick category filters"
          >
            {QUICK_FILTERS.map((item) => (
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
              aria-label="Grid view"
            >
              <Grid3X3 size={16} aria-hidden />
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <List size={16} aria-hidden />
            </Button>
          </div>
        </div>

        <div className="zor-categories-page__results-bar">
          <p className="zor-categories-page__results-count">
            {showCuratedSections ? (
              <>
                <strong>{stats.categoryCount}</strong> categories to explore
              </>
            ) : (
              <>
                Showing <strong>{filtered.length}</strong>{" "}
                {filtered.length === 1 ? "category" : "categories"}
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
          <PageEmptyState
            title="No categories available yet"
            description="Try a different filter or check back later for new departments."
          />
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
          title="Find the best price in every category"
          description="Jump from browsing to comparing prices and redeeming coupons without leaving Zorino."
        >
          <Link href="/deals"><Button>View Deals</Button></Link>
          <Link href="/search"><Button variant="outline">Search Products</Button></Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
