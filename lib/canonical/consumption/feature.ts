/**
 * Canonical consumption gates — Phase 4.
 *
 * Each surface (search, pdp, compare, homepage) migrates one at a time. A
 * surface is "canonical-enabled" ONLY when ALL of these hold:
 *   1. the master flag is on (ARCH_CANONICAL — see lib/canonical/feature.ts), AND
 *   2. that surface's own env switch is on:
 *        CANONICAL_CONSUMPTION_SEARCH     = on | 1 | true
 *        CANONICAL_CONSUMPTION_PDP        = on | 1 | true
 *        CANONICAL_CONSUMPTION_COMPARE    = on | 1 | true
 *        CANONICAL_CONSUMPTION_HOMEPAGE   = on | 1 | true
 *
 * Default: everything OFF. Every surface function falls back to the legacy
 * path when its gate is off, so production behavior is byte-for-byte unchanged.
 */

import { isCanonicalEnabled } from "@/lib/canonical/feature";

export type CanonicalSurface = "search" | "pdp" | "compare" | "homepage";

export const SURFACE_ENV_VARS: Record<CanonicalSurface, string> = {
  search: "CANONICAL_CONSUMPTION_SEARCH",
  pdp: "CANONICAL_CONSUMPTION_PDP",
  compare: "CANONICAL_CONSUMPTION_COMPARE",
  homepage: "CANONICAL_CONSUMPTION_HOMEPAGE",
};

/** Test hook — overrides the env-read surface flags. */
const testOverrides = new Map<CanonicalSurface, boolean>();

/** Visible for tests and diagnostics. */
export function setSurfaceEnabledForTests(surface: CanonicalSurface, enabled: boolean): void {
  if (enabled) testOverrides.set(surface, true);
  else testOverrides.delete(surface);
}

export function resetSurfaceFlagsForTests(): void {
  testOverrides.clear();
}

export function surfaceEnvValue(surface: CanonicalSurface): string {
  try {
    const raw = (process.env[SURFACE_ENV_VARS[surface]] ?? "").trim().toLowerCase();
    return raw === "on" || raw === "1" || raw === "true" ? "on" : raw === "off" ? "off" : raw;
  } catch {
    return "";
  }
}

export function isSurfaceEnabled(surface: CanonicalSurface): boolean {
  if (testOverrides.has(surface)) return testOverrides.get(surface)!;
  if (!isCanonicalEnabled()) return false;
  return surfaceEnvValue(surface) === "on";
}