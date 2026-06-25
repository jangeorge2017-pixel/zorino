"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Star, TrendingDown, ChevronRight } from "lucide-react";
import AssetImage from "@/components/AssetImage";
import TrendingBadgePill from "@/components/TrendingBadge";
import { trackProductInteraction } from "@/lib/trending/track-client";
import type { TrendingProductCard } from "@/lib/types/entities";

function PriceSparkline({ data, id }: { data: number[]; id: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const gradientId = `trend-spark-${id}`;
  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="price-sparkline" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type TrendingProductCardViewProps = {
  product: TrendingProductCard;
  trackViews?: boolean;
};

export default function TrendingProductCardView({
  product,
  trackViews = true,
}: TrendingProductCardViewProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!trackViews || tracked.current || !product.productId) return;
    tracked.current = true;
    trackProductInteraction({
      productId: product.productId,
      eventType: "view",
      countryCode: product.countryCode,
      source: "trending_section",
    });
  }, [trackViews, product.productId, product.countryCode]);

  const handleClick = () => {
    if (!product.productId) return;
    trackProductInteraction({
      productId: product.productId,
      eventType: "click",
      countryCode: product.countryCode,
      source: "trending_section",
    });
  };

  return (
    <article className="trending-product-card deal-card">
      <div className="deal-card-top">
        <div className="trending-card-badges">
          {product.badge && <TrendingBadgePill badge={product.badge} size="sm" />}
          {product.discount > 0 && (
            <span className="deal-discount">-{product.discount}%</span>
          )}
        </div>
        <div className="deal-image">
          <AssetImage
            src={product.imageSrc}
            alt=""
            width={72}
            height={72}
            className="deal-product-img"
            fallback={<span className="deal-emoji">{product.emoji}</span>}
          />
        </div>
      </div>

      <h3 className="deal-name">{product.name}</h3>

      <div className="deal-rating">
        <div className="deal-stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={13}
              className={i < Math.floor(product.rating) ? "star-filled" : "star-empty"}
              fill={i < Math.floor(product.rating) ? "currentColor" : "none"}
            />
          ))}
        </div>
        <span className="deal-reviews">({product.reviews.toLocaleString("en-US")})</span>
      </div>

      {product.rankingType === "biggest_drops" && (
        <div className="deal-price-drop">
          <TrendingDown size={12} />
          Price dropped
        </div>
      )}

      <div className="deal-pricing">
        <span className="deal-price">${product.price.toLocaleString("en-US")}</span>
        {product.originalPrice > product.price && (
          <span className="deal-original">${product.originalPrice.toLocaleString("en-US")}</span>
        )}
      </div>

      <div className="deal-store-row">
        <div className="deal-store">
          <span className="store-logo">
            <AssetImage
              src={product.storeLogoSrc}
              alt=""
              width={28}
              height={28}
              className="store-logo-img"
              fallback={<span className="store-logo-initial">{product.storeInitial}</span>}
            />
          </span>
          <span>{product.store}</span>
        </div>
        {product.providerCount !== undefined && product.providerCount > 1 && (
          <span className="trending-provider-count">{product.providerCount} stores</span>
        )}
      </div>

      <div className="deal-chart-row">
        <PriceSparkline data={product.priceHistory} id={String(product.id)} />
      </div>

      <Link
        href={`/product/${product.productId ?? product.id}#compare-prices`}
        className="deal-compare-btn trending-card-cta"
        onClick={handleClick}
      >
        Compare Prices
        <ChevronRight size={14} />
      </Link>
    </article>
  );
}
