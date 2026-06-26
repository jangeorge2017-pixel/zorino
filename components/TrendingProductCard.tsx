"use client";

import { useEffect, useRef } from "react";
import HomeProductCard from "@/components/HomeProductCard";
import { trackProductInteraction } from "@/lib/trending/track-client";
import type { TrendingProductCard } from "@/lib/types/entities";

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
    <HomeProductCard
      variant="trending-products"
      productId={String(product.productId ?? product.id)}
      name={product.name}
      imageSrc={product.imageSrc}
      emoji={product.emoji}
      price={product.price}
      originalPrice={product.originalPrice}
      discount={product.discount}
      rating={product.rating}
      reviewCount={product.reviews}
      storeName={product.store}
      storeLogoSrc={product.storeLogoSrc}
      storeInitial={product.storeInitial}
      storesCompared={product.providerCount}
      shippingTime="1–3 days"
      priceHistory={product.priceHistory}
      trendingBadge={product.badge}
      updatedLabel="Trending now"
      sparklineId={product.id}
      onShopClick={handleClick}
    />
  );
}
