"use client";

import { useEffect, useRef } from "react";
import { Star, TrendingDown } from "lucide-react";
import ProductCardMedia from "@/components/ProductCardMedia";
import AssetImage from "@/components/AssetImage";
import TrendingBadgePill from "@/components/TrendingBadge";
import ProductCardActions from "@/components/ProductCardActions";
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
    <article className="trending-product-card deal-card product-card">
      <ProductCardMedia
        src={product.imageSrc}
        alt={product.name}
        fallback={<span className="deal-emoji">{product.emoji}</span>}
        badges={
          <>
            {product.badge && <TrendingBadgePill badge={product.badge} size="sm" />}
            {product.discount > 0 && (
              <span className="deal-discount">-{product.discount}%</span>
            )}
          </>
        }
      />

      <div className="product-card-body">
        <h3 className="deal-name">{product.name}</h3>

        <div className="deal-rating">
          <div className="deal-stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
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
      </div>

      <ProductCardActions
        productId={String(product.productId ?? product.id)}
        onShopClick={handleClick}
      />
    </article>
  );
}
