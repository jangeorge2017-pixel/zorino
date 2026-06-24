"use client";

import Image from "next/image";
import { useState } from "react";
import { FLAME_ICON } from "@/lib/assets";

type SectionFlameIconProps = {
  size?: number;
};

/** Uses public/icons/flame.svg when present; emoji fallback keeps layout stable. */
export default function SectionFlameIcon({ size = 24 }: SectionFlameIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="section-icon-fire section-icon-fire-fallback" aria-hidden>
        🔥
      </span>
    );
  }

  return (
    <Image
      src={FLAME_ICON}
      alt=""
      width={size}
      height={size}
      className="section-icon-fire"
      aria-hidden
      onError={() => setFailed(true)}
    />
  );
}
