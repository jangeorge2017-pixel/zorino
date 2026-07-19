"use client";

import { useState } from "react";
import { Check, CheckCircle, Copy, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import ZorinoHomeViewAllLink from "@/components/zorino-home/ZorinoHomeViewAllLink";
import { formatCompactCount } from "@/lib/homepage/format";
import type { TopCouponCard } from "@/lib/types/entities";
import "./ZorinoHomeCouponsPanel.css";

/** Top Coupons only â€” official store marks from existing project assets. */
const TOP_COUPON_LOGOS: Record<string, string> = {
  amazon: "/stores/amazon.svg",
  noon: "/stores/noon.svg",
  aliexpress: "/stores/aliexpress.svg",
  nike: "/stores/nike.svg",
};

function resolveTopCouponLogoSrc(coupon: TopCouponCard): string {
  const id = String(coupon.id ?? "").toLowerCase();
  if (TOP_COUPON_LOGOS[id]) return TOP_COUPON_LOGOS[id];

  const fromPath = coupon.storeLogoSrc?.match(/\/stores\/(?:top-coupons\/)?([^/.]+)/i);
  if (fromPath?.[1] && TOP_COUPON_LOGOS[fromPath[1].toLowerCase()]) {
    return TOP_COUPON_LOGOS[fromPath[1].toLowerCase()];
  }

  const fromName = coupon.store?.toLowerCase().replace(/\s+/g, "") ?? "";
  if (fromName.includes("amazon")) return TOP_COUPON_LOGOS.amazon;
  if (fromName.includes("noon")) return TOP_COUPON_LOGOS.noon;
  if (fromName.includes("aliexpress")) return TOP_COUPON_LOGOS.aliexpress;
  if (fromName.includes("nike")) return TOP_COUPON_LOGOS.nike;

  return coupon.storeLogoSrc;
}

function CouponRow({ coupon }: { coupon: TopCouponCard }) {
  const t = useTranslations("home");
  const tCoupons = useTranslations("coupons");
  const [copied, setCopied] = useState(false);
  const logoSrc = resolveTopCouponLogoSrc(coupon);

  const copyCode = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="zh-coupon">
      <div className="zh-coupon__logo">
        <img
          src={logoSrc}
          alt={coupon.store}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            // Keep the square empty â€” do not swap in AM/NO letter placeholders.
            e.currentTarget.style.visibility = "hidden";
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
            aria-label={`${t("copyCode")} ${coupon.code}`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div className="zh-coupon__meta">
          <span>
            <Users size={12} aria-hidden />
            {t("usedTimes", { count: formatCompactCount(coupon.usedTimes) })}
          </span>
          {coupon.verified ? (
            <span className="zh-coupon__verified">
              <CheckCircle size={12} aria-hidden /> {t("verified")}
            </span>
          ) : null}
        </div>
      </div>
      <span className="sr-only">{copied ? tCoupons("codeCopied") : null}</span>
    </article>
  );
}

type ZorinoHomeCouponsPanelProps = {
  coupons: TopCouponCard[];
};

export default function ZorinoHomeCouponsPanel({ coupons }: ZorinoHomeCouponsPanelProps) {
  const t = useTranslations("home");

  return (
    <section className="zh-panel" id="zh-section-coupons" aria-labelledby="zh-coupons-title">
      <div className="zh-section-head">
        <h2 id="zh-coupons-title" className="zh-section-head__title">
          <span aria-hidden>ðŸ”¥</span> {t("topCoupons")}
        </h2>
        <ZorinoHomeViewAllLink href="/coupons" variant="coupons" />
      </div>
      <div className="zh-coupons">
        {coupons.length === 0 ? (
          <p className="zh-panel__empty">{t("emptyCoupons")}</p>
        ) : (
          coupons.map((coupon) => <CouponRow key={coupon.id} coupon={coupon} />)
        )}
      </div>
    </section>
  );
}
