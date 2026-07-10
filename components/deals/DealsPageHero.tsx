"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("deals");
  const tCommon = useTranslations("common");

  return (
    <section className="zor-deals-page__hero" aria-labelledby="deals-page-title">
      <div className="zor-deals-page__hero-glow" aria-hidden />

      <div className="zor-deals-page__hero-inner">
        <div className="zor-deals-page__hero-copy">
          <p className="zor-deals-page__eyebrow">
            <Flame size={14} aria-hidden />
            {t("eyebrow")}
          </p>
          <h1 id="deals-page-title" className="zor-deals-page__title">
            {title}
          </h1>
          <p className="zor-deals-page__subtitle">{subtitle}</p>
        </div>

        <div className="zor-deals-page__stats" aria-label={t("overviewAria")}>
          <div className="zor-deals-page__stat">
            <span className="zor-deals-page__stat-icon" aria-hidden>
              <Sparkles size={15} />
            </span>
            <div>
              <strong>{liveCount}</strong>
              <span>{t("activeDeals")}</span>
            </div>
          </div>
          <div className="zor-deals-page__stat zor-deals-page__stat--hot">
            <span className="zor-deals-page__stat-icon" aria-hidden>
              <Percent size={15} />
            </span>
            <div>
              <strong>{t("upToPercent", { percent: maxDiscount })}</strong>
              <span>{t("topSavings")}</span>
            </div>
          </div>
          <div className="zor-deals-page__stat">
            <span className="zor-deals-page__stat-icon" aria-hidden>
              <Flame size={15} />
            </span>
            <div>
              <strong>{featuredCount}</strong>
              <span>{tCommon("featured")}</span>
            </div>
          </div>
          <div className="zor-deals-page__stat">
            <span className="zor-deals-page__stat-icon" aria-hidden>
              <Timer size={15} />
            </span>
            <div>
              <strong>{endingSoonCount}</strong>
              <span>{t("endingSoon")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
