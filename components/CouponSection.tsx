"use client";

import { useState } from "react";
import { Copy, Check, CheckCircle, Clock, Users } from "lucide-react";
import AssetImage from "@/components/AssetImage";
import HomeSectionHeader from "@/components/HomeSectionHeader";
import { HOME_SECTIONS } from "@/lib/homepage/sections";
import { formatCompactCount } from "@/lib/homepage/format";
import type { TopCouponCard } from "@/lib/types/entities";

type CouponSectionProps = {
  coupons: TopCouponCard[];
};

export default function CouponSection({ coupons }: CouponSectionProps) {
  const [copiedId, setCopiedId] = useState<number | string | null>(null);

  const handleCopy = (id: number | string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (coupons.length === 0) {
    return null;
  }

  const verifiedCount = coupons.filter((coupon) => coupon.verified).length;
  const totalUses = coupons.reduce((sum, coupon) => sum + coupon.usedTimes, 0);

  return (
    <section
      id={HOME_SECTIONS["top-coupons"].sectionId}
      className="home-section-shell home-section-shell--top-coupons coupon-section"
    >
      <HomeSectionHeader
        variant="top-coupons"
        headingId="top-coupons-heading"
        title="Top Coupons"
        subtitle="Verified codes from trusted stores — copy and save instantly"
        link={{ href: "/coupons", label: "View all coupons" }}
        stats={[
          { value: String(verifiedCount), label: "Verified Codes" },
          { value: "94%", label: "Success Rate" },
          { value: formatCompactCount(totalUses), label: "Users Used" },
        ]}
        tags={["Verified Codes", "Expires Soon", "Copy Code"]}
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
              <p className="coupon-expires">
                <Clock size={12} />
                Expires soon
              </p>
            </div>

            <div className="coupon-actions">
              <div className="coupon-code-box">
                <span className="coupon-code">{coupon.code}</span>
                <button
                  type="button"
                  className="coupon-copy-btn"
                  onClick={() => handleCopy(coupon.id, coupon.code)}
                  aria-label={`Copy ${coupon.code}`}
                >
                  {copiedId === coupon.id ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <button
                type="button"
                className="coupon-copy-action"
                onClick={() => handleCopy(coupon.id, coupon.code)}
              >
                Copy Code
              </button>
              <div className="coupon-meta">
                <span className="coupon-users-used">
                  <Users size={12} />
                  Used {coupon.usedTimes.toLocaleString("en-US")} times
                </span>
                {coupon.verified && (
                  <span className="coupon-verified">
                    <CheckCircle size={13} />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
