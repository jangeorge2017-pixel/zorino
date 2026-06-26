"use client";

import ProductCardMedia from "@/components/ProductCardMedia";
import ProductCardActions from "@/components/ProductCardActions";
import HomeSectionHeader from "@/components/HomeSectionHeader";
import {
  HOME_SECTIONS,
  type HomeSectionVariant,
} from "@/lib/homepage/sections";
import type { RecommendedProductCard } from "@/services/recommendations";

type RecommendedProductsSectionProps = {
  variant: "recommended-products" | "recommended-for-you";
  title: string;
  subtitle: string;
  products: RecommendedProductCard[];
};

export default function RecommendedProductsSection({
  variant,
  title,
  subtitle,
  products,
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
      />

      <div className="trending-products-grid">
        {products.map((product) => (
          <article key={product.id} className="trending-product-card deal-card product-card">
            <ProductCardMedia
              src={product.imageUrl}
              alt={product.name}
              fallback={<span className="deal-emoji">{product.emoji}</span>}
              badges={
                product.discount > 0 ? (
                  <span className="deal-discount">-{product.discount}%</span>
                ) : null
              }
            />

            <div className="product-card-body">
              <p className="trending-card-reason">{product.reason}</p>
              <h3 className="trending-card-title deal-name">{product.name}</h3>
              <p className="trending-card-store">{product.storeName}</p>
              <div className="trending-card-prices deal-pricing">
                <span className="trending-card-price deal-price">${product.price.toFixed(2)}</span>
                {product.discount > 0 && (
                  <span className="trending-card-discount deal-discount">-{product.discount}%</span>
                )}
              </div>
            </div>

            <ProductCardActions productId={product.id} />
          </article>
        ))}
      </div>
    </section>
  );
}
