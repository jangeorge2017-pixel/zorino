"use client";

import AssetImage from "@/components/AssetImage";
import Button from "@/components/ui/Button";
import { CheckCircle, Copy, ExternalLink } from "lucide-react";
import type { TopCouponCard } from "@/lib/types/entities";

type CouponsCouponCardProps = {
  coupon: TopCouponCard;
  copyLabel: string;
  copiedLabel: string;
  useLabel: string;
  isCopied: boolean;
  onCopy: (code: string) => void;
};

export default function CouponsCouponCard({
  coupon,
  copyLabel,
  copiedLabel,
  useLabel,
  isCopied,
  onCopy,
}: CouponsCouponCardProps) {
  return (
    <article className="zor-coupons-page__card">
      <div className="zor-coupons-page__card-head">
        <div className="zor-coupons-page__card-logo">
          <AssetImage
            src={coupon.storeLogoSrc}
            alt=""
            width={42}
            height={42}
            className="zor-coupons-page__card-logo-img"
            fallback={<span className="zor-coupons-page__card-logo-fallback">{coupon.storeInitial}</span>}
          />
        </div>
        <div>
          <h3 className="zor-coupons-page__card-store">{coupon.store}</h3>
          <p className="zor-coupons-page__card-offer">{coupon.offer}</p>
        </div>
      </div>

      <p className="zor-coupons-page__card-min">{coupon.minSpend}</p>

      <div className="zor-coupons-page__card-code">
        <code>{coupon.code}</code>
        <Button size="sm" onClick={() => onCopy(coupon.code)} className="zor-coupons-page__card-copy">
          {isCopied ? (
            <>
              <CheckCircle size={14} aria-hidden />
              {copiedLabel}
            </>
          ) : (
            <>
              <Copy size={14} aria-hidden />
              {copyLabel}
            </>
          )}
        </Button>
      </div>

      <div className="zor-coupons-page__card-meta">
        <span>Used {coupon.usedTimes.toLocaleString("en-US")} times</span>
        {coupon.verified ? (
          <span className="zor-coupons-page__card-verified">
            <CheckCircle size={12} aria-hidden />
            Verified
          </span>
        ) : null}
      </div>

      <Button className="w-full zor-coupons-page__card-use">
        {useLabel}
        <ExternalLink size={14} aria-hidden />
      </Button>
    </article>
  );
}
