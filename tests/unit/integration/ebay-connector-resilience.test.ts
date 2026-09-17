/**
 * Regression tests — resilient eBay connector (retry/backoff + last-known-good).
 *
 * Production bug (verified against live search renders): under the parallel
 * provider fan-out, eBay intermittently rate-limits / times out, collapsing a
 * render to zero eBay results — a healthy window had 37 eBay listings, a
 * degraded window minutes later had 0, letting wrong-gen phones + cases own
 * the top of page 1. The connector must survive a flaky window:
 *
 *   - A live fetch that throws/returns empty must not silently become 0.
 *   - Healthy results are cached per query as short-lived last-known-good.
 *   - On a later flake the cache single-attempt path serves the cached
 *     listings fast (it must NOT burn retry backoff — the engine races every
 *     provider at ~8s, a slow connector gets dropped regardless).
 *   - Cold start (no cache) still gets one bounded retry so a single transient
 *     hit doesn't drop eBay entirely.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { EbayAffiliateClient } from "@/lib/integrations/ebay/client";
import type { EbayRawProduct } from "@/lib/integrations/ebay/types";
import {
  resetEbayLastGoodCacheForTests,
  searchEbayWithClient,
} from "@/lib/search/connectors/ebay";

/** Valid eBay raw product that passes normalizeEbayRaw (numeric id, price, image, URL). */
function rawEbayProduct(overrides: Partial<EbayRawProduct> = {}): EbayRawProduct {
  return {
    itemId: "284393027916",
    title: "Apple iPhone 15 Pro Max 512GB Unlocked Smartphone",
    price: { value: "999.99", currency: "USD" },
    itemWebUrl: "https://www.ebay.com/itm/284393027916",
    itemAffiliateWebUrl:
      "https://www.ebay.com/itm/284393027916?campid=test&customid=zorino-284393027916",
    image: { imageUrl: "https://i.ebayimg.com/images/g/AbC/s-l1600.jpg" },
    buyingOptions: ["FIXED_PRICE"],
    ...overrides,
  };
}

afterEach(() => {
  resetEbayLastGoodCacheForTests();
  vi.restoreAllMocks();
});

describe("eBay connector resilience (retry/backoff + last-known-good)", () => {
  it("returns live listings and caches them as last-known-good", async () => {
    const client = new EbayAffiliateClient();
    const spy = vi.spyOn(client, "searchByKeyword").mockResolvedValue([
      rawEbayProduct(),
      rawEbayProduct({ itemId: "284393027917", title: "Apple iPhone 15 Pro Max 256GB Unlocked" }),
    ]);

    const results = await searchEbayWithClient(client, "iphone 15 pro max");

    expect(results).toHaveLength(2);
    expect(results[0]?.providerId).toBe("ebay");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("serves the fresh last-known-good cache when a later live fetch fails", async () => {
    const client = new EbayAffiliateClient();
    const spy = vi
      .spyOn(client, "searchByKeyword")
      .mockResolvedValueOnce([
        rawEbayProduct(),
        rawEbayProduct({ itemId: "284393027917", title: "Apple iPhone 15 Pro Max 256GB Unlocked" }),
      ])
      .mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"));

    expect(await searchEbayWithClient(client, "iphone 15 pro max")).toHaveLength(2);

    // Flaky window: the live call fails, but the previous genuine eBay
    // listings are served instead of 0.
    const afterFlake = await searchEbayWithClient(client, "iphone 15 pro max");

    expect(afterFlake).toHaveLength(2);
    expect(afterFlake[0]?.title).toContain("iPhone 15 Pro Max");
    // Fresh cache exists → exactly one live attempt, no retry backoff burn.
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("retries once when cold and the first live attempt fails transiently", async () => {
    const client = new EbayAffiliateClient();
    const spy = vi
      .spyOn(client, "searchByKeyword")
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce([rawEbayProduct()]);

    const results = await searchEbayWithClient(client, "iphone 15 pro max");

    expect(results).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("returns [] when cold and every live attempt fails", async () => {
    const client = new EbayAffiliateClient();
    const spy = vi
      .spyOn(client, "searchByKeyword")
      .mockRejectedValue(new Error("unreachable"));

    const results = await searchEbayWithClient(client, "iphone 15 pro max");

    expect(results).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});