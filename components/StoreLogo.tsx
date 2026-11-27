"use client";

import { useEffect, useState } from "react";
import { resolveStoreLogo } from "@/lib/assets";

type StoreLogoProps = {
  slug?: string | null;
  name?: string | null;
  logoUrl?: string | null;
  logoInitial?: string | null;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  alt?: string;
  size?: number;
};

export default function StoreLogo({
  slug,
  name,
  logoUrl,
  logoInitial,
  className = "",
  imgClassName = "",
  fallbackClassName = "",
  alt,
  size,
}: StoreLogoProps) {
  const { src, monogram } = resolveStoreLogo({ slug, name, logoUrl, logoInitial });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const dimension = size ? { width: size, height: size } : undefined;
  const rootClass = `zor-store-logo ${className}`.trim();

  if (!src || failed) {
    return (
      <span
        className={`zor-store-logo zor-store-logo--fallback ${rootClass} ${fallbackClassName}`.trim()}
        role="img"
        aria-label={alt ?? `${name ?? slug ?? "Store"} logo`}
        style={dimension}
      >
        {monogram}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? `${name ?? slug ?? "Store"} logo`}
      className={`zor-store-logo ${rootClass} ${imgClassName}`.trim()}
      style={dimension}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
