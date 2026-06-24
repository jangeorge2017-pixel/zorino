"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

type AssetImageProps = {
  src: string;
  alt?: string;
  width: number;
  height: number;
  className?: string;
  fallback?: ReactNode;
  priority?: boolean;
};

/** Renders an image when the asset exists; falls back to placeholder content for layout stability. */
export default function AssetImage({
  src,
  alt = "",
  width,
  height,
  className,
  fallback,
  priority,
}: AssetImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <span
        className={className}
        style={{ width, height, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        aria-hidden={alt === ""}
      >
        {fallback}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      style={{ objectFit: "contain", objectPosition: "center" }}
      onError={() => setFailed(true)}
    />
  );
}
