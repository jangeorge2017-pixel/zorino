"use client";

import { useTranslations } from "next-intl";
import { Compass, Grid3x3, Home, TrendingUp } from "lucide-react";
import CategoriesCategoryCard from "@/components/categories/CategoriesCategoryCard";
import type { CategorySectionId } from "@/components/categories/category-sections";
import type { Category } from "@/lib/types/entities";

const SECTION_ICONS: Record<CategorySectionId, typeof TrendingUp> = {
  trending: TrendingUp,
  tech: Grid3x3,
  lifestyle: Home,
  explore: Compass,
};

const SECTION_KEYS: Record<CategorySectionId, { title: string; subtitle: string }> = {
  trending: { title: "sectionTrendingTitle", subtitle: "sectionTrendingSubtitle" },
  tech: { title: "sectionTechTitle", subtitle: "sectionTechSubtitle" },
  lifestyle: { title: "sectionLifestyleTitle", subtitle: "sectionLifestyleSubtitle" },
  explore: { title: "sectionExploreTitle", subtitle: "sectionExploreSubtitle" },
};

type CategoriesPageSectionProps = {
  sectionId: CategorySectionId;
  categories: Category[];
  viewLabel: string;
  viewMode?: "grid" | "list";
};

export default function CategoriesPageSection({
  sectionId,
  categories,
  viewLabel,
  viewMode = "grid",
}: CategoriesPageSectionProps) {
  const t = useTranslations("categories");
  const keys = SECTION_KEYS[sectionId];
  const Icon = SECTION_ICONS[sectionId];

  return (
    <section
      className={`zor-categories-page__section zor-categories-page__section--${sectionId}`}
      aria-labelledby={`categories-section-${sectionId}`}
    >
      <header className="zor-categories-page__section-head">
        <div className="zor-categories-page__section-title-wrap">
          <span className="zor-categories-page__section-icon" aria-hidden>
            <Icon size={18} />
          </span>
          <div>
            <h2
              id={`categories-section-${sectionId}`}
              className="zor-categories-page__section-title"
            >
              {t(keys.title)}
            </h2>
            <p className="zor-categories-page__section-subtitle">{t(keys.subtitle)}</p>
          </div>
        </div>
        <span className="zor-categories-page__section-count">
          {t("sectionCount", { count: categories.length })}
        </span>
      </header>

      <div
        className={
          viewMode === "grid"
            ? "zor-categories-page__grid zor-categories-page__section-grid"
            : "zor-categories-page__list zor-categories-page__section-grid"
        }
      >
        {categories.map((category) => (
          <CategoriesCategoryCard
            key={category.id}
            category={category}
            viewLabel={viewLabel}
            variant={viewMode}
          />
        ))}
      </div>
    </section>
  );
}
