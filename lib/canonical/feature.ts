/**
 * ARCH_CANONICAL feature flag (Phase 1).
 *
 * Default OFF. When OFF, the canonical spine is NOT wired into any runtime
 * path — Search/PDP/Compare/Homepage behave exactly as before. The canonical
 * modules are additive and testable independently.
 *
 * Set ARCH_CANONICAL=1 in the environment to enable (used by tests / future
 * phases). Do NOT flip this in production during Phase 1.
 */

const ENV_VAR = "ARCH_CANONICAL";

function envEnabled(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  const value = process.env[ENV_VAR];
  if (value == null) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

let cached: boolean | null = null;

/** True when the canonical spine should be wired into runtime paths. */
export function isCanonicalEnabled(): boolean {
  if (cached == null) cached = envEnabled();
  return cached;
}

/** Test helper to force the flag deterministically. */
export function setCanonicalEnabledForTests(value: boolean): void {
  cached = value;
}

/** Test helper to reset back to env-derived value. */
export function resetCanonicalFlagForTests(): void {
  cached = null;
}

/** String the flag currently evaluates to (for diagnostics / reports). */
export function canonicalFlagValue(): string {
  return isCanonicalEnabled() ? "on" : "off";
}