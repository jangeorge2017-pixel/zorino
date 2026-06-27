"use client";

import { Truck } from "lucide-react";
import ProductCardMedia from "@/components/ProductCardMedia";
import ProductCardActions from "@/components/ProductCardActions";
import AssetImage from "@/components/AssetImage";
import StarRating from "@/components/StarRating";
import WishlistButton from "@/components/WishlistButton";
import PriceAlertButton from "@/components/PriceAlertButton";
import ShareButton from "@/components/ShareButton";
import ProductDynamicBadge from "@/components/ProductDynamicBadge";
import PriceSparkline from "@/components/PriceSparkline";
import {
  resolveDynamicBadge,
  type DynamicBadgeType,
} from "@/lib/homepage/badges";
import type { HomeSectionVariant } from "@/lib/homepage/sections";
import type { TrendingBadge } from "@/lib/types/entities";

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
  dynamicBadge?: DynamicBadgeType;
  trendingBadge?: TrendingBadge | null;
  isNew?: boolean;
  isNewLow?: boolean;
  reason?: string;
  priceHistory?: number[];
  updatedLabel?: string;
  shopHref?: string;
  shopExternal?: boolean;
  onShopClick?: () => void;
  sparklineId?: string | number;
  compareOnly?: boolean;
  hideQuickActions?: boolean;
  referenceDealCard?: boolean;
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
  dynamicBadge,
  trendingBadge,
  isNew,
  isNewLow,
  reason,
  priceHistory,
  updatedLabel,
  shopHref,
  shopExternal = false,
  onShopClick,
  sparklineId,
  compareOnly = false,
  hideQuickActions = false,
  referenceDealCard = false,
}: HomeProductCardProps) {
  const initial = storeInitial ?? storeName?.charAt(0).toUpperCase() ?? "?";
  const showOriginal = originalPrice !== undefined && originalPrice > price;
  const savingsAmount = showOriginal ? originalPrice! - price : 0;
  const showRating = rating !== undefined && rating > 0;
  const badgeType =
    dynamicBadge ??
    resolveDynamicBadge({
      variant,
      trendingBadge,
      isNew,
      isNewLow,
      discount,
    });

  return (
    <article className={`home-product-card product-card product-card--${variant}`}>
      <ProductCardMedia
        src={imageSrc}
        alt={name}
        fallback={<span className="deal-emoji">{emoji}</span>}
        badges={
          referenceDealCard ? (
            discount > 0 ? (
              <span className="home-product-discount-pill">-{discount}%</span>
            ) : null
          ) : (
            <>
              <ProductDynamicBadge type={badgeType} />
              {discount > 0 ? (
                <span className="home-product-discount-pill">-{discount}%</span>
              ) : null}
            </>
          )
        }
      />

      {!hideQuickActions ? (
        <div className="product-card-quick-actions">
          <WishlistButton productId={productId} />
          <ShareButton productId={productId} productName={name} />
          <PriceAlertButton productId={productId} />
        </div>
      ) : null}

      <div className="product-card-body">
        {reason ? <p className="home-product-reason">{reason}</p> : null}
        <h3 className="deal-name">{name}</h3>

        {showRating ? (
          <StarRating rating={rating} reviewCount={reviewCount} size="md" />
        ) : null}

        {referenceDealCard && badgeType === "price-dropped" ? (
          <div className="home-product-status-badge">
            <ProductDynamicBadge type="price-dropped" />
          </div>
        ) : null}

        <div className="home-product-pricing-block">
          <div className="deal-pricing">
            <span className="deal-price">${price.toLocaleString("en-US")}</span>
            {showOriginal ? (
              <span className="deal-original">
                ${originalPrice!.toLocaleString("en-US")}
              </span>
            ) : null}
          </div>
          {!referenceDealCard && savingsAmount > 0 ? (
            <p className="home-product-savings">
              Save ${savingsAmount.toLocaleString("en-US")}
            </p>
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
              <span className="home-product-store-name">{storeName}</span>
            </div>
            {storesCompared !== undefined && storesCompared > 1 ? (
              <span className="home-product-stores-compared">
                {storesCompared} stores
              </span>
            ) : null}
          </div>
        )}

        <div className="home-product-meta-row">
          {!referenceDealCard && shippingTime ? (
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
        shopHref={shopHref}
        shopExternal={shopExternal}
        onShopClick={onShopClick}
        compareOnly={compareOnly}
      />
    </article>
  );
}
