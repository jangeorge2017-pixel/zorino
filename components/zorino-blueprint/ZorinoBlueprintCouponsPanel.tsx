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
    <article className="zb-coupon">
      <div className="zb-coupon-logo">
        <img
          src={coupon.storeLogoSrc}
          alt=""
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            if (target.parentElement) {
              target.parentElement.textContent = coupon.storeInitial;
            }
          }}
        />
      </div>
      <div>
        <h3 className="zb-coupon-store">{coupon.store}</h3>
        <p className="zb-coupon-offer">{coupon.offer}</p>
        <p className="zb-coupon-min">{coupon.minSpend}</p>
      </div>
      <div className="zb-coupon-code-wrap">
        <div className="zb-coupon-code-box">
          <span className="zb-coupon-code">{coupon.code}</span>
          <button
            type="button"
            className="zb-coupon-copy"
            onClick={copyCode}
            aria-label={`Copy ${coupon.code}`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div className="zb-coupon-meta">
          <span>
            <Users size={12} aria-hidden />
            Used {formatCompactCount(coupon.usedTimes)} times
          </span>
          {coupon.verified ? (
            <span className="zb-coupon-verified">
              <CheckCircle size={12} aria-hidden /> Verified
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

type Props = {
  coupons: TopCouponCard[];
};

export default function ZorinoBlueprintCouponsPanel({ coupons }: Props) {
  if (coupons.length === 0) return null;

  return (
    <section className="zb-panel" aria-labelledby="zb-coupons-title">
      <div className="zb-section-head">
        <h2 id="zb-coupons-title" className="zb-section-title">
          <span aria-hidden>🔥</span> Top Coupons
        </h2>
        <Link href="/coupons" className="zb-section-link">
          View all coupons →
        </Link>
      </div>
      <div className="zb-coupons">
        {coupons.map((coupon) => (
          <CouponRow key={coupon.id} coupon={coupon} />
        ))}
      </div>
    </section>
  );
}
