"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, Copy, Check, CheckCircle, ChevronRight } from "lucide-react";
import { topCoupons } from "@/data/home";

export default function CouponSection() {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = (id: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="coupon-section">
      <div className="section-header">
        <h2 className="section-title">
          <Flame size={24} className="section-icon-fire" />
          Top Coupons
        </h2>
        <Link href="/coupons" className="section-link">
          View all coupons
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="coupons-list">
        {topCoupons.map((coupon) => (
          <article key={coupon.id} className="coupon-card">
            <div
              className="coupon-store-logo"
              style={{ background: coupon.storeColor }}
            >
              {coupon.storeInitial}
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
                  aria-label={`Copy ${coupon.code}`}
                >
                  {copiedId === coupon.id ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              </div>
              <div className="coupon-meta">
                <span>Used {coupon.usedTimes.toLocaleString()} times</span>
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
