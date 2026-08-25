"use client";

import { useState } from "react";
import { Copy, Check, CheckCircle, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import AssetImage from "@/components/AssetImage";
import ReferenceSectionHeader from "@/components/ReferenceSectionHeader";
import { HOME_SECTIONS } from "@/lib/homepage/sections";
import type { TopCouponCard } from "@/lib/types/entities";

type CouponSectionProps = {
  coupons: TopCouponCard[];
};

export default function CouponSection({ coupons }: CouponSectionProps) {
  const t = useTranslations("home");
  const tCoupons = useTranslations("coupons");
  const [copiedId, setCopiedId] = useState<number | string | null>(null);

  const handleCopy = (id: number | string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (coupons.length === 0) {
    return null;
  }

  return (
    <section
      id={HOME_SECTIONS["top-coupons"].sectionId}
      className="home-section-shell home-section-shell--top-coupons coupon-section ref-panel"
    >
      <ReferenceSectionHeader
        headingId="top-coupons-heading"
        title={t("topCoupons")}
        linkHref="/coupons"
        linkLabel={tCoupons("viewAllCoupons")}
      />

      <div className="coupons-list">
        {coupons.map((coupon) => (
          <article key={coupon.id} className="coupon-card">
            <div className="coupon-store-logo">
              <AssetImage
                src={coupon.storeLogoSrc}
                alt=""
                width={42}
                height={42}
                className="coupon-store-logo-img"
                fallback={<span className="coupon-store-initial">{coupon.storeInitial}</span>}
              />
            </div>

            <div className="coupon-info">
              <h3>{coupon.store}</h3>
              <p className="coupon-offer">{coupon.offer}</p>
              <p className="coupon-min">{coupon.minSpend}</p>
            </div>

            <div className="coupon-actions">
              <div className="coupon-code-box">
                <span className="coupon-code">{coupon.code}</span>
                <button
                  type="button"
                  className="coupon-copy-btn"
                  onClick={() => handleCopy(coupon.id, coupon.code)}
                  aria-label={`${t("copyCoupon")} ${coupon.code}`}
                >
                  {copiedId === coupon.id ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <div className="coupon-meta">
                <span className="coupon-users-used">
                  <Users size={12} />
                  {t("usedTimes", { count: coupon.usedTimes })}
                </span>
                {coupon.verified ? (
                  <span className="coupon-verified">
                    <CheckCircle size={13} />
                    {t("verified")}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
