"use client";

import { Compass, Grid3x3, Home, TrendingUp } from "lucide-react";
import CategoriesCategoryCard from "@/components/categories/CategoriesCategoryCard";
import type { CategorySectionId } from "@/components/categories/category-sections";
import type { Category } from "@/lib/types/entities";

const SECTION_META: Record<
  CategorySectionId,
  { title: string; subtitle: string; icon: typeof TrendingUp }
> = {
  trending: {
    title: "Trending Categories",
    subtitle: "The most browsed departments on Zorino right now",
    icon: TrendingUp,
  },
  tech: {
    title: "Tech & Electronics",
    subtitle: "Phones, laptops, gaming, and smart devices",
    icon: Grid3x3,
  },
  lifestyle: {
    title: "Lifestyle & Home",
    subtitle: "Fashion, home essentials, and everyday favorites",
    icon: Home,
  },
  explore: {
    title: "Explore More",
    subtitle: "Discover additional departments and collections",
    icon: Compass,
  },
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
  const meta = SECTION_META[sectionId];
  const Icon = meta.icon;

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
              {meta.title}
            </h2>
            <p className="zor-categories-page__section-subtitle">{meta.subtitle}</p>
          </div>
        </div>
        <span className="zor-categories-page__section-count">
          {categories.length} categories
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
