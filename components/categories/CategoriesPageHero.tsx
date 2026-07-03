"use client";

import { Grid3x3, Layers, Sparkles, TrendingUp } from "lucide-react";

type CategoriesPageHeroProps = {
  title: string;
  subtitle: string;
  categoryCount: number;
  productCount: number;
  topCategory: string;
  activeCount: number;
};

export default function CategoriesPageHero({
  title,
  subtitle,
  categoryCount,
  productCount,
  topCategory,
  activeCount,
}: CategoriesPageHeroProps) {
  return (
    <section className="zor-categories-page__hero" aria-labelledby="categories-page-title">
      <div className="zor-categories-page__hero-glow" aria-hidden />

      <div className="zor-categories-page__hero-inner">
        <div className="zor-categories-page__hero-copy">
          <p className="zor-categories-page__eyebrow">
            <Grid3x3 size={14} aria-hidden />
            Product discovery
          </p>
          <h1 id="categories-page-title" className="zor-categories-page__title">
            {title}
          </h1>
          <p className="zor-categories-page__subtitle">{subtitle}</p>
        </div>

        <div className="zor-categories-page__stats" aria-label="Categories overview">
          <div className="zor-categories-page__stat">
            <span className="zor-categories-page__stat-icon" aria-hidden>
              <Layers size={15} />
            </span>
            <div>
              <strong>{categoryCount}</strong>
              <span>Categories</span>
            </div>
          </div>
          <div className="zor-categories-page__stat zor-categories-page__stat--hot">
            <span className="zor-categories-page__stat-icon" aria-hidden>
              <TrendingUp size={15} />
            </span>
            <div>
              <strong>{productCount.toLocaleString()}</strong>
              <span>Products listed</span>
            </div>
          </div>
          <div className="zor-categories-page__stat">
            <span className="zor-categories-page__stat-icon" aria-hidden>
              <Sparkles size={15} />
            </span>
            <div>
              <strong>{topCategory}</strong>
              <span>Top category</span>
            </div>
          </div>
          <div className="zor-categories-page__stat">
            <span className="zor-categories-page__stat-icon" aria-hidden>
              <Grid3x3 size={15} />
            </span>
            <div>
              <strong>{activeCount}</strong>
              <span>Active now</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
