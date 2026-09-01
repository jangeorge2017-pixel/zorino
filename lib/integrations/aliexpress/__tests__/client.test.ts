import { describe, it, expect, vi, beforeEach } from "vitest";
import { AliExpressAffiliateClient } from "@/lib/integrations/aliexpress/client";

// Mock dependencies
vi.mock("@/lib/integrations/aliexpress/config", () => ({
  ALIEXPRESS_API_URL: "https://api.aliexpress.com/openapi",
}));

vi.mock("@/lib/integrations/aliexpress/auth", () => ({
  buildSignedParams: vi.fn((method, appKey, appSecret, bizParams) => ({
    ...bizParams,
    method,
  })),
}));

vi.mock("@/lib/integrations/aliexpress/logger", () => ({
  logAliExpress: vi.fn(),
  maskSecret: (s: string) => s?.substring(0, 3) + "***",
  redactRequestForLog: (params: any) => params,
}));

describe("Bug Fix: AliExpress - Nested promotion_links Response Handling", () => {
  let client: AliExpressAffiliateClient;
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AliExpressAffiliateClient("test-key", "test-secret", "test-tracking-id");
    fetchSpy = vi.spyOn(global, "fetch" as any);
  });

  it("should handle standard flat promotion_links array response", async () => {
    const sourceUrls = ["https://aliexpress.com/item/123", "https://aliexpress.com/item/456"];

    const responseBody = JSON.stringify({
      aliexpress_affiliate_link_generate_response: {
        resp_result: {
          result: {
            promotion_links: [
              {
                source_value: "https://aliexpress.com/item/123",
                promotion_link: "https://s.click.aliexpress.com/e/abc123",
              },
              {
                source_value: "https://aliexpress.com/item/456",
                promotion_link: "https://s.click.aliexpress.com/e/def456",
              },
            ],
          },
        },
      },
    });

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn().mockResolvedValue(responseBody),
    });

    const result = await client.generatePromotionLinks(sourceUrls);

    expect(result.size).toBe(2);
    expect(result.get("https://aliexpress.com/item/123")).toBe(
      "https://s.click.aliexpress.com/e/abc123"
    );
    expect(result.get("https://aliexpress.com/item/456")).toBe(
      "https://s.click.aliexpress.com/e/def456"
    );
  });

  it("should handle nested promotion_links response structure (result.promotion_links.promotion_link[])", async () => {
    const sourceUrls = ["https://aliexpress.com/item/123"];

    // This is the nested response structure that was causing the bug
    const responseBody = JSON.stringify({
      aliexpress_affiliate_link_generate_response: {
        resp_result: {
          result: {
            promotion_links: {
              promotion_link: [
                {
                  source_value: "https://aliexpress.com/item/123",
                  promotion_link: "https://s.click.aliexpress.com/e/abc123",
                },
              ],
            },
          },
        },
      },
    });

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn().mockResolvedValue(responseBody),
    });

    const result = await client.generatePromotionLinks(sourceUrls);

    // CRITICAL: Should successfully extract the nested array
    expect(result.size).toBe(1);
    expect(result.get("https://aliexpress.com/item/123")).toBe(
      "https://s.click.aliexpress.com/e/abc123"
    );
  });

  it("should handle empty promotion_links response gracefully", async () => {
    const sourceUrls = ["https://aliexpress.com/item/123"];

    const responseBody = JSON.stringify({
      aliexpress_affiliate_link_generate_response: {
        resp_result: {
          result: {
            promotion_links: [],
          },
        },
      },
    });

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn().mockResolvedValue(responseBody),
    });

    const result = await client.generatePromotionLinks(sourceUrls);

    expect(result.size).toBe(0);
  });

  it("should skip entries with missing source_value or promotion_link", async () => {
    const sourceUrls = ["https://aliexpress.com/item/123", "https://aliexpress.com/item/456"];

    const responseBody = JSON.stringify({
      aliexpress_affiliate_link_generate_response: {
        resp_result: {
          result: {
            promotion_links: [
              {
                source_value: "https://aliexpress.com/item/123",
                promotion_link: "https://s.click.aliexpress.com/e/abc123",
              },
              {
                // Missing promotion_link - should be skipped
                source_value: "https://aliexpress.com/item/456",
              },
              {
                // Missing source_value - should be skipped
                promotion_link: "https://s.click.aliexpress.com/e/def456",
              },
            ],
          },
        },
      },
    });

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn().mockResolvedValue(responseBody),
    });

    const result = await client.generatePromotionLinks(sourceUrls);

    // Only the first complete entry should be included
    expect(result.size).toBe(1);
    expect(result.get("https://aliexpress.com/item/123")).toBe(
      "https://s.click.aliexpress.com/e/abc123"
    );
  });

  it("should return empty map when tracking ID is missing", async () => {
    const clientNoTracking = new AliExpressAffiliateClient("test-key", "test-secret");

    const result = await clientNoTracking.generatePromotionLinks([
      "https://aliexpress.com/item/123",
    ]);

    expect(result.size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should handle malformed JSON response", async () => {
    const sourceUrls = ["https://aliexpress.com/item/123"];

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn().mockResolvedValue("invalid json"),
    });

    await expect(client.generatePromotionLinks(sourceUrls)).rejects.toThrow(
      /non-JSON body/
    );
  });

  it("should handle API error response", async () => {
    const sourceUrls = ["https://aliexpress.com/item/123"];

    const responseBody = JSON.stringify({
      aliexpress_affiliate_link_generate_response: {
        error_response: {
          code: "27",
          msg: "Invalid app key",
          request_id: "req-123",
        },
      },
    });

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn().mockResolvedValue(responseBody),
    });

    await expect(client.generatePromotionLinks(sourceUrls)).rejects.toThrow(
      /error_response/
    );
  });

  it("should retry on transient errors (rate limit)", async () => {
    const sourceUrls = ["https://aliexpress.com/item/123"];

    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: vi.fn().mockResolvedValue("Rate limit exceeded"),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: vi.fn().mockResolvedValue("Rate limit exceeded"),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: vi.fn().mockResolvedValue("Rate limit exceeded"),
      });

    await expect(client.generatePromotionLinks(sourceUrls)).rejects.toThrow(
      /rate limit/
    );

    // Should have attempted 3 times (max attempts)
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
