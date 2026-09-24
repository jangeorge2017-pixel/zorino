import { describe, expect, it } from "vitest";
import { fetchAmazonSearchScraper, fetchAmazonProductScraper } from "@/lib/integrations/amazon-scraper/client";

// Live-network verification for the Amazon storefront scraper. Skipped by
// default (unit run, CI) — enable with RUN_AMAZON_LIVE=1. Verifies against the
// REAL Amazon ht: real products, price > 0, http image, provider URL intact.
const live = process.env.RUN_AMAZON_LIVE === "1";

describe.skipIf(!live)("amazon scraper live", () => {
  it("fetches a real product page by ASIN", async () => {
    const p = await fetchAmazonProductScraper("B0CMSYHFCF", "amazon-storefront");
    expect(p).not.toBeNull();
    expect(p?.asin).toBe("B0CMSYHFCF");
    expect(p?.title).toMatch(/iPhone 15/i);
    expect(p?.price).toBeGreaterThan(0);
    expect(p?.imageUrl).toMatch(/^https:\/\/m\.media-amazon\.com\/images\/I\//);
    expect(p?.productUrl).toContain("/dp/B0CMSYHFCF");
  }, 60000);

  it("searches the US storefront", async () => {
    const r = await fetchAmazonSearchScraper("iPhone 15", "amazon-storefront");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]!.productUrl).toContain("amazon.com");
    expect(r[0]!.title).toMatch(/iPhone/i);
    expect(r[0]!.price).toBeGreaterThan(0);
  }, 60000);

  it("searches amazon.co.uk (may be geo-blocked -> returns [] gracefully)", async () => {
    const r = await fetchAmazonSearchScraper("iPhone 15", "amazon-co-uk");
    // amazon.co.uk serves an AWS WAF JS challenge to non-UK IPs (HTTP 202).
    // A valid response must keep provider identity intact; an empty result is
    // the graceful degradation the connector relies on (US results still flow).
    for (const item of r) {
      expect(item.productUrl).toContain("amazon.co.uk");
      expect(item.title).toMatch(/iPhone/i);
    }
  }, 60000);

  it("searches amazon.eg", async () => {
    const r = await fetchAmazonSearchScraper("iPhone 15", "amazon-eg");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]!.productUrl).toContain("amazon.eg");
    expect(r[0]!.title).toMatch(/iPhone/i);
  }, 60000);
});