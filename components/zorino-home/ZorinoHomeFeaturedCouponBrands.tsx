"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import ZorinoHomeViewAllLink from "@/components/zorino-home/ZorinoHomeViewAllLink";
import {
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Ticket,
} from "lucide-react";
import type { FeaturedCouponBrand } from "@/lib/zorino-home/featured-coupon-brands";
import "./featured-coupon-brands.css";

function BrandCard({ brand }: { brand: FeaturedCouponBrand }) {
  const [copied, setCopied] = useState(false);
  const [logoFailed, setLogoFailed] = useState(!brand.logoSrc);

  const copyCode = () => {
    navigator.clipboard.writeText(brand.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article
      className={`zh-brand-card zh-brand-card--${brand.textTone}`}
      style={
        {
          "--zh-brand-color": brand.brandColor,
          "--zh-brand-glow": brand.brandGlow,
        } as CSSProperties
      }
    >
      <div className="zh-brand-card__glow" aria-hidden />

      <div className="zh-brand-card__logo-wrap">
        {!logoFailed && brand.logoSrc ? (
          <img
            src={brand.logoSrc}
            alt=""
            className="zh-brand-card__logo"
            loading="lazy"
            decoding="async"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="zh-brand-card__logo-fallback" aria-hidden>
            {brand.logoInitial}
          </span>
        )}
        {brand.verified ? (
          <span className="zh-brand-card__verified">
            <CheckCircle size={11} aria-hidden />
            Verified
          </span>
        ) : null}
      </div>

      <h3 className="zh-brand-card__name">{brand.name}</h3>
      <p className="zh-brand-card__offer">{brand.offer}</p>

      <div className="zh-brand-card__code-row">
        <code className="zh-brand-card__code">{brand.code}</code>
        <button
          type="button"
          className="zh-brand-card__copy"
          onClick={copyCode}
          aria-label={`Copy coupon code ${brand.code}`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Copied" : "Copy Coupon"}</span>
        </button>
      </div>
    </article>
  );
}

type ZorinoHomeFeaturedCouponBrandsProps = {
  brands: FeaturedCouponBrand[];
};

export default function ZorinoHomeFeaturedCouponBrands({
  brands,
}: ZorinoHomeFeaturedCouponBrandsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncButtons = useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    setCanScrollLeft(node.scrollLeft > 4);
    setCanScrollRight(node.scrollLeft < node.scrollWidth - node.clientWidth - 4);
  }, []);

  useEffect(() => {
    syncButtons();
    window.addEventListener("resize", syncButtons);
    return () => window.removeEventListener("resize", syncButtons);
  }, [brands.length, syncButtons]);

  const scroll = (direction: -1 | 1) => {
    const node = trackRef.current;
    if (!node) return;
    const card = node.querySelector(".zh-brand-card");
    const cardWidth = card instanceof HTMLElement ? card.offsetWidth : 220;
    node.scrollBy({ left: direction * (cardWidth + 14), behavior: "smooth" });
    window.setTimeout(syncButtons, 420);
  };

  return (
    <section
      className="zh-panel zh-featured-brands"
      id="zh-section-featured-brands"
      aria-labelledby="zh-featured-brands-title"
    >
      <div className="zh-section-head">
        <h2 id="zh-featured-brands-title" className="zh-section-head__title zh-featured-brands__title">
          <Ticket size={22} aria-hidden className="zh-featured-brands__icon" />
          Featured Coupon Brands
        </h2>
        <ZorinoHomeViewAllLink href="/coupons" variant="coupons" />
      </div>

      <div className="zh-featured-brands__carousel">
        <button
          type="button"
          className="zh-featured-brands__nav zh-featured-brands__nav--prev"
          aria-label="Previous brands"
          disabled={!canScrollLeft}
          onClick={() => scroll(-1)}
        >
          <ChevronLeft size={18} />
        </button>

        <div className="zh-featured-brands__track" ref={trackRef} onScroll={syncButtons}>
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>

        <button
          type="button"
          className="zh-featured-brands__nav zh-featured-brands__nav--next"
          aria-label="Next brands"
          disabled={!canScrollRight}
          onClick={() => scroll(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
