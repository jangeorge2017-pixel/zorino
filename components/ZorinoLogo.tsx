import {
  ZORINO_LOGO_SVG,
  ZORINO_LOGO_INTRINSIC,
  ZORINO_LOGO_VARIANTS,
  ZORINO_LOGO_DISPLAY_HEIGHT,
} from "@/lib/assets";

type ZorinoLogoProps = {
  className?: string;
  displayHeight?: number;
};

/** Navbar lockup only — hero Z is part of hero-background.png (not duplicated here). */
export function ZorinoLogo({
  className,
  displayHeight = ZORINO_LOGO_DISPLAY_HEIGHT,
}: ZorinoLogoProps) {
  const displayWidth = Math.round(
    (ZORINO_LOGO_INTRINSIC.width / ZORINO_LOGO_INTRINSIC.height) * displayHeight,
  );

  const srcSet = [
    `${ZORINO_LOGO_SVG} 1x`,
    `${ZORINO_LOGO_VARIANTS["@2x"]} 2x`,
    `${ZORINO_LOGO_VARIANTS["@3x"]} 3x`,
    `${ZORINO_LOGO_VARIANTS["@4x"]} 4x`,
  ].join(", ");

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ZORINO_LOGO_SVG}
      srcSet={srcSet}
      width={ZORINO_LOGO_INTRINSIC.width}
      height={ZORINO_LOGO_INTRINSIC.height}
      alt="Zorino"
      decoding="sync"
      loading="eager"
      fetchPriority="high"
      draggable={false}
      className={className}
      style={{ width: displayWidth, height: displayHeight }}
    />
  );
}

/** @deprecated Use ZorinoLogo */
export const ZorinoLogoMark = ZorinoLogo;
