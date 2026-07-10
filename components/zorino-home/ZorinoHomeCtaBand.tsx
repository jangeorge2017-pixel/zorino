"use client";

import { Link } from "@/i18n/navigation";
import { ArrowRight, Scale, Sparkles, Ticket } from "lucide-react";

export default function ZorinoHomeCtaBand() {
  return (
    <section className="zh-cta-band" aria-labelledby="zh-cta-band-title">
      <div className="zh-cta-band__glow" aria-hidden />
      <div className="zh-cta-band__inner">
        <div className="zh-cta-band__copy">
          <p className="zh-cta-band__eyebrow">
            <Sparkles size={14} aria-hidden />
            Start saving today
          </p>
          <h2 id="zh-cta-band-title" className="zh-cta-band__title">
            Your smartest way to shop online
          </h2>
          <p className="zh-cta-band__text">
            Compare prices across marketplaces, unlock verified coupon codes, and catch
            flash deals before they disappear.
          </p>
        </div>
        <div className="zh-cta-band__actions">
          <Link href="/deals" className="zh-cta-band__btn zh-cta-band__btn--primary">
            Explore Deals
            <ArrowRight size={16} aria-hidden />
          </Link>
          <Link href="/compare" className="zh-cta-band__btn zh-cta-band__btn--ghost">
            <Scale size={16} aria-hidden />
            Compare Prices
          </Link>
          <Link href="/coupons" className="zh-cta-band__btn zh-cta-band__btn--ghost">
            <Ticket size={16} aria-hidden />
            Get Coupons
          </Link>
        </div>
      </div>
    </section>
  );
}
