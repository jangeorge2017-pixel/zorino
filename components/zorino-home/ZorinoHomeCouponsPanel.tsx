"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CheckCircle, Copy, Users } from "lucide-react";
import { formatCompactCount } from "@/lib/homepage/format";
import type { TopCouponCard } from "@/lib/types/entities";

function CouponRow({ coupon }: { coupon: TopCouponCard }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="zh-coupon">
      <div className="zh-coupon__logo">
        <img
          src={coupon.storeLogoSrc}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none";
            if (e.currentTarget.parentElement) {
              e.currentTarget.parentElement.textContent = coupon.storeInitial;
            }
          }}
        />
      </div>
      <div>
        <h3 className="zh-coupon__store">{coupon.store}</h3>
        <p className="zh-coupon__offer">{coupon.offer}</p>
        <p className="zh-coupon__min">{coupon.minSpend}</p>
      </div>
      <div className="zh-coupon__code-wrap">
        <div className="zh-coupon__code-box">
          <span className="zh-coupon__code">{coupon.code}</span>
          <button
            type="button"
            className="zh-coupon__copy"
            onClick={copyCode}
            aria-label={`Copy ${coupon.code}`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div className="zh-coupon__meta">
          <span>
            <Users size={12} aria-hidden />
            Used {formatCompactCount(coupon.usedTimes)} times
          </span>
          {coupon.verified ? (
            <span className="zh-coupon__verified">
              <CheckCircle size={12} aria-hidden /> Verified
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

type ZorinoHomeCouponsPanelProps = {
  coupons: TopCouponCard[];
};

export default function ZorinoHomeCouponsPanel({ coupons }: ZorinoHomeCouponsPanelProps) {
  return (
    <section className="zh-panel" id="zh-section-coupons" aria-labelledby="zh-coupons-title">
      <div className="zh-section-head">
        <h2 id="zh-coupons-title" className="zh-section-head__title">
          <span aria-hidden>🔥</span> Top Coupons
        </h2>
        <Link href="/coupons" className="zh-section-head__link">
          View all coupons →
        </Link>
      </div>
      <div className="zh-coupons">
        {coupons.length === 0 ? (
          <p className="zh-panel__empty">No coupons available right now.</p>
        ) : (
          coupons.map((coupon) => <CouponRow key={coupon.id} coupon={coupon} />)
        )}
      </div>
    </section>
  );
}
