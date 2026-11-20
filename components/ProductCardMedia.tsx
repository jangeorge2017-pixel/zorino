import AssetImage from "@/components/AssetImage";
import type { ReactNode } from "react";
import "./product-card-media-overlays.css";

type ProductCardMediaProps = {
  src: string;
  alt?: string;
  fallback?: ReactNode;
  priority?: boolean;
  /** Floating pills — top-left stack (store, then discount). */
  badges?: ReactNode;
  /** Floating pills — top-right (featured). */
  badgesEnd?: ReactNode;
};

/** Full-bleed cover image with compact absolute overlay pills. */
export default function ProductCardMedia({
  src,
  alt = "",
  fallback,
  priority,
  badges,
  badgesEnd,
}: ProductCardMediaProps) {
  return (
    <div className="product-card-media">
      <div className="product-card-image-frame">
        <AssetImage
          src={src}
          alt={alt}
          fill
          className="product-card-image"
          sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 420px"
          objectFit="cover"
          fallback={fallback}
          priority={priority}
        />
      </div>
      {badges ? (
        <div className="product-card-badges product-card-badges--start">{badges}</div>
      ) : null}
      {badgesEnd ? (
        <div className="product-card-badges product-card-badges--end">{badgesEnd}</div>
      ) : null}
    </div>
  );
}
