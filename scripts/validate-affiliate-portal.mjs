/**
 * Validates AliExpress portal affiliate link rules (no Open API).
 * Mirrors lib/affiliate/providers/aliexpress/portal-links.ts behavior.
 */

function build(productUrl, trackingId, affiliateBaseUrl) {
  const original = productUrl.trim();
  if (!original) {
    return { url: productUrl, source: "original", trackingApplied: false };
  }
  if (!trackingId) {
    return { url: original, source: "original", trackingApplied: false };
  }
  if (affiliateBaseUrl) {
    const wrapped = new URL(affiliateBaseUrl);
    wrapped.searchParams.set("dl_target_url", original);
    wrapped.searchParams.set("aff_short_key", trackingId);
    wrapped.searchParams.set("tracking_id", trackingId);
    return { url: wrapped.toString(), source: "portal_base", trackingApplied: true };
  }
  const url = new URL(original);
  url.searchParams.set("aff_platform", "portals-promotion");
  url.searchParams.set("aff_trace_key", trackingId);
  return { url: url.toString(), source: "portal", trackingApplied: true };
}

const productUrl = "https://www.aliexpress.com/item/100500123.html";

const missing = build(productUrl, null, null);
if (missing.url !== productUrl || missing.trackingApplied) {
  console.error("FAIL: missing tracking should return original URL", missing);
  process.exit(1);
}

const withId = build(productUrl, "test_tracking_id", null);
if (!withId.trackingApplied || !withId.url.includes("aff_trace_key=test_tracking_id")) {
  console.error("FAIL: tracking id should be applied", withId);
  process.exit(1);
}

const withBase = build(
  productUrl,
  "test_tracking_id",
  "https://s.click.aliexpress.com/deep_link.htm",
);
if (
  !withBase.trackingApplied ||
  withBase.source !== "portal_base" ||
  !withBase.url.includes("aff_short_key=test_tracking_id")
) {
  console.error("FAIL: base URL wrapper expected", withBase);
  process.exit(1);
}

console.log("OK: AliExpress portal affiliate link validation passed");
