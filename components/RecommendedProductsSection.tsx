"use client";

import HomeProductCard from "@/components/HomeProductCard";
import HomeSectionHeader from "@/components/HomeSectionHeader";
import { HOME_SECTIONS } from "@/lib/homepage/sections";
import type { RecommendedProductCard } from "@/services/recommendations";

type RecommendedProductsSectionProps = {
  variant: "recommended-products" | "recommended-for-you";
  title: string;
  subtitle: string;
  products: RecommendedProductCard[];
  isLoggedIn?: boolean;
};

export default function RecommendedProductsSection({
  variant,
  title,
  subtitle,
  products,
  isLoggedIn = false,
}: RecommendedProductsSectionProps) {
  if (products.length === 0) return null;

  const sectionConfig = HOME_SECTIONS[variant];
  const headingId = `${variant}-heading`;

  return (
    <section
      id={sectionConfig.sectionId}
      className={`home-section-shell home-section-shell--${variant} recommended-products-section`}
      aria-labelledby={headingId}
    >
      <HomeSectionHeader
        variant={variant}
        headingId={headingId}
        title={title}
        subtitle={subtitle}
        updatedLabel="Updated 12 min ago"
        link={{
          href: variant === "recommended-for-you" && !isLoggedIn ? "/auth/login" : "/search",
        }}
      />

      <div className="trending-products-grid">
        {products.map((product) => (
          <HomeProductCard
            key={product.id}
            variant={variant}
            productId={product.id}
            name={product.name}
            imageSrc={product.imageUrl}
            emoji={product.emoji}
            price={product.price}
            originalPrice={product.originalPrice}
            discount={product.discount}
            rating={product.rating}
            reviewCount={product.reviewCount}
            storeName={product.storeName}
            storeInitial={product.storeName.charAt(0).toUpperCase()}
            storesCompared={2}
            shippingTime="3–6 days"
            reason={product.reason}
            dynamicBadge={variant === "recommended-products" ? "editor-pick" : undefined}
          />
        ))}
      </div>
    </section>
  );
}
