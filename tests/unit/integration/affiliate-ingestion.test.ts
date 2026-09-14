/**
 * Affiliate URL ingestion engine tests (Phase 5).
 *
 * Focus: the engine is provider-agnostic (routes by detected product FORMAT,
 * never by provider id), the built-in ASIN extraction is host-guarded
 * (Amazon identifiers never fire on another network's URLs), malformed /
 * missing affiliate URLs degrade gracefully, and real product data is never
 * fabricated.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectProductFromUrl,
  extractAmazonAsin,
  getExtractionStrategy,
  isAmazonHost,
  processSource,
  registerExtractionStrategy,
  resetExtractionStrategiesForTests,
  resolveRedirect,
  type ProviderIngestionSource,
} from "@/lib/integration/affiliate-ingestion";

const source = (
  affiliateUrl: string,
  providerId = "admitad",
): ProviderIngestionSource => ({
  providerId,
  name: providerId,
  slug: providerId,
  urls: [{ id: "s1", affiliateUrl }],
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetExtractionStrategiesForTests();
});

describe("isAmazonHost — host guard", () => {
  it("accepts Amazon properties and rejects other store hosts", () => {
    expect(isAmazonHost("https://www.amazon.com/dp/B0ABCDEFGH")).toBe(true);
    expect(isAmazonHost("https://amazon.com/dp/B0ABCDEFGH")).toBe(true);
    expect(isAmazonHost("https://www.amazon.co.uk/dp/B0ABCDEFGH")).toBe(true);
    expect(isAmazonHost("https://www.ebay.com/itm/12345")).toBe(false);
    expect(isAmazonHost("https://ad.admitad.com/g/x/")).toBe(false);
    expect(isAmazonHost("https://www.aliexpress.com/item/x.html")).toBe(false);
  });

  it("returns false for unparseable URLs", () => {
    expect(isAmazonHost("")).toBe(false);
    expect(isAmazonHost("not a url")).toBe(false);
  });
});

describe("detectProductFromUrl — product-format detection (no provider forks)", () => {
  it("detects asin, ebay-item and product-slug formats neutrally", () => {
    expect(detectProductFromUrl("https://www.amazon.com/dp/B0ABCDEFGH/")).toEqual({
      found: true,
      productId: "B0ABCDEFGH",
      productType: "asin",
    });
    expect(detectProductFromUrl("https://www.ebay.com/itm/142845647293")).toEqual({
      found: true,
      productId: "142845647293",
      productType: "ebay-item",
    });
    expect(detectProductFromUrl("https://www.example.com/products/gaming-mouse")).toEqual({
      found: true,
      productId: "gaming-mouse",
      productType: "product-slug",
    });
  });

  it("handles malformed or empty URLs gracefully", () => {
    expect(detectProductFromUrl("")).toEqual({ found: false, reason: "Invalid URL" });
    expect(detectProductFromUrl("not a url at all")).toEqual({ found: false, reason: "Invalid URL" });
    expect(detectProductFromUrl("http://")).toEqual({ found: false, reason: "Invalid URL" });
    expect(detectProductFromUrl("http://exa mple.com/path")).toEqual({ found: false, reason: "Invalid URL" });
    expect(detectProductFromUrl("https://www.example.com/")).toEqual({
      found: false,
      reason: "No product identifier detected in URL",
    });
  });
});

describe("extractAmazonAsin — host-guarded strategy", () => {
  it("returns null for a non-asin format without touching the network", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("must not call the network"));
    const item = await extractAmazonAsin(
      { found: true, productId: "142845647293", productType: "ebay-item" },
      "https://ad.admitad.com/g/x",
      "https://www.amazon.com/dp/B0ABCDEFGH",
    );
    expect(item).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("is host-guarded: a non-Amazon destination never reaches the Amazon API", async () => {
    const item = await extractAmazonAsin(
      { found: true, productId: "B0ABCDEFGH", productType: "asin" },
      "https://ad.admitad.com/g/x",
      "https://www.ebay.com/dp/B0ABCDEFGH",
    );
    expect(item).toBeNull();
  });
});

describe("processSource — engine-level behavior", () => {
  it("routes extraction by detected FORMAT, never by provider id", async () => {
    resetExtractionStrategiesForTests();
    const calls: string[] = [];
    registerExtractionStrategy("ebay-item", async () => {
      calls.push("ebay-item");
      return null;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ url: "https://www.ebay.com/itm/142845647293" })),
    );

    // The source is an Admitad (indirect) source — yet the engine routes to
    // the ebay-item FORMAT strategy because DETECTION is format-driven.
    const entries = await processSource(source("https://ad.admitad.com/g/a4123/"));
    expect(calls).toEqual(["ebay-item"]);
    expect(entries[0].detection).toEqual({
      found: true,
      productId: "142845647293",
      productType: "ebay-item",
    });
    expect(entries[0].catalogItem).toBeNull();
  });

  it("built-in ASIN extraction cannot fire on another network's resolved URL", async () => {
    resetExtractionStrategiesForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ url: "https://www.ebay.com/dp/B0ABCDEFGH" })),
    );

    const entries = await processSource(source("https://ad.admitad.com/g/a1/"));
    expect(entries[0].detection).toEqual({
      found: true,
      productId: "B0ABCDEFGH",
      productType: "asin",
    });
    // Host guard stopped the ASIN strategy — no cross-network extraction.
    expect(entries[0].catalogItem).toBeNull();
  });

  it("a missing affiliate URL is recorded as destination-only, never a product", async () => {
    const entries = await processSource(source(""));
    expect(entries).toHaveLength(1);
    expect(entries[0].resolvedUrl).toBe("");
    expect(entries[0].detection).toEqual({ found: false, reason: "Invalid URL" });
    expect(entries[0].catalogItem).toBeNull();
  });

  it("reset + built-in re-registration happens as a unit (flag and map agree)", async () => {
    resetExtractionStrategiesForTests();
    expect(getExtractionStrategy("asin")).toBeUndefined();
    expect(getExtractionStrategy("ebay-item")).toBeUndefined();

    resetExtractionStrategiesForTests();
    registerExtractionStrategy("ebay-item", async () => null);
    expect(getExtractionStrategy("ebay-item")).toBeDefined();
  });
});

describe("resolveRedirect — failure isolation on URL resolution", () => {
  it("returns the original URL when resolution fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network down")),
    );
    await expect(resolveRedirect("https://www.example.com/p")).resolves.toBe(
      "https://www.example.com/p",
    );
  });

  it("returns the final destination URL from a redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ url: "https://www.amazon.com/dp/B0ABCDEFGH" })),
    );
    await expect(resolveRedirect("https://ad.admitad.com/g/a1/")).resolves.toBe(
      "https://www.amazon.com/dp/B0ABCDEFGH",
    );
  });
});