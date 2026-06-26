"use client";

import { Sparkles, UserCircle } from "lucide-react";
import ProductCardMedia from "@/components/ProductCardMedia";
import ProductCardActions from "@/components/ProductCardActions";
import type { RecommendedProductCard } from "@/services/recommendations";

type RecommendedProductsSectionProps = {
  title: string;
  subtitle: string;
  icon: "recommended" | "personalized";
  products: RecommendedProductCard[];
};

export default function RecommendedProductsSection({
  title,
  subtitle,
  icon,
  products,
}: RecommendedProductsSectionProps) {
  if (products.length === 0) return null;

  const Icon = icon === "personalized" ? UserCircle : Sparkles;

  return (
    <section className="trending-products-section" aria-labelledby={`${icon}-heading`}>
      <div className="trending-products-header">
        <div>
          <h2 id={`${icon}-heading`} className="section-title trending-products-title">
            <Icon size={24} className="trending-title-icon" />
            {title}
          </h2>
          <p className="trending-products-subtitle">{subtitle}</p>
        </div>
      </div>

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
