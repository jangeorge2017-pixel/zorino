/**
 * AliExpress Affiliate Portal tracking guard.
 *
 * `ALIEXPRESS_TRACKING_ID` is a REAL portal identifier bound to the tracking
 * backend — never a free-form vanity string. Production previously ran a
 * placeholder value ("default"), and every AliExpress Shop link was emitted as
 * `aff_trace_key=default`: a "tracked" URL that tracked nobody and leaked a
 * broken, obviously-fake parameter into the visitor-facing link.
 *
 * This module centralizes the two guards every AliExpress link builder uses:
 *
 *   1. Credibility — a configured tracking id must not be a placeholder /
 *      default / test / example value. Anything else is treated as
 *      UNCONFIGURED so the caller fails safe back to the real product URL.
 *   2. Already-tracked — a destination that already carries AliExpress
 *      tracking parameters (`aff_platform`, `affd`, `tracking_id`,
 *      `aff_trace_key`, `aff_short_key`, `dl_target_url`) or is a
 *      `s.click.aliexpress.com/e/_` click deep-link is left untouched — never
 *      double-tagged.
 *
 * These functions never invent tracking IDs and never alter a URL's host or
 * path — the product destination always survives exactly as provided.
 */

/** Known placeholder / default / demo values that must never be emitted. */
const PLACEHOLDER_TRACKING_IDS = new Set([
  "default",
  "none",
  "test",
  "placeholder",
  "example",
  "example_id",
  "sample",
  "demo",
  "xxx",
  "your_aliexpress_tracking_id",
  "your_tracking_id",
  "insert",
  "insert_your_aliexpress_tracking_id",
  "change_me",
  "set_me",
  "here",
  "n/a",
  "undefined",
  "null",
]);

/**
 * True only when `trackingId` is a non-empty, non-placeholder value that could
 * plausibly be a real AliExpress portal tracking id. Placeholder / default /
 * test values are deliberately treated as unconfigured so the caller fails
 * safe back to the original product URL.
 */
export function isCredibleAliExpressTrackingId(
  trackingId: string | null | undefined,
): boolean {
  const trimmed = trackingId?.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_TRACKING_IDS.has(trimmed.toLowerCase());
}

/** Query params that make an AliExpress URL already-tracked. */
const ALIEXPRESS_TRACKING_PARAMS = [
  "aff_platform",
  "affd",
  "tracking_id",
  "aff_trace_key",
  "aff_short_key",
  "dl_target_url",
] as const;

/**
 * True when `raw` already carries AliExpress affiliate tracking: either a
 * `s.click.aliexpress.com/e/_<token>` click deep-link, or the explicit
 * tracking query params set by the portal / Open API link generators.
 * Unparseable input returns false (the caller still fails safe by parsing).
 */
export function isAlreadyTrackedAliExpressUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hostname.toLowerCase() === "s.click.aliexpress.com") return true;
  for (const param of ALIEXPRESS_TRACKING_PARAMS) {
    if (url.searchParams.has(param)) return true;
  }
  return false;
}