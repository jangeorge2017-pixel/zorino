"use client";

import Link from "next/link";
import { Sparkles, UserCircle } from "lucide-react";
import AssetImage from "@/components/AssetImage";
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
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="trending-product-card-link"
          >
            <article className="trending-product-card">
              <div className="trending-card-image-wrap">
                <AssetImage
                  src={product.imageUrl}
                  alt={product.name}
                  width={160}
                  height={160}
                  className="trending-card-image"
                  fallback={<span className="deal-emoji">{product.emoji}</span>}
                />
              </div>
              <div className="trending-card-body">
                <p className="text-xs text-purple-400 mb-1">{product.reason}</p>
                <h3 className="trending-card-title">{product.name}</h3>
                <p className="trending-card-store">{product.storeName}</p>
                <div className="trending-card-prices">
                  <span className="trending-card-price">${product.price.toFixed(2)}</span>
                  {product.discount > 0 && (
                    <span className="trending-card-discount">-{product.discount}%</span>
                  )}
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
