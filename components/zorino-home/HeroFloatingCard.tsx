"use client";

import AssetImage from "@/components/AssetImage";
import { getHeroOrbitAnimationDelay } from "@/lib/hero/orbit";
import type { FloatingProductCard } from "@/lib/types/entities";

type HeroFloatingCardProps = {
  product: FloatingProductCard;
};

/** Prefer the largest available CDN variant for orbit product art. */
function preferOrbitImageSrc(src: string): string {
  if (!src || src.startsWith("/")) return src;
  try {
    const url = new URL(src);
    const host = url.hostname.toLowerCase();
    if (host === "images.unsplash.com") {
      url.searchParams.set("w", "1600");
      url.searchParams.set("q", "95");
      url.searchParams.set("auto", "format");
      return url.toString();
    }
    if (host.includes("media-amazon.com") || host.includes("ssl-images-amazon.com")) {
      return src.replace(/_SL\d+_/g, "_SL1600_").replace(/\._SS\d+_/, "._SS1600_");
    }
    if (host.includes("alicdn.com") || host.includes("aliexpress")) {
      return src.replace(/_\d+x\d+\./, "_960x960.");
    }
    return src;
  } catch {
    return src;
  }
}

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
          src={preferOrbitImageSrc(product.imageSrc)}
          alt=""
          fill
          className="zh-orbit-card__img"
          sizes="(min-width: 1280px) 384px, 224px"
          objectFit="contain"
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
