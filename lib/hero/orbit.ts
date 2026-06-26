/** Slot order for staggered float animation delays. */
export const HERO_ORBIT_ANGLE_ORDER = [
  "orbit-lower-left",
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
 * Reference slot positions (% of .hero-orbit), from public/target design.jpeg.
 * Applied via CSS data-orbit-position rules in globals.css.
 */
export const HERO_ORBIT_REFERENCE_POSITIONS: Record<string, { left: string; top: string }> = {
  "orbit-top": { left: "50%", top: "21%" },
  "orbit-upper-left": { left: "19%", top: "39%" },
  "orbit-upper-right": { left: "81%", top: "39%" },
  "orbit-lower-left": { left: "calc(10% + 12px)", top: "calc(57% + 25px)" },
  "orbit-lower-right": { left: "calc(90% - 12px)", top: "calc(57% + 25px)" },
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
