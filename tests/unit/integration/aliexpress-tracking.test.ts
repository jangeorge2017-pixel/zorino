/**
 * Fix 3 regression tests — AliExpress affiliate tracking.
 *
 * Root cause: `ALIEXPRESS_TRACKING_ID` was set to a placeholder value
 * ("default") in production and every AliExpress Shop link was emitted as
 * `aff_trace_key=default` — a fake tracked URL that tracks nobody. The old
 * builders only rejected an EMPTY tracking id, not placeholder / default /
 * test values, and blindly re-tagged URLs that were already tracked.
 *
 * Guards under test (lib/affiliate/aliexpress-tracking.ts):
 *   1. Credibility — placeholder/default/test tracking ids are treated as
 *      unconfigured → fail safe back to the real product URL.
 *   2. Already-tracked — URLs carrying AliExpress tracking params (or
 *      s.click deep-links) are never double-tagged.
 *
 * Both `buildAffiliateUrl` and `buildAliExpressPortalAffiliateLink` use the
 * guards so Search, Sync, Compare and the portal provider share one behavior.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAffiliateUrl } from "@/lib/affiliate/generate";
import {
  buildAliExpressPortalAffiliateLink,
  buildAliExpressPortalAffiliateLinkFromEnv,
} from "@/lib/affiliate/providers/aliexpress/portal-links";
import {
  isAlreadyTrackedAliExpressUrl,
  isCredibleAliExpressTrackingId,
} from "@/lib/affiliate/aliexpress-tracking";
import type { AliExpressPortalConfig } from "@/lib/affiliate/providers/aliexpress/portal-config";

const PRODUCT_URL = "https://www.aliexpress.com/item/3256812569446806.html";
const CREDIBLE_ID = "k3Y9pQ2wZ8x";

const validConfig = (overrides?: Partial<AliExpressPortalConfig>): AliExpressPortalConfig => ({
  trackingId: CREDIBLE_ID,
  affiliateBaseUrl: null,
  configured: true,
  warnings: [],
  ...overrides,
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isCredibleAliExpressTrackingId — placeholder guard", () => {
  it("accepts a real-looking configured tracking id", () => {
    expect(isCredibleAliExpressTrackingId(CREDIBLE_ID)).toBe(true);
    expect(isCredibleAliExpressTrackingId("  abc123def  ")).toBe(true);
  });

  it("rejects empty / missing tracking ids", () => {
    expect(isCredibleAliExpressTrackingId(null)).toBe(false);
    expect(isCredibleAliExpressTrackingId(undefined)).toBe(false);
    expect(isCredibleAliExpressTrackingId("")).toBe(false);
    expect(isCredibleAliExpressTrackingId("   ")).toBe(false);
  });

  it("rejects placeholder / default / test tracking ids (case-insensitive)", () => {
    for (const placeholder of [
      "default",
      "test",
      "placeholder",
      "example",
      "none",
      "xxx",
      "your_aliexpress_tracking_id",
      "insert",
      "change_me",
      "set_me",
      "here",
      "DEFAULT",
      "  default  ",
    ]) {
      expect(isCredibleAliExpressTrackingId(placeholder)).toBe(false);
    }
  });
});

describe("isAlreadyTrackedAliExpressUrl — no double-tagging", () => {
  it("detects explicit AliExpress tracking params", () => {
    expect(
      isAlreadyTrackedAliExpressUrl(`${PRODUCT_URL}?aff_platform=portals-promotion&aff_trace_key=abc`),
    ).toBe(true);
    expect(isAlreadyTrackedAliExpressUrl(`${PRODUCT_URL}?affd=1`)).toBe(true);
    expect(isAlreadyTrackedAliExpressUrl(`${PRODUCT_URL}?tracking_id=abc`)).toBe(true);
    expect(isAlreadyTrackedAliExpressUrl(`${PRODUCT_URL}?aff_short_key=abc`)).toBe(true);
    expect(isAlreadyTrackedAliExpressUrl(`${PRODUCT_URL}?dl_target_url=${encodeURIComponent(PRODUCT_URL)}`)).toBe(true);
  });

  it("detects s.click.aliexpress.com click deep-links", () => {
    expect(isAlreadyTrackedAliExpressUrl("https://s.click.aliexpress.com/e/_AbCdEf")).toBe(true);
  });

  it("returns false for untracked product URLs and unparseable input", () => {
    expect(isAlreadyTrackedAliExpressUrl(PRODUCT_URL)).toBe(false);
    expect(isAlreadyTrackedAliExpressUrl("https://www.aliexpress.com/w/wholesale-games.html")).toBe(false);
    expect(isAlreadyTrackedAliExpressUrl("not a url")).toBe(false);
  });
});

describe("buildAffiliateUrl — AliExpress branch", () => {
  it("applies configured tracking params to a real product URL", () => {
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", CREDIBLE_ID);
    const url = new URL(buildAffiliateUrl({ destinationUrl: PRODUCT_URL, storeSlug: "aliexpress" }));
    expect(url.origin + url.pathname).toBe(PRODUCT_URL);
    expect(url.searchParams.get("aff_platform")).toBe("portals-promotion");
    expect(url.searchParams.get("aff_trace_key")).toBe(CREDIBLE_ID);
    expect(url.searchParams.has("affd")).toBe(false);
  });

  it("fails safe to the original URL when tracking is unconfigured", () => {
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", "");
    expect(buildAffiliateUrl({ destinationUrl: PRODUCT_URL, storeSlug: "aliexpress" })).toBe(PRODUCT_URL);
  });

  it("fails safe to the original URL for placeholder/default/test tracking ids", () => {
    for (const placeholder of ["default", "test", "placeholder", "example", "none", "xxx"]) {
      vi.stubEnv("ALIEXPRESS_TRACKING_ID", placeholder);
      const result = buildAffiliateUrl({ destinationUrl: PRODUCT_URL, storeSlug: "aliexpress" });
      expect(result).toBe(PRODUCT_URL);
      expect(result).not.toContain("aff_trace_key");
    }
  });

  it("never emits a tracked link for a non-product destination", () => {
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", CREDIBLE_ID);
    const homepage = buildAffiliateUrl({ destinationUrl: "https://www.aliexpress.com/", storeSlug: "aliexpress" });
    const category = buildAffiliateUrl({ destinationUrl: "https://www.aliexpress.com/w/wholesale-games.html", storeSlug: "aliexpress" });
    expect(homepage).toBe("https://www.aliexpress.com/");
    expect(category).toBe("https://www.aliexpress.com/w/wholesale-games.html");
    expect(homepage).not.toContain("aff_trace_key");
    expect(category).not.toContain("aff_trace_key");
  });

  it("preserves an already-tracked URL untouched", () => {
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", CREDIBLE_ID);
    const tracked = `${PRODUCT_URL}?aff_platform=portals-promotion&aff_trace_key=existing`;
    expect(buildAffiliateUrl({ destinationUrl: tracked, storeSlug: "aliexpress" })).toBe(tracked);
    expect(buildAffiliateUrl({ destinationUrl: "https://s.click.aliexpress.com/e/_AbCdEf", storeSlug: "aliexpress" })).toBe(
      "https://s.click.aliexpress.com/e/_AbCdEf",
    );
  });

  it("falls back to the original URL for a malformed destination", () => {
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", CREDIBLE_ID);
    expect(buildAffiliateUrl({ destinationUrl: "not a url", storeSlug: "aliexpress" })).toBe("not a url");
    expect(buildAffiliateUrl({ destinationUrl: "", storeSlug: "aliexpress" })).toBe("");
  });

  it("uses ALIEXPRESS_AFFILIATE_BASE_URL wrap while preserving the exact product destination", () => {
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", CREDIBLE_ID);
    vi.stubEnv("ALIEXPRESS_AFFILIATE_BASE_URL", "https://portal-aliexpress.example/click");
    const wrapped = new URL(
      buildAffiliateUrl({ destinationUrl: PRODUCT_URL, storeSlug: "aliexpress" }),
    );
    expect(wrapped.hostname).toBe("portal-aliexpress.example");
    expect(wrapped.searchParams.get("dl_target_url")).toBe(PRODUCT_URL);
    expect(wrapped.searchParams.get("aff_short_key")).toBe(CREDIBLE_ID);
    expect(wrapped.searchParams.get("tracking_id")).toBe(CREDIBLE_ID);
  });

  it("does not emit a tracked wrapped link for a placeholder id even with a base URL", () => {
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", "default");
    vi.stubEnv("ALIEXPRESS_AFFILIATE_BASE_URL", "https://portal-aliexpress.example/click");
    expect(buildAffiliateUrl({ destinationUrl: PRODUCT_URL, storeSlug: "aliexpress" })).toBe(PRODUCT_URL);
  });
});

describe("buildAliExpressPortalAffiliateLink — portal provider", () => {
  it("applies configured tracking params to a real product URL", () => {
    const result = buildAliExpressPortalAffiliateLink(PRODUCT_URL, validConfig());
    expect(result.trackingApplied).toBe(true);
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(PRODUCT_URL);
    expect(url.searchParams.get("aff_platform")).toBe("portals-promotion");
    expect(url.searchParams.get("aff_trace_key")).toBe(CREDIBLE_ID);
  });

  it("fails safe to the original URL when tracking is unconfigured", () => {
    const result = buildAliExpressPortalAffiliateLink(PRODUCT_URL, validConfig({ trackingId: null }));
    expect(result).toMatchObject({ url: PRODUCT_URL, source: "original", trackingApplied: false });
  });

  it("fails safe to the original URL for placeholder/default/test tracking ids", () => {
    for (const placeholder of ["default", "test", "placeholder", "example", "none", "xxx"]) {
      const result = buildAliExpressPortalAffiliateLink(PRODUCT_URL, validConfig({ trackingId: placeholder }));
      expect(result).toMatchObject({ url: PRODUCT_URL, source: "original", trackingApplied: false });
      expect(result.url).not.toContain("aff_trace_key");
    }
  });

  it("never tags a non-product destination", () => {
    const result = buildAliExpressPortalAffiliateLink(
      "https://www.aliexpress.com/",
      validConfig(),
    );
    expect(result).toMatchObject({ url: "https://www.aliexpress.com/", trackingApplied: false });
  });

  it("preserves an already-tracked URL untouched", () => {
    const tracked = `${PRODUCT_URL}?aff_platform=portals-promotion&aff_trace_key=existing`;
    const result = buildAliExpressPortalAffiliateLink(tracked, validConfig());
    expect(result).toMatchObject({ url: tracked, trackingApplied: false });
  });

  it("falls back to the original URL for malformed input", () => {
    const result = buildAliExpressPortalAffiliateLink("not a url", validConfig());
    expect(result).toMatchObject({ url: "not a url", trackingApplied: false });
  });

  it("uses ALIEXPRESS_AFFILIATE_BASE_URL wrap while preserving the exact product destination", () => {
    const result = buildAliExpressPortalAffiliateLink(
      PRODUCT_URL,
      validConfig({ affiliateBaseUrl: "https://portal-aliexpress.example/click" }),
    );
    const wrapped = new URL(result.url);
    expect(wrapped.hostname).toBe("portal-aliexpress.example");
    expect(wrapped.searchParams.get("dl_target_url")).toBe(PRODUCT_URL);
    expect(wrapped.searchParams.get("aff_short_key")).toBe(CREDIBLE_ID);
    expect(wrapped.searchParams.get("tracking_id")).toBe(CREDIBLE_ID);
    expect(result.source).toBe("portal_base");
  });

  it("reads placeholder env as unconfigured through the env convenience path", () => {
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", "default");
    const result = buildAliExpressPortalAffiliateLinkFromEnv(PRODUCT_URL);
    expect(result).toMatchObject({ url: PRODUCT_URL, trackingApplied: false });
    expect(result.url).not.toContain("aff_trace_key=default");
  });

  it("reads a credible env tracking id through the env convenience path", () => {
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", CREDIBLE_ID);
    const result = buildAliExpressPortalAffiliateLinkFromEnv(PRODUCT_URL);
    expect(result.trackingApplied).toBe(true);
    expect(result.url).toContain(`aff_trace_key=${CREDIBLE_ID}`);
  });
});

describe("product destination preservation (requirement 6)", () => {
  it("keeps the exact host + path of the AliExpress product URL when tagging", () => {
    const withQuery = `${PRODUCT_URL}?pdp_npi=6%40dis%21USD%21364.89%21113.12`;
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", CREDIBLE_ID);
    const url = new URL(buildAffiliateUrl({ destinationUrl: withQuery, storeSlug: "aliexpress" }));
    expect(url.origin + url.pathname).toBe(PRODUCT_URL);
    expect(url.searchParams.get("pdp_npi")).toBe("6@dis!USD!364.89!113.12");
    expect(url.searchParams.get("aff_trace_key")).toBe(CREDIBLE_ID);
  });

  it("never converts a valid product URL into a homepage / search / category URL", () => {
    vi.stubEnv("ALIEXPRESS_TRACKING_ID", CREDIBLE_ID);
    const result = buildAffiliateUrl({ destinationUrl: PRODUCT_URL, storeSlug: "aliexpress" });
    const url = new URL(result);
    expect(url.hostname).toBe("www.aliexpress.com");
    expect(/^\/(item|i)\//.test(url.pathname)).toBe(true);
    expect(url.searchParams.get("aff_trace_key")).toBe(CREDIBLE_ID);
  });
});