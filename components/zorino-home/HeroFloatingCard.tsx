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
      url.searchParams.set("w", "2000");
      url.searchParams.set("q", "95");
      url.searchParams.set("auto", "format");
      // fit=max keeps the full original framing (no CDN crop)
      url.searchParams.set("fit", "max");
      url.searchParams.delete("h");
      return url.toString();
    }
    if (host.includes("media-amazon.com") || host.includes("ssl-images-amazon.com")) {
      return src
        .replace(/_SL\d+_/g, "_SL2000_")
        .replace(/\._SS\d+_/, "._SS2000_")
        .replace(/_AC_UL\d+_/, "_AC_SL2000_")
        .replace(/_AC_UX\d+_/, "_AC_SL2000_");
    }
    if (host.includes("alicdn.com") || host.includes("aliexpress")) {
      // Prefer largest square variant; fall back to stripping size suffix for original
      const enlarged = src.replace(/_\d+x\d+\./, "_1200x1200.");
      if (enlarged !== src) return enlarged;
      return src.replace(/_\d+x\d+\./, ".");
    }
    if (host.includes("noon") || host.includes("f.nooncdn.com")) {
      return src.replace(/\/[a-z]?_?\d+x\d+\//i, "/").replace(/_\d+x\d+(\.\w+)/, "$1");
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
          sizes="(min-width: 1280px) 640px, (min-width: 768px) 400px, 224px"
          objectFit="cover"
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
