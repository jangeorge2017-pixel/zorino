"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
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
  const normalized = normalizeProductImageUrl(src) || PRODUCT_IMAGE_PLACEHOLDER;
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(() => isLocalProductImage(normalized));

  // Reset failure state when the source identity changes (render-time, no effect).
  const [srcKey, setSrcKey] = useState(src);
  if (src !== srcKey) {
    setSrcKey(src);
    setBroken(false);
    setLoaded(isLocalProductImage(normalized));
  }

  if (broken && normalized === PRODUCT_IMAGE_PLACEHOLDER) {
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

  const displaySrc = broken ? PRODUCT_IMAGE_PLACEHOLDER : normalized;

  const handleError = () => {
    if (displaySrc !== PRODUCT_IMAGE_PLACEHOLDER) {
      setBroken(true);
      return;
    }
    setBroken(true);
  };

  const shared = {
    src: displaySrc,
    alt: alt || "",
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
    return <Image {...shared} alt={shared.alt} fill sizes={sizes ?? "100vw"} />;
  }

  return (
    <Image
      {...shared}
      alt={shared.alt}
      width={width ?? 120}
      height={height ?? 120}
      sizes={sizes ?? `(max-width: 767px) 50vw, ${width ?? 120}px`}
    />
  );
}
