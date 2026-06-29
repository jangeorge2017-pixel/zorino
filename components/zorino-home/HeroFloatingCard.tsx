"use client";

import AssetImage from "@/components/AssetImage";
import { getHeroOrbitAnimationDelay } from "@/lib/hero/orbit";
import type { FloatingProductCard } from "@/lib/types/entities";

type HeroFloatingCardProps = {
  product: FloatingProductCard;
};

export default function HeroFloatingCard({ product }: HeroFloatingCardProps) {
  const delay = getHeroOrbitAnimationDelay(product.position);

  return (
    <article
      className="zh-orbit-card"
      data-orbit-position={product.position}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="zh-orbit-card__media">
        <AssetImage
          src={product.imageSrc}
          alt=""
          fill
          className="zh-orbit-card__img"
          sizes="112px"
          priority
        />
        {product.discount ? (
          <span className="zh-orbit-card__discount">{product.discount}</span>
        ) : null}
      </div>
      <div className="zh-orbit-card__prices">
        {product.price ? (
          <span className="zh-orbit-card__price">{product.price}</span>
        ) : null}
        {product.original ? (
          <span className="zh-orbit-card__was">{product.original}</span>
        ) : null}
      </div>
    </article>
  );
}
