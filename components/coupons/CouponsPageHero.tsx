"use client";

import { useTranslations } from "next-intl";
import { BadgePercent, CheckCircle, Sparkles, Ticket } from "lucide-react";

type CouponsPageHeroProps = {
  title: string;
  subtitle: string;
  couponCount: number;
  verifiedCount: number;
  storeCount: number;
  totalUses: number;
};

export default function CouponsPageHero({
  title,
  subtitle,
  couponCount,
  verifiedCount,
  storeCount,
  totalUses,
}: CouponsPageHeroProps) {
  const t = useTranslations("coupons");
  const tCommon = useTranslations("common");

  return (
    <section className="zor-coupons-page__hero" aria-labelledby="coupons-page-title">
      <div className="zor-coupons-page__hero-glow" aria-hidden />

      <div className="zor-coupons-page__hero-inner">
        <div className="zor-coupons-page__hero-copy">
          <p className="zor-coupons-page__eyebrow">
            <Ticket size={14} aria-hidden />
            {t("eyebrow")}
          </p>
          <h1 id="coupons-page-title" className="zor-coupons-page__title">
            {title}
          </h1>
          <p className="zor-coupons-page__subtitle">{subtitle}</p>
        </div>

        <div className="zor-coupons-page__stats" aria-label={t("overviewAria")}>
          <div className="zor-coupons-page__stat">
            <span className="zor-coupons-page__stat-icon" aria-hidden>
              <Ticket size={15} />
            </span>
            <div>
              <strong>{couponCount}</strong>
              <span>{t("liveCodes")}</span>
            </div>
          </div>
          <div className="zor-coupons-page__stat zor-coupons-page__stat--hot">
            <span className="zor-coupons-page__stat-icon" aria-hidden>
              <CheckCircle size={15} />
            </span>
            <div>
              <strong>{verifiedCount}</strong>
              <span>{tCommon("verified")}</span>
            </div>
          </div>
          <div className="zor-coupons-page__stat">
            <span className="zor-coupons-page__stat-icon" aria-hidden>
              <BadgePercent size={15} />
            </span>
            <div>
              <strong>{storeCount}</strong>
              <span>{tCommon("stores")}</span>
            </div>
          </div>
          <div className="zor-coupons-page__stat">
            <span className="zor-coupons-page__stat-icon" aria-hidden>
              <Sparkles size={15} />
            </span>
            <div>
              <strong>{totalUses.toLocaleString("en-US")}</strong>
              <span>{t("totalUses")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
