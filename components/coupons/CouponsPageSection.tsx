"use client";

import { useTranslations } from "next-intl";
import { BadgePercent, CheckCircle, Sparkles, Store } from "lucide-react";
import CouponsCouponCard from "@/components/coupons/CouponsCouponCard";
import type { CouponSectionId } from "@/components/coupons/coupon-sections";
import type { TopCouponCard } from "@/lib/types/entities";

const SECTION_ICONS: Record<CouponSectionId, typeof CheckCircle> = {
  verified: CheckCircle,
  popular: BadgePercent,
  top_stores: Store,
  fresh: Sparkles,
};

const SECTION_KEYS: Record<CouponSectionId, { title: string; subtitle: string }> = {
  verified: { title: "sectionVerifiedTitle", subtitle: "sectionVerifiedSubtitle" },
  popular: { title: "sectionPopularTitle", subtitle: "sectionPopularSubtitle" },
  top_stores: { title: "sectionTopStoresTitle", subtitle: "sectionTopStoresSubtitle" },
  fresh: { title: "sectionFreshTitle", subtitle: "sectionFreshSubtitle" },
};

type CouponsPageSectionProps = {
  sectionId: CouponSectionId;
  coupons: TopCouponCard[];
  copyLabel: string;
  copiedLabel: string;
  useLabel: string;
  copiedCode: string | null;
  onCopy: (code: string) => void;
};

export default function CouponsPageSection({
  sectionId,
  coupons,
  copyLabel,
  copiedLabel,
  useLabel,
  copiedCode,
  onCopy,
}: CouponsPageSectionProps) {
  const t = useTranslations("coupons");
  const keys = SECTION_KEYS[sectionId];
  const Icon = SECTION_ICONS[sectionId];

  return (
    <section
      className={`zor-coupons-page__section zor-coupons-page__section--${sectionId}`}
      aria-labelledby={`coupons-section-${sectionId}`}
    >
      <header className="zor-coupons-page__section-head">
        <div className="zor-coupons-page__section-title-wrap">
          <span className="zor-coupons-page__section-icon" aria-hidden>
            <Icon size={18} />
          </span>
          <div>
            <h2 id={`coupons-section-${sectionId}`} className="zor-coupons-page__section-title">
              {t(keys.title)}
            </h2>
            <p className="zor-coupons-page__section-subtitle">{t(keys.subtitle)}</p>
          </div>
        </div>
        <span className="zor-coupons-page__section-count">
          {t("sectionCount", { count: coupons.length })}
        </span>
      </header>

      <div className="zor-coupons-page__grid zor-coupons-page__section-grid">
        {coupons.map((coupon) => (
          <CouponsCouponCard
            key={`${sectionId}-${coupon.id}`}
            coupon={coupon}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
            useLabel={useLabel}
            isCopied={copiedCode === coupon.code}
            onCopy={onCopy}
          />
        ))}
      </div>
    </section>
  );
}
