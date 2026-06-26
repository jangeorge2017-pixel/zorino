"use client";

import HomeProductCard from "@/components/HomeProductCard";
import HomeSectionHeader from "@/components/HomeSectionHeader";
import {
  HOME_SECTIONS,
} from "@/lib/homepage/sections";
import { formatCompactCount } from "@/lib/homepage/format";
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
  const avgRating =
    products.length > 0
      ? (
          products.reduce((sum, product) => sum + product.rating, 0) / products.length
        ).toFixed(1)
      : "4.8";

  const stats =
    variant === "recommended-for-you"
      ? isLoggedIn
        ? [
            { value: String(products.length), label: "Personalized Picks" },
            { value: "Based on interests", label: "Match Type" },
            { value: `${avgRating}★`, label: "Avg. Rating" },
          ]
        : [
            { value: "Sign in", label: "Unlock Personalization" },
            { value: formatCompactCount(products.length), label: "Popular Picks" },
          ]
      : [
          { value: String(products.length), label: "Curated Picks" },
          { value: `${avgRating}★`, label: "Avg. Rating" },
          { value: "Premium", label: "Selection" },
        ];

  const tags =
    variant === "recommended-for-you"
      ? isLoggedIn
        ? ["Based on your interests", "Because you viewed…", "Personalized Picks"]
        : ["Sign in to unlock personalized recommendations"]
      : ["Curated selection", "Top rated", "Editor approved"];

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
        stats={stats}
        tags={tags}
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
          />
        ))}
      </div>
    </section>
  );
}
