/**
 * Unit tests — provider → global multi-store mapping.
 *
 * Every live import provider must write its real store identity into
 * `product_offers` and a collision-safe `products.global_sku`.
 */
import { describe, expect, it } from "vitest";

import {
  buildProviderGlobalSku,
  getProviderGlobalOfferIdentity,
  GLOBAL_OFFER_COUNTRY_CODE,
} from "@/lib/sync/import/global-catalog";

describe("buildProviderGlobalSku", () => {
  it("keeps AliExpress bare ids for continuity with existing rows", () => {
    expect(buildProviderGlobalSku("aliexpress", { externalId: "100500123" })).toBe(
      "100500123",
    );
  });

  it("namespaces every other provider so numeric ids cannot collide", () => {
    expect(buildProviderGlobalSku("ebay", { externalId: "123456789" })).toBe(
      "ebay:123456789",
    );
    expect(buildProviderGlobalSku("amazon", { externalId: "B0ABC123" })).toBe(
      "amazon:B0ABC123",
    );
    expect(buildProviderGlobalSku("cjdropshipping", { externalId: "987654" })).toBe(
      "cjdropshipping:987654",
    );
  });

  it("uses a real barcode/GTIN across providers when the feed supplies one", () => {
    expect(
      buildProviderGlobalSku("ebay", { externalId: "123", barcode: " 4006381333931 " }),
    ).toBe("ebay:gtin:4006381333931");
    expect(
      buildProviderGlobalSku("aliexpress", { externalId: "456", barcode: "4006381333931" }),
    ).toBe("aliexpress:gtin:4006381333931");
  });

  it("rejects an empty external id instead of writing a fake SKU", () => {
    expect(() => buildProviderGlobalSku("ebay", { externalId: "  " })).toThrow(
      /external id is empty/,
    );
  });
});

describe("getProviderGlobalOfferIdentity", () => {
  it("uses the canonical store display name per provider", () => {
    expect(getProviderGlobalOfferIdentity("ebay", "ebay")).toEqual({
      storeName: "eBay",
      networkName: "Direct",
      countryCode: GLOBAL_OFFER_COUNTRY_CODE,
    });
    expect(getProviderGlobalOfferIdentity("amazon", "amazon-eg")).toEqual({
      storeName: "Amazon Egypt",
      networkName: "Direct",
      countryCode: GLOBAL_OFFER_COUNTRY_CODE,
    });
    expect(getProviderGlobalOfferIdentity("cjdropshipping", "cjdropshipping")).toEqual({
      storeName: "CJdropshipping",
      networkName: "Direct",
      countryCode: GLOBAL_OFFER_COUNTRY_CODE,
    });
  });

  it("falls back to the provider id when the store slug is generic", () => {
    expect(getProviderGlobalOfferIdentity("temu", "default").storeName).toBe("Temu");
  });

  it("honours an explicit market country for network offers", () => {
    expect(getProviderGlobalOfferIdentity("admitad", "admitad", "EG").countryCode).toBe(
      "EG",
    );
  });
});
