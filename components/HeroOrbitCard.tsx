"use client";

import AssetImage from "@/components/AssetImage";
import type { FloatingProductCard } from "@/lib/types/entities";

type HeroOrbitCardProps = {
  product: FloatingProductCard;
  animationDelay: number;
};

export default function HeroOrbitCard({
  product,
  animationDelay,
}: HeroOrbitCardProps) {
  return (
    <div
      className="hero-orbit-slot"
      data-orbit-position={product.position}
    >
      <div
        className="hero-orbit-card"
        style={{ animationDelay: `${animationDelay}s` }}
        title={product.price ? `${product.price} · ${product.discount}` : undefined}
      >
        <div className="hero-orbit-card-glow" aria-hidden="true" />
        <div className="hero-orbit-card-ring" aria-hidden="true" />
        <div className="hero-orbit-card-inner">
          <div className="hero-orbit-image-frame">
            <AssetImage
              src={product.imageSrc}
              alt=""
              fill
              className="hero-orbit-img"
              sizes="240px"
              objectFit="cover"
              priority
            />
          </div>
        </div>
        {product.discount ? (
          <span className="hero-orbit-discount">{product.discount}</span>
        ) : null}
      </div>
    </div>
  );
}
