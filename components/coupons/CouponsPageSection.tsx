"use client";

import { BadgePercent, CheckCircle, Sparkles, Store } from "lucide-react";
import CouponsCouponCard from "@/components/coupons/CouponsCouponCard";
import type { CouponSectionId } from "@/components/coupons/coupon-sections";
import type { TopCouponCard } from "@/lib/types/entities";

const SECTION_META: Record<
  CouponSectionId,
  { title: string; subtitle: string; icon: typeof CheckCircle }
> = {
  verified: {
    title: "Verified Codes",
    subtitle: "Trusted coupon codes checked by the Zorino team",
    icon: CheckCircle,
  },
  popular: {
    title: "Most Popular",
    subtitle: "Codes shoppers are using most right now",
    icon: BadgePercent,
  },
  top_stores: {
    title: "Top Store Offers",
    subtitle: "Best savings from your favorite retailers",
    icon: Store,
  },
  fresh: {
    title: "Fresh Codes",
    subtitle: "Recently added discounts ready to redeem",
    icon: Sparkles,
  },
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
  const meta = SECTION_META[sectionId];
  const Icon = meta.icon;

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
              {meta.title}
            </h2>
            <p className="zor-coupons-page__section-subtitle">{meta.subtitle}</p>
          </div>
        </div>
        <span className="zor-coupons-page__section-count">{coupons.length} codes</span>
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
