"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import {
  normalizeProductImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/images/product-image";

type AssetImageProps = {
  src: string;
  alt?: string;
  width: number;
  height: number;
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
  className,
  fallback,
  priority,
}: AssetImageProps) {
  const normalized = normalizeProductImageUrl(src);
  const [activeSrc, setActiveSrc] = useState(normalized);
  const [showFallbackUi, setShowFallbackUi] = useState(false);

  useEffect(() => {
    setActiveSrc(normalizeProductImageUrl(src));
    setShowFallbackUi(false);
  }, [src]);

  if (showFallbackUi || (!activeSrc && fallback)) {
    return (
      <span
        className={className}
        style={{
          width,
          height,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-hidden={alt === ""}
      >
        {fallback ?? <span aria-hidden="true">🛍️</span>}
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

  return (
    <Image
      src={activeSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      style={{ objectFit: "contain", objectPosition: "center" }}
      onError={handleError}
    />
  );
}
