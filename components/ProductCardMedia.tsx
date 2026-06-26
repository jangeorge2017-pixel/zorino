import AssetImage from "@/components/AssetImage";
import type { ReactNode } from "react";

type ProductCardMediaProps = {
  src: string;
  alt?: string;
  fallback?: ReactNode;
  priority?: boolean;
  badges?: ReactNode;
};

/** Shared premium product image area (~58% of card height). */
export default function ProductCardMedia({
  src,
  alt = "",
  fallback,
  priority,
  badges,
}: ProductCardMediaProps) {
  return (
    <div className="product-card-media">
      {badges ? <div className="product-card-badges">{badges}</div> : null}
      <div className="product-card-image-frame">
        <AssetImage
          src={src}
          alt={alt}
          fill
          className="product-card-image"
          sizes="(max-width: 640px) 88vw, (max-width: 1024px) 44vw, 22vw"
          fallback={fallback}
          priority={priority}
        />
      </div>
    </div>
  );
}
