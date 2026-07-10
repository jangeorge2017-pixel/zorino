"use client";

import type { ReactNode } from "react";
import type { HeroStatItem } from "@/lib/types/entities";
import { Package, Sparkles, Store, Tag, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import "./hero.css";
import "./hero-layout.css";

const STAT_ICONS = {
  stores: Store,
  products: Package,
  coupons: Tag,
  tracking: TrendingUp,
} as const;

type ZorinoHomeHeroProps = {
  stats: HeroStatItem[];
  /** Right-hand orbit artwork, streamed in via <Suspense> from the page. */
  artworkSlot: ReactNode;
};

export default function ZorinoHomeHero({
  stats,
  artworkSlot,
}: ZorinoHomeHeroProps) {
  const t = useTranslations("hero");

  return (
    <section className="zh-hero" aria-label="Hero">
      <div className="zh-hero__col zh-hero__col--left">
        <div className="zh-hero__copy">
          <div className="zh-hero__badge">
            <Sparkles size={13} aria-hidden />
            {t("badge")}
          </div>

          <h1 className="zh-hero__title">
            {t("titleLine1")}
            <br />
            <span>{t("titleLine2")}</span>
          </h1>

          <p className="zh-hero__subtitle">{t("subtitle")}</p>

          <div className="zh-hero__stats">
            {stats.map((stat) => {
              const Icon = STAT_ICONS[stat.key];
              return (
                <article key={stat.key} className={`zh-stat zh-stat--${stat.tone}`}>
                  <p className="zh-stat__value">{stat.value}</p>
                  <div className="zh-stat__meta">
                    <div className="zh-stat__icon">
                      <Icon size={18} aria-hidden />
                    </div>
                    <p className="zh-stat__label">{stat.label}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div className="zh-hero__col zh-hero__col--right">
        {artworkSlot}
      </div>
    </section>
  );
}
