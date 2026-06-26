"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import {
  normalizeProductImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
  isLocalProductImage,
} from "@/lib/images/product-image";

type AssetImageProps = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  className?: string;
  fallback?: ReactNode;
  priority?: boolean;
};

/**
 * Renders product/marketplace images via next/image.
 * Falls back to a local placeholder SVG, then optional fallback UI (e.g. emoji).
 */
export default function AssetImage({
  src,
  alt = "",
  width,
  height,
  fill = false,
  sizes,
  className,
  fallback,
  priority,
}: AssetImageProps) {
  const normalized = normalizeProductImageUrl(src);
  const [activeSrc, setActiveSrc] = useState(normalized);
  const [showFallbackUi, setShowFallbackUi] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setActiveSrc(normalizeProductImageUrl(src));
    setShowFallbackUi(false);
    const next = normalizeProductImageUrl(src);
    setLoaded(isLocalProductImage(next));
  }, [src]);

  if (showFallbackUi || (!activeSrc && fallback)) {
    return (
      <span
        className={`asset-image-fallback ${className ?? ""}`}
        style={
          fill
            ? undefined
            : {
                width,
                height,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }
        }
        aria-hidden={alt === ""}
      >
        {fallback ?? <span className="product-card-emoji-fallback" aria-hidden="true">🛍️</span>}
      </span>
    );
  }

  const handleError = () => {
    if (activeSrc !== PRODUCT_IMAGE_PLACEHOLDER) {
      setActiveSrc(PRODUCT_IMAGE_PLACEHOLDER);
      return;
    }
    setShowFallbackUi(true);
  };

  const shared = {
    src: activeSrc,
    alt,
    className: `${className ?? ""}${loaded ? " asset-image-loaded" : " asset-image-loading"}`.trim(),
    priority,
    loading: priority ? ("eager" as const) : ("lazy" as const),
    style: { objectFit: "contain" as const, objectPosition: "center" as const },
    onError: handleError,
    onLoad: () => setLoaded(true),
  };

  if (fill) {
    return <Image {...shared} fill sizes={sizes ?? "100vw"} />;
  }

  return (
    <Image
      {...shared}
      width={width ?? 120}
      height={height ?? 120}
      sizes={sizes}
    />
  );
}
