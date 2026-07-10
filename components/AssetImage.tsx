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
 * Falls back to the local professional placeholder SVG — never blank/broken media.
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
  const [activeSrc, setActiveSrc] = useState(normalized || PRODUCT_IMAGE_PLACEHOLDER);
  const [showFallbackUi, setShowFallbackUi] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const next = normalizeProductImageUrl(src) || PRODUCT_IMAGE_PLACEHOLDER;
    setActiveSrc(next);
    setShowFallbackUi(false);
    setLoaded(isLocalProductImage(next));
  }, [src]);

  if (showFallbackUi) {
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
        {fallback ?? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={PRODUCT_IMAGE_PLACEHOLDER}
            alt=""
            width={width ?? 120}
            height={height ?? 120}
            style={{ objectFit: "contain", width: "100%", height: "100%" }}
          />
        )}
      </span>
    );
  }

  const displaySrc = activeSrc || PRODUCT_IMAGE_PLACEHOLDER;

  const handleError = () => {
    if (displaySrc !== PRODUCT_IMAGE_PLACEHOLDER) {
      setActiveSrc(PRODUCT_IMAGE_PLACEHOLDER);
      return;
    }
    setShowFallbackUi(true);
  };

  const shared = {
    src: displaySrc,
    alt,
    className: `${className ?? ""}${loaded ? " asset-image-loaded" : " asset-image-loading"}`.trim(),
    priority,
    quality: 92,
    loading: priority ? ("eager" as const) : ("lazy" as const),
    decoding: "async" as const,
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
      sizes={sizes ?? `(max-width: 767px) 50vw, ${width ?? 120}px`}
    />
  );
}
