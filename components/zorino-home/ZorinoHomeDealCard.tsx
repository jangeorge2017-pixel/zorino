"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { ChevronRight, Clock, ImageOff, Star, TrendingDown, TrendingUp } from "lucide-react";
import ZorinoHomeSparkline from "@/components/zorino-home/ZorinoHomeSparkline";
import type { TrendingDealCard } from "@/lib/types/entities";
import "./ZorinoHomeDealCard.css";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ZorinoHomeDealCard({ deal }: { deal: TrendingDealCard }) {
  const [imgError, setImgError] = useState(false);
  const dropped = deal.originalPrice > deal.price;
  const increased = deal.originalPrice < deal.price;
  const compareHref = deal.productId ? `/product/${deal.productId}` : "/deals";

  return (
    <article className="zh-deal-card">
      <div className="zh-deal-card__media">
        {deal.discount > 0 ? (
          <span className="zh-deal-card__discount">-{Math.round(deal.discount)}%</span>
        ) : null}
        {!imgError && deal.imageSrc ? (
          <img
            src={deal.imageSrc}
            alt={deal.name}
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="zh-deal-card__media-fallback" aria-hidden>
            <ImageOff size={28} />
            <span>No image</span>
          </div>
        )}
      </div>

      <h3 className="zh-deal-card__name">{deal.name}</h3>

      <div className="zh-deal-card__rating">
        <span className="zh-deal-card__stars" aria-label={`${deal.rating} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={11}
              fill={i < Math.round(deal.rating) ? "#fbbf24" : "#334155"}
              color={i < Math.round(deal.rating) ? "#fbbf24" : "#334155"}
            />
          ))}
        </span>
        <span className="zh-deal-card__reviews">
          ({deal.reviews.toLocaleString("en-US")})
        </span>
      </div>

      {dropped ? (
        <span className="zh-deal-card__drop">
          <TrendingDown size={12} aria-hidden />
          Price dropped
        </span>
      ) : increased ? (
        <span className="zh-deal-card__rise">
          <TrendingUp size={12} aria-hidden />
          Price up
        </span>
      ) : null}

      <div className="zh-deal-card__prices">
        <span className="zh-deal-card__price">{formatUsd(deal.price)}</span>
        {(dropped || increased) && deal.originalPrice !== deal.price ? (
          <span className="zh-deal-card__was">{formatUsd(deal.originalPrice)}</span>
        ) : null}
      </div>

      <div className="zh-deal-card__store-row">
        <div className="zh-deal-card__store">
          <span className="zh-deal-card__store-logo">
            <img
              src={deal.storeLogoSrc}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = "none";
                if (e.currentTarget.parentElement) {
                  e.currentTarget.parentElement.textContent = deal.storeInitial;
                }
              }}
            />
          </span>
          {deal.store}
        </div>
        <span className="zh-deal-card__updated">
          <Clock size={11} aria-hidden />
          Updated {deal.updatedMins} min ago
        </span>
      </div>

      <div className="zh-deal-card__spark-wrap">
        <ZorinoHomeSparkline values={deal.priceHistory} rising={increased} />
      </div>

      <Link href={compareHref} className="zh-deal-card__cta">
        Compare Prices
        <ChevronRight size={16} aria-hidden />
      </Link>
    </article>
  );
}
