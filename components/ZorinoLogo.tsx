import {
  ZORINO_LOGO_SOURCE,
  ZORINO_LOGO_INTRINSIC,
  ZORINO_LOGO_VARIANTS,
  ZORINO_LOGO_DISPLAY_HEIGHT,
} from "@/lib/assets";

type ZorinoLogoProps = {
  className?: string;
  displayHeight?: number;
};

export function ZorinoLogoVector({ className }: { className?: string }) {
  return (
    <svg
      className={className ? `zh-logo-vector ${className}` : "zh-logo-vector"}
      viewBox="0 0 205 82"
      role="img"
      aria-labelledby="zh-logo-vector-title"
      focusable="false"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      style={{ display: "none", aspectRatio: "205 / 82" }}
    >
      <title id="zh-logo-vector-title">Zorino — Smart Price Comparison</title>
      <defs>
        <linearGradient id="zhLogoTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="52%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="zhLogoFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="42%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="zhLogoFold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="48%" stopColor="#4338ca" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id="zhLogoBottom" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="55%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g stroke="rgba(15, 23, 42, 0.12)" strokeWidth="0.8" strokeLinejoin="round">
        <path d="M8 17.5H49L44.5 28H16.5Z" fill="url(#zhLogoTop)" />
        <path d="M16.5 28H44.5L23 51H7.5Z" fill="url(#zhLogoFace)" />
        <path d="M23 45.5H51V57.5H10.5Z" fill="url(#zhLogoBottom)" />
        <path d="M49 17.5L54 22.5L49 33L44.5 28Z" fill="url(#zhLogoFold)" />
        <path d="M51 57.5L46 62.5H8.5L10.5 57.5Z" fill="url(#zhLogoFold)" opacity="0.86" />
        <path d="M16.5 28L44.5 28L23 45.5L10.5 45.5Z" fill="#ffffff" opacity="0.16" stroke="none" />
      </g>
      <path d="M9.5 19.5H44.8M18 31L10 49M13 54.3H46" fill="none" stroke="#ffffff" strokeOpacity="0.72" strokeWidth="1.2" strokeLinecap="round" />
      <text
        x="61"
        y="43"
        fill="#0f172a"
        fontFamily="Plus Jakarta Sans, Geist, system-ui, sans-serif"
        fontSize="27"
        fontWeight="800"
        letterSpacing="-0.6"
      >
        ZORINO
      </text>
      <text
        x="62"
        y="60"
        fill="#475569"
        fontFamily="Plus Jakarta Sans, Geist, system-ui, sans-serif"
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="1.1"
      >
        Smart Price Comparison
      </text>
    </svg>
  );
}

/** Navbar lockup only — hero Z is part of hero-background.png (not duplicated here). */
export function ZorinoLogo({
  className,
  displayHeight = ZORINO_LOGO_DISPLAY_HEIGHT,
}: ZorinoLogoProps) {
  const displayWidth = Math.round(
    (ZORINO_LOGO_INTRINSIC.width / ZORINO_LOGO_INTRINSIC.height) * displayHeight,
  );

  /* Prefer PNG — SVG nests an external <image>, which often paints blank when used as <img src>. */
  const srcSet = [
    `${ZORINO_LOGO_VARIANTS["@1x"]} 1x`,
    `${ZORINO_LOGO_VARIANTS["@2x"]} 2x`,
    `${ZORINO_LOGO_VARIANTS["@3x"]} 3x`,
    `${ZORINO_LOGO_VARIANTS["@4x"]} 4x`,
  ].join(", ");

  return (
    <>
      <img
        src={ZORINO_LOGO_SOURCE}
        srcSet={srcSet}
        sizes={`${Math.ceil(displayWidth)}px`}
        width={ZORINO_LOGO_INTRINSIC.width}
        height={ZORINO_LOGO_INTRINSIC.height}
        alt="Zorino"
        decoding="sync"
        loading="eager"
        fetchPriority="high"
        draggable={false}
        className={className ? `zh-logo-raster ${className}` : "zh-logo-raster"}
        style={{ width: displayWidth, height: displayHeight }}
      />
      <ZorinoLogoVector
        className={className ? `${className} zh-logo-vector-lockup` : "zh-logo-vector-lockup"}
      />
    </>
  );
}

/** @deprecated Use ZorinoLogo */
export const ZorinoLogoMark = ZorinoLogo;
