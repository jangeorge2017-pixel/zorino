"use client";

import { TrendingDown, Truck } from "lucide-react";
import type { ReactNode } from "react";
import ProductCardMedia from "@/components/ProductCardMedia";
import ProductCardActions from "@/components/ProductCardActions";
import AssetImage from "@/components/AssetImage";
import StarRating from "@/components/StarRating";
import WishlistButton from "@/components/WishlistButton";
import PriceSparkline from "@/components/PriceSparkline";
import type { HomeSectionVariant } from "@/lib/homepage/sections";

export type HomeProductCardProps = {
  variant: HomeSectionVariant;
  productId: string;
  name: string;
  imageSrc: string;
  emoji?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating?: number;
  reviewCount?: number;
  storeName?: string;
  storeLogoSrc?: string;
  storeInitial?: string;
  shippingTime?: string;
  storesCompared?: number;
  badges?: ReactNode;
  reason?: string;
  priceHistory?: number[];
  showPriceDrop?: boolean;
  updatedLabel?: string;
  shopHref?: string;
  shopExternal?: boolean;
  onShopClick?: () => void;
  sparklineId?: string | number;
};

const SPARKLINE_VARIANT: Record<
  HomeSectionVariant,
  "green" | "orange" | "purple" | "cyan" | "red" | "gold"
> = {
  "lowest-price": "green",
  "trending-products": "orange",
  "recommended-products": "purple",
  "recommended-for-you": "cyan",
  "trending-deals": "red",
  "top-coupons": "gold",
};

export default function HomeProductCard({
  variant,
  productId,
  name,
  imageSrc,
  emoji = "🛍️",
  price,
  originalPrice,
  discount = 0,
  rating,
  reviewCount,
  storeName,
  storeLogoSrc,
  storeInitial,
  shippingTime = "2–5 days",
  storesCompared,
  badges,
  reason,
  priceHistory,
  showPriceDrop = false,
  updatedLabel,
  shopHref,
  shopExternal = false,
  onShopClick,
  sparklineId,
}: HomeProductCardProps) {
  const initial =
    storeInitial ?? storeName?.charAt(0).toUpperCase() ?? "?";
  const showOriginal = originalPrice !== undefined && originalPrice > price;
  const showRating = rating !== undefined && rating > 0;

  return (
    <article className={`home-product-card product-card product-card--${variant}`}>
      <ProductCardMedia
        src={imageSrc}
        alt={name}
        fallback={<span className="deal-emoji">{emoji}</span>}
        badges={
          <>
            {badges}
            {discount > 0 && (
              <span className="deal-discount home-product-discount">-{discount}%</span>
            )}
          </>
        }
      />
      <WishlistButton productId={productId} />

      <div className="product-card-body">
        {reason ? <p className="home-product-reason">{reason}</p> : null}
        <h3 className="deal-name">{name}</h3>

        {showRating ? (
          <StarRating rating={rating} reviewCount={reviewCount} size="md" />
        ) : null}

        {showPriceDrop ? (
          <div className="deal-price-drop">
            <TrendingDown size={12} />
            Price dropped
          </div>
        ) : null}

        <div className="deal-pricing">
          <span className="deal-price">${price.toLocaleString("en-US")}</span>
          {showOriginal ? (
            <span className="deal-original">
              ${originalPrice!.toLocaleString("en-US")}
            </span>
          ) : null}
        </div>

        {(storeName || storeLogoSrc) && (
          <div className="deal-store-row">
            <div className="deal-store">
              <span className="store-logo">
                <AssetImage
                  src={storeLogoSrc ?? ""}
                  alt=""
                  width={28}
                  height={28}
                  className="store-logo-img"
                  fallback={<span className="store-logo-initial">{initial}</span>}
                />
              </span>
              <span>{storeName}</span>
            </div>
            {storesCompared !== undefined && storesCompared > 1 ? (
              <span className="home-product-stores-compared">
                {storesCompared} stores
              </span>
            ) : null}
          </div>
        )}

        <div className="home-product-meta-row">
          {shippingTime ? (
            <span className="home-product-shipping">
              <Truck size={12} />
              {shippingTime}
            </span>
          ) : null}
          {updatedLabel ? (
            <span className="deal-updated">{updatedLabel}</span>
          ) : null}
        </div>

        {priceHistory && priceHistory.length > 1 ? (
          <div className="deal-chart-row">
            <PriceSparkline
              data={priceHistory}
              id={sparklineId ?? productId}
              variant={SPARKLINE_VARIANT[variant]}
            />
          </div>
        ) : null}
      </div>

      <ProductCardActions
        productId={productId}
        compareClassName="home-compare-btn"
        shopHref={shopHref}
        shopExternal={shopExternal}
        onShopClick={onShopClick}
      />
    </article>
  );
}
