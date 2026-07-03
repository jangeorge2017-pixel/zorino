"use client";

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
  return (
    <section className="zor-compare-page__hero" aria-labelledby="compare-page-title">
      <div className="zor-compare-page__hero-glow" aria-hidden />

      <div className="zor-compare-page__hero-inner">
        <div className="zor-compare-page__hero-copy">
          <p className="zor-compare-page__eyebrow">
            <Scale size={14} aria-hidden />
            Price intelligence
          </p>
          <h1 id="compare-page-title" className="zor-compare-page__title">
            {title}
          </h1>
          <p className="zor-compare-page__subtitle">{subtitle}</p>
        </div>

        <div className="zor-compare-page__stats" aria-label="Compare overview">
          <div className="zor-compare-page__stat">
            <span className="zor-compare-page__stat-icon" aria-hidden>
              <BarChart3 size={15} />
            </span>
            <div>
              <strong>{productCount}</strong>
              <span>Products</span>
            </div>
          </div>
          <div className="zor-compare-page__stat zor-compare-page__stat--hot">
            <span className="zor-compare-page__stat-icon" aria-hidden>
              <Scale size={15} />
            </span>
            <div>
              <strong>{storeCount}</strong>
              <span>Store offers</span>
            </div>
          </div>
          <div className="zor-compare-page__stat">
            <span className="zor-compare-page__stat-icon" aria-hidden>
              <TrendingUp size={15} />
            </span>
            <div>
              <strong>{avgSavings}%</strong>
              <span>Avg. savings</span>
            </div>
          </div>
          <div className="zor-compare-page__stat">
            <span className="zor-compare-page__stat-icon" aria-hidden>
              <DollarSign size={15} />
            </span>
            <div>
              <strong>Up to ${bestDeal}</strong>
              <span>Best deal</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
