"use client";

import { Flame, Percent, Sparkles, Timer } from "lucide-react";

type DealsPageHeroProps = {
  title: string;
  subtitle: string;
  liveCount: number;
  maxDiscount: number;
  featuredCount: number;
  endingSoonCount: number;
};

export default function DealsPageHero({
  title,
  subtitle,
  liveCount,
  maxDiscount,
  featuredCount,
  endingSoonCount,
}: DealsPageHeroProps) {
  return (
    <section className="zor-deals-page__hero" aria-labelledby="deals-page-title">
      <div className="zor-deals-page__hero-glow" aria-hidden />

      <div className="zor-deals-page__hero-content">
        <div className="zor-deals-page__hero-copy">
          <p className="zor-deals-page__eyebrow">
            <Flame size={15} aria-hidden />
            Live promotions
          </p>
          <h1 id="deals-page-title" className="zor-deals-page__title">
            {title}
          </h1>
          <p className="zor-deals-page__subtitle">{subtitle}</p>
        </div>

        <div className="zor-deals-page__stats" aria-label="Deals overview">
          <div className="zor-deals-page__stat">
            <span className="zor-deals-page__stat-icon" aria-hidden>
              <Sparkles size={16} />
            </span>
            <div>
              <strong>{liveCount}</strong>
              <span>Live deals</span>
            </div>
          </div>
          <div className="zor-deals-page__stat zor-deals-page__stat--hot">
            <span className="zor-deals-page__stat-icon" aria-hidden>
              <Percent size={16} />
            </span>
            <div>
              <strong>Up to {maxDiscount}%</strong>
              <span>Biggest savings</span>
            </div>
          </div>
          <div className="zor-deals-page__stat">
            <span className="zor-deals-page__stat-icon" aria-hidden>
              <Flame size={16} />
            </span>
            <div>
              <strong>{featuredCount}</strong>
              <span>Featured picks</span>
            </div>
          </div>
          <div className="zor-deals-page__stat">
            <span className="zor-deals-page__stat-icon" aria-hidden>
              <Timer size={16} />
            </span>
            <div>
              <strong>{endingSoonCount}</strong>
              <span>Ending soon</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
