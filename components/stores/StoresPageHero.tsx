"use client";

import { Globe, ShoppingBag, Star, Store } from "lucide-react";

type StoresPageHeroProps = {
  title: string;
  subtitle: string;
  storeCount: number;
  partnerCount: number;
  regionCount: number;
  topCommission: number;
};

export default function StoresPageHero({
  title,
  subtitle,
  storeCount,
  partnerCount,
  regionCount,
  topCommission,
}: StoresPageHeroProps) {
  return (
    <section className="zor-stores-page__hero" aria-labelledby="stores-page-title">
      <div className="zor-stores-page__hero-glow" aria-hidden />

      <div className="zor-stores-page__hero-inner">
        <div className="zor-stores-page__hero-copy">
          <p className="zor-stores-page__eyebrow">
            <Store size={14} aria-hidden />
            Trusted marketplaces
          </p>
          <h1 id="stores-page-title" className="zor-stores-page__title">
            {title}
          </h1>
          <p className="zor-stores-page__subtitle">{subtitle}</p>
        </div>

        <div className="zor-stores-page__stats" aria-label="Stores overview">
          <div className="zor-stores-page__stat">
            <span className="zor-stores-page__stat-icon" aria-hidden>
              <ShoppingBag size={15} />
            </span>
            <div>
              <strong>{storeCount}</strong>
              <span>Active stores</span>
            </div>
          </div>
          <div className="zor-stores-page__stat zor-stores-page__stat--hot">
            <span className="zor-stores-page__stat-icon" aria-hidden>
              <Star size={15} />
            </span>
            <div>
              <strong>{partnerCount}</strong>
              <span>Partner stores</span>
            </div>
          </div>
          <div className="zor-stores-page__stat">
            <span className="zor-stores-page__stat-icon" aria-hidden>
              <Globe size={15} />
            </span>
            <div>
              <strong>{regionCount}</strong>
              <span>Regions covered</span>
            </div>
          </div>
          <div className="zor-stores-page__stat">
            <span className="zor-stores-page__stat-icon" aria-hidden>
              <Store size={15} />
            </span>
            <div>
              <strong>Up to {topCommission}%</strong>
              <span>Top commission</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
