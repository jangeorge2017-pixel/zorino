"use client";

import { Link } from "@/i18n/navigation";
import { ArrowRight, Scale, Sparkles, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ZorinoHomeCtaBand() {
  const t = useTranslations("home");

  return (
    <section className="zh-cta-band" aria-labelledby="zh-cta-band-title">
      <div className="zh-cta-band__glow" aria-hidden />
      <div className="zh-cta-band__inner">
        <div className="zh-cta-band__copy">
          <p className="zh-cta-band__eyebrow">
            <Sparkles size={14} aria-hidden />
            {t("ctaEyebrow")}
          </p>
          <h2 id="zh-cta-band-title" className="zh-cta-band__title">
            {t("ctaTitle")}
          </h2>
          <p className="zh-cta-band__text">{t("ctaText")}</p>
        </div>
        <div className="zh-cta-band__actions">
          <Link href="/deals" className="zh-cta-band__btn zh-cta-band__btn--primary">
            {t("ctaExploreDeals")}
            <ArrowRight size={16} aria-hidden />
          </Link>
          <Link href="/compare" className="zh-cta-band__btn zh-cta-band__btn--ghost">
            <Scale size={16} aria-hidden />
            {t("ctaComparePrices")}
          </Link>
          <Link href="/coupons" className="zh-cta-band__btn zh-cta-band__btn--ghost">
            <Ticket size={16} aria-hidden />
            {t("ctaGetCoupons")}
          </Link>
        </div>
      </div>
    </section>
  );
}
