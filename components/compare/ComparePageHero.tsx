"use client";

import { useTranslations } from "next-intl";
import { BarChart3, DollarSign, Scale, TrendingUp } from "lucide-react";

type ComparePageHeroProps = {
  title: string;
  subtitle: string;
  productCount: number;
  storeCount: number;
  avgSavings: number;
  bestDeal: number;
};

export default function ComparePageHero({
  title,
  subtitle,
  productCount,
  storeCount,
  avgSavings,
  bestDeal,
}: ComparePageHeroProps) {
  const t = useTranslations("compare");

  return (
    <section className="zor-compare-page__hero" aria-labelledby="compare-page-title">
      <div className="zor-compare-page__hero-glow" aria-hidden />

      <div className="zor-compare-page__hero-inner">
        <div className="zor-compare-page__hero-copy">
          <p className="zor-compare-page__eyebrow">
            <Scale size={14} aria-hidden />
            {t("heroEyebrow")}
          </p>
          <h1 id="compare-page-title" className="zor-compare-page__title">
            {title}
          </h1>
          <p className="zor-compare-page__subtitle">{subtitle}</p>
        </div>

        <div className="zor-compare-page__stats" aria-label={t("title")}>
          <div className="zor-compare-page__stat">
            <span className="zor-compare-page__stat-icon" aria-hidden>
              <BarChart3 size={15} />
            </span>
            <div>
              <strong>{productCount}</strong>
              <span>{t("statProducts")}</span>
            </div>
          </div>
          <div className="zor-compare-page__stat zor-compare-page__stat--hot">
            <span className="zor-compare-page__stat-icon" aria-hidden>
              <Scale size={15} />
            </span>
            <div>
              <strong>{storeCount}</strong>
              <span>{t("statStoreOffers")}</span>
            </div>
          </div>
          <div className="zor-compare-page__stat">
            <span className="zor-compare-page__stat-icon" aria-hidden>
              <TrendingUp size={15} />
            </span>
            <div>
              <strong>{avgSavings}%</strong>
              <span>{t("statAvgSavings")}</span>
            </div>
          </div>
          <div className="zor-compare-page__stat">
            <span className="zor-compare-page__stat-icon" aria-hidden>
              <DollarSign size={15} />
            </span>
            <div>
              <strong>{t("upToAmount", { amount: `$${bestDeal}` })}</strong>
              <span>{t("statBestDeal")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

