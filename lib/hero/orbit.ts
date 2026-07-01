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
 * Premium four-card orbit around the Z logo (hero.css data-orbit-position rules).
 */
export const HERO_ORBIT_REFERENCE_POSITIONS: Record<string, { left: string; top: string }> = {
  "orbit-top": { left: "50%", top: "23%" },
  "orbit-upper-left": { left: "15%", top: "49%" },
  "orbit-upper-right": { left: "79%", top: "29%" },
  "orbit-lower-right": { left: "85%", top: "53%" },
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
