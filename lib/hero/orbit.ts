/** Slot order for staggered float animation delays. */
export const HERO_ORBIT_ANGLE_ORDER = [
  "orbit-upper-left",
  "orbit-top",
  "orbit-upper-right",
  "orbit-lower-right",
] as const;

export function getHeroOrbitAnimationDelay(position: string): number {
  const index = HERO_ORBIT_ANGLE_ORDER.indexOf(
    position as (typeof HERO_ORBIT_ANGLE_ORDER)[number],
  );
  return index >= 0 ? index * 0.65 : 0;
}

/**
 * Premium four-card orbit around the Z logo.
 * Must stay in sync with hero.css data-orbit-position rules
 * (pre–Quick-Nav / Trending placement adjustment).
 */
export const HERO_ORBIT_REFERENCE_POSITIONS: Record<string, { left: string; top: string }> = {
  "orbit-upper-left": { left: "calc(72% - 151px)", top: "36%" },
  "orbit-top": { left: "calc(72% - 151px)", top: "60%" },
  "orbit-upper-right": { left: "88%", top: "36%" },
  "orbit-lower-right": { left: "88%", top: "60%" },
};

export function getHeroOrbitSlotPosition(position: string): {
  left: string;
  top: string;
} {
  return (
    HERO_ORBIT_REFERENCE_POSITIONS[position] ??
    HERO_ORBIT_REFERENCE_POSITIONS["orbit-top"]
  );
}
