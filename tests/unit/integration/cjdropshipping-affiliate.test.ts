/**
 * Fix 4 regression tests — CJdropshipping affiliate pass-through.
 *
 * Root cause: CJdropshipping emits plain/untracked product URLs because its
 * available integration has NO product-level affiliate capability:
 *
 *   - The CJ Affiliate Program (affiliate.cjdropshipping.com) is a MERCHANT
 *     REFERRAL program — the affiliate link tracks referred merchant account
 *     sign-ups (365-day 2% commission), not product purchases.
 *   - The CJ v2.0 product API (/product/list, /product/listV2, /product/query)
 *     returns product data with NO affiliate, promotion-link, or tracking-ID
 *     field.
 *   - The Affiliate Marketing Program Terms §6.2 prohibit modifying referral
 *     links, and §3.2 requires obtaining them from the Affiliate Platform.
 *
 * Implementation (lib/affiliate/cjdropshipping-passthrough.ts) explicitly
 * classifies CJ as non-affiliate / pass-through: the real product URL is the
 * ONLY valid destination, never fabricated tracking. CJ URLs are returned
 * byte-identical; homepage / search / category / malformed / non-CJ URLs are
 * never emitted as affiliate links.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAffiliateUrl } from "@/lib/affiliate/generate";
import {
  buildCjPassThroughUrl,
  classifyCjAffiliateCapability,
  isNonAffiliatePassThroughMarketplace,
} from "@/lib/affiliate/cjdropshipping-passthrough";

const CJ_PRODUCT_URL = "https://cjdropshipping.com/product/anime-game-mouse-p-04A22450-67F0-4617-A132-E7AE7F8963B0.html";
const CJ_PRODUCT_BARE_PID = "https://cjdropshipping.com/product/04A22450-67F0-4617-A132-E7AE7F8963B0.html";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isNonAffiliatePassThroughMarketplace — CJ classification", () => {
  it("classifies cjdropshipping as non-affiliate pass-through", () => {
    expect(isNonAffiliatePassThroughMarketplace("cjdropshipping")).toBe(true);
    expect(isNonAffiliatePassThroughMarketplace("CJDROPSHIPPING")).toBe(true);
    expect(isNonAffiliatePassThroughMarketplace("  cjdropshipping  ")).toBe(true);
  });

  it("does not classify any other marketplace as pass-through", () => {
    for (const slug of [
      "aliexpress",
      "ebay",
      "amazon",
      "walmart",
      "temu",
      "noon",
      "admitad",
      "alibaba",
      "",
    ]) {
      expect(isNonAffiliatePassThroughMarketplace(slug)).toBe(false);
    }
  });

  it("classifies CJ as supporting NO product-level affiliate tracking", () => {
    const capability = classifyCjAffiliateCapability();
    expect(capability.marketplace).toBe("cjdropshipping");
    expect(capability.supportsProductLevelAffiliate).toBe(false);
    expect(capability.mode).toBe("pass-through");
    expect(capability.reason).toMatch(/merchant-referral/);
  });
});

describe("valid real CJ product destination (requirement 1)", () => {
  it("accepts the canonical /product/<slug>-p-<pid>.html form", () => {
    const result = buildCjPassThroughUrl(CJ_PRODUCT_URL);
    expect(result.ok).toBe(true);
  });

  it("accepts the bare /product/<pid>.html form", () => {
    const result = buildCjPassThroughUrl(CJ_PRODUCT_BARE_PID);
    expect(result.ok).toBe(true);
  });
});

describe("missing / unconfigured CJ affiliate configuration (requirement 2)", () => {
  it("passes through without any CJ affiliate env var set", () => {
    vi.stubEnv("CJDROPSHIPPING_API_KEY", "");
    const result = buildCjPassThroughUrl(CJ_PRODUCT_URL);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe(CJ_PRODUCT_URL);
  });

  it("buildAffiliateUrl returns the exact destination when CJ is unconfigured", () => {
    vi.stubEnv("CJDROPSHIPPING_API_KEY", "");
    expect(buildAffiliateUrl({ destinationUrl: CJ_PRODUCT_URL, storeSlug: "cjdropshipping" })).toBe(
      CJ_PRODUCT_URL,
    );
    expect(buildAffiliateUrl({ destinationUrl: CJ_PRODUCT_URL })).toBe(CJ_PRODUCT_URL);
  });
});

describe("prevention of fabricated tracking parameters (requirement 3)", () => {
  it("never appends tracking/affiliate/referral params to a CJ URL", () => {
    const result = buildCjPassThroughUrl(CJ_PRODUCT_URL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).not.toContain("aff=");
      expect(result.url).not.toContain("ref=");
      expect(result.url).not.toContain("pid=");
      expect(result.url).not.toContain("tracking");
      expect(result.url).not.toContain("affiliate");
      expect(result.url).not.toContain("zorino_ref");
    }
  });

  it("buildAffiliateUrl does not fabricate tracking even with placeholder env values", () => {
    vi.stubEnv("CJDROPSHIPPING_API_KEY", "test");
    const result = buildAffiliateUrl({
      destinationUrl: CJ_PRODUCT_URL,
      storeSlug: "cjdropshipping",
      partnerTag: "fake-cj-affiliate-id",
    });
    expect(result).toBe(CJ_PRODUCT_URL);
    expect(result).not.toContain("?");
  });

  it("explicit classification declares no fabricated capability", () => {
    const capability = classifyCjAffiliateCapability();
    expect(capability.supportsProductLevelAffiliate).toBe(false);
    expect(capability.mode).toBe("pass-through");
  });
});

describe("homepage / search / category never treated as product destinations (requirement 4)", () => {
  it("rejects the CJ homepage", () => {
    for (const url of [
      "https://cjdropshipping.com/",
      "https://cjdropshipping.com",
      "https://www.cjdropshipping.com/",
    ]) {
      const result = buildCjPassThroughUrl(url);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("non-product-destination");
    }
  });

  it("rejects search / category / landing pages", () => {
    for (const url of [
      "https://cjdropshipping.com/search?keyword=mouse",
      "https://cjdropshipping.com/category/electronics",
      "https://cjdropshipping.com/articles/cj-affiliate-program",
      "https://cjdropshipping.com/shopping.html",
    ]) {
      expect(buildCjPassThroughUrl(url).ok).toBe(false);
    }
  });

  it("buildAffiliateUrl never converts a non-product CJ URL into a tracked link", () => {
    const homepage = buildAffiliateUrl({ destinationUrl: "https://cjdropshipping.com/", storeSlug: "cjdropshipping" });
    expect(homepage).toBe("https://cjdropshipping.com/");
    expect(homepage).not.toContain("aff=");
  });
});

describe("exact CJ product URL preservation (requirement 5)", () => {
  it("preserves the product URL byte-identical including existing query params", () => {
    const withQuery = `${CJ_PRODUCT_URL}?source=test&utm=v1`;
    const result = buildCjPassThroughUrl(withQuery);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe(withQuery);
  });

  it("preserves uppercase pid / slug characters", () => {
    const mixed = "https://cjdropshipping.com/product/Anime-Game-Mouse-p-04A22450-67F0.html";
    const result = buildCjPassThroughUrl(mixed);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe(mixed);
  });

  it("buildAffiliateUrl returns the exact destination untouched", () => {
    const withQuery = `${CJ_PRODUCT_URL}?gad_source=1&pdp_npi=1`;
    expect(buildAffiliateUrl({ destinationUrl: withQuery, storeSlug: "cjdropshipping" })).toBe(withQuery);
  });
});

describe("already-tracked / affiliate CJ URLs (requirement 6)", () => {
  it("treats CJ URLs carrying affiliate-looking params as pass-through anyway (CJ provides no product-level affiliate scheme)", () => {
    const withAffParams = `${CJ_PRODUCT_URL}?aff=unknown&tracking=123`;
    const result = buildCjPassThroughUrl(withAffParams);
    // CJ has no real per-product affiliate scheme — the URL passes through
    // unchanged rather than being re-tagged or stripped.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe(withAffParams);
  });

  it("does not double-wrap CJ URLs that look already-tracked", () => {
    const looksTracked = "https://cjdropshipping.com/product/x-p-123.html?ref=abc";
    expect(buildAffiliateUrl({ destinationUrl: looksTracked, storeSlug: "cjdropshipping" })).toBe(looksTracked);
  });
});

describe("malformed / invalid CJ URLs (requirement 7)", () => {
  it("rejects empty and blank destinations", () => {
    expect(buildCjPassThroughUrl("").ok).toBe(false);
    expect(buildCjPassThroughUrl("   ").ok).toBe(false);
  });

  it("rejects unparseable input", () => {
    const r = buildCjPassThroughUrl("not a url");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("malformed-url");
  });

  it("rejects non-https CJ URLs", () => {
    const r = buildCjPassThroughUrl("http://cjdropshipping.com/product/x-p-123.html");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not-https");
  });

  it("rejects non-CJ hosts even with a product-looking path", () => {
    const r = buildCjPassThroughUrl("https://watchman.com/product/anime-games-p-22.html");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("non-cj-host");
  });

  it("buildAffiliateUrl leaves malformed input untouched (no fabrication, no crash)", () => {
    expect(buildAffiliateUrl({ destinationUrl: "not a url", storeSlug: "cjdropshipping" })).toBe("not a url");
  });
});

describe("safe passthrough when CJ has no affiliate capability (requirement 8)", () => {
  it("buildCjPassThroughUrl reports trackingApplied=false for valid products", () => {
    const result = buildCjPassThroughUrl(CJ_PRODUCT_URL);
    if (result.ok) expect(result.trackingApplied).toBe(false);
  });

  it("sync-style buildAffiliateUrl passes the product through cleanly", () => {
    vi.stubEnv("CJDROPSHIPPING_API_KEY", "real-key");
    expect(buildAffiliateUrl({ destinationUrl: CJ_PRODUCT_URL, storeSlug: "cjdropshipping" })).toBe(CJ_PRODUCT_URL);
  });

  it("classification declares explicitly: affiliate tracking NOT supported", () => {
    const capability = classifyCjAffiliateCapability();
    expect(capability.supportsProductLevelAffiliate).toBe(false);
    expect(capability.mode).toBe("pass-through");
    expect(capability.reason.length).toBeGreaterThan(50);
  });
});