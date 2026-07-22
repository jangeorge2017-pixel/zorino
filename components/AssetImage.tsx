"use client";

import Image from "next/image";
import { useState, type ReactNode, type SyntheticEvent } from "react";
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
  /** Defaults: cover when fill (product frames), contain for fixed logo tiles. */
  objectFit?: "cover" | "contain";
};

/**
 * Renders product/marketplace images via next/image.
 * Remote marketplace CDNs often block the optimizer; load those unoptimized
 * so the browser fetches them directly. Falls back to the local placeholder SVG.
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
  objectFit,
}: AssetImageProps) {
  const normalized = normalizeProductImageUrl(src) || PRODUCT_IMAGE_PLACEHOLDER;
  const [broken, setBroken] = useState(false);
  // Never start remote images at opacity 0 — CDN/onLoad races left black wells.
  const [loaded, setLoaded] = useState(true);
  const fit = objectFit ?? (fill ? "cover" : "contain");

  // Reset failure state when the source identity changes (render-time, no effect).
  const [srcKey, setSrcKey] = useState(src);
  if (src !== srcKey) {
    setSrcKey(src);
    setBroken(false);
    setLoaded(true);
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
            style={{ objectFit: fit, width: "100%", height: "100%" }}
          />
        )}
      </span>
    );
  }

  const displaySrc = broken ? PRODUCT_IMAGE_PLACEHOLDER : normalized;
  const isLocal = isLocalProductImage(displaySrc);

  const handleError = () => {
    if (displaySrc !== PRODUCT_IMAGE_PLACEHOLDER) {
      setBroken(true);
      return;
    }
    setBroken(true);
  };

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.naturalWidth > 0) setLoaded(true);
  };

  const shared = {
    src: displaySrc,
    alt: alt || "",
    className: `${className ?? ""}${loaded ? " asset-image-loaded" : " asset-image-loading"}`.trim(),
    priority,
    quality: 95,
    // Marketplace CDNs (eBay/AliExpress/etc.) frequently block server-side
    // optimizer fetches; load remotes in the browser instead.
    unoptimized: !isLocal,
    loading: priority ? ("eager" as const) : ("lazy" as const),
    decoding: "async" as const,
    style: { objectFit: fit, objectPosition: "center" as const },
    onError: handleError,
    onLoad: handleLoad,
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
