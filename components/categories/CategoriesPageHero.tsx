"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");

  return (
    <section className="zor-categories-page__hero" aria-labelledby="categories-page-title">
      <div className="zor-categories-page__hero-glow" aria-hidden />

      <div className="zor-categories-page__hero-inner">
        <div className="zor-categories-page__hero-copy">
          <p className="zor-categories-page__eyebrow">
            <Grid3x3 size={14} aria-hidden />
            {t("eyebrow")}
          </p>
          <h1 id="categories-page-title" className="zor-categories-page__title">
            {title}
          </h1>
          <p className="zor-categories-page__subtitle">{subtitle}</p>
        </div>

        <div className="zor-categories-page__stats" aria-label={t("overviewAria")}>
          <div className="zor-categories-page__stat">
            <span className="zor-categories-page__stat-icon" aria-hidden>
              <Layers size={15} />
            </span>
            <div>
              <strong>{categoryCount}</strong>
              <span>{tCommon("categories")}</span>
            </div>
          </div>
          <div className="zor-categories-page__stat zor-categories-page__stat--hot">
            <span className="zor-categories-page__stat-icon" aria-hidden>
              <TrendingUp size={15} />
            </span>
            <div>
              <strong>{productCount.toLocaleString("en-US")}</strong>
              <span>{t("productsListed")}</span>
            </div>
          </div>
          <div className="zor-categories-page__stat">
            <span className="zor-categories-page__stat-icon" aria-hidden>
              <Sparkles size={15} />
            </span>
            <div>
              <strong>{topCategory}</strong>
              <span>{t("topCategory")}</span>
            </div>
          </div>
          <div className="zor-categories-page__stat">
            <span className="zor-categories-page__stat-icon" aria-hidden>
              <Grid3x3 size={15} />
            </span>
            <div>
              <strong>{activeCount}</strong>
              <span>{t("activeNow")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
