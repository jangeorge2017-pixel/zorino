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
          <stop offset="0%" stopColor="#9845ed" />
          <stop offset="52%" stopColor="#7c4aec" />
          <stop offset="100%" stopColor="#6d5af0" />
        </linearGradient>
        <linearGradient id="zhLogoFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7959ec" />
          <stop offset="48%" stopColor="#4f6ff0" />
          <stop offset="100%" stopColor="#386ced" />
        </linearGradient>
        <linearGradient id="zhLogoFold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#0b0b1a" />
          <stop offset="52%" stopColor="#1e2a60" />
          <stop offset="100%" stopColor="#386ced" />
        </linearGradient>
        <linearGradient id="zhLogoBottom" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#386ced" />
          <stop offset="54%" stopColor="#3f8df0" />
          <stop offset="100%" stopColor="#5fd0e8" />
        </linearGradient>
      </defs>
      <path
        d="M69 18H78L83 23L78 27L74 28L70 32V43L68 46H78L82 51H80V54L76 57L55 56L52 60L48 61L41 60L45 57V56L35 58L38 52H34L33 44L35 43L38 32L40 30H49V28H38L44 20Z"
        fill="url(#zhLogoFace)"
      />
      <path
        d="M44 20L69 18H78L83 23L78 26L49 28H38Z"
        fill="url(#zhLogoTop)"
      />
      <path
        d="M49 28H70V43L68 46H45L38 52L34 52L33 44L38 32L40 30H49Z"
        fill="url(#zhLogoFace)"
      />
      <path
        d="M45 46H68L78 46L82 51H80V54L76 57L55 56L52 60L48 61L41 60L45 57V56Z"
        fill="url(#zhLogoBottom)"
      />
      <path
        d="M40 30H49L45 46L38 52L35 43L38 32Z"
        fill="url(#zhLogoFold)"
        opacity="0.82"
      />
      <path
        d="M70 28L74 27L78 26L74 32L70 43V28Z"
        fill="#ffffff"
        opacity="0.18"
      />
      <path
        d="M41 60L48 61L52 60L45 57Z"
        fill="#0b0b1a"
        opacity="0.32"
      />
      <text
        x="86"
        y="44"
        fill="#0f172a"
        fontFamily='"Plus Jakarta Sans", sans-serif'
        fontSize="28"
        fontWeight="800"
        letterSpacing="1"
      >
        ZORINO
      </text>
      <text
        x="92"
        y="55"
        fill="#475569"
        fontFamily='"Plus Jakarta Sans", sans-serif'
        fontSize="9"
        fontWeight="600"
        letterSpacing="0.05"
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
