/**
 * Store + Provider Registry integration tests (Phase 1).
 */
import { describe, expect, it } from "vitest";

import {
  getCanonicalStoreName,
  isRegisteredProviderId,
  providerAcquisitionMode,
  providerSupportedCurrencies,
  resolveCanonicalStore,
} from "@/lib/canonical";

describe("resolveCanonicalStore", () => {
  it("resolves a registered single-store provider from display metadata", () => {
    const store = resolveCanonicalStore("aliexpress");
    expect(store.storeId).toBe("store-aliexpress");
    expect(store.name).toBe("AliExpress");
    expect(store.nameSource).toBe("registry");
    expect(store.isMerchant).toBe(false);
  });

  it("resolves a provider with no display metadata to a provider-derived name", () => {
    const store = resolveCanonicalStore("admitad");
    expect(store.nameSource).toBe("registry");
    expect(store.name.length).toBeGreaterThan(0);
  });

  it("keeps individual Admitad merchants distinct from the provider store", () => {
    const merchantA = resolveCanonicalStore("admitad", "Alibaba");
    const merchantB = resolveCanonicalStore("admitad", "Alibaba");
    const provider = resolveCanonicalStore("admitad");
    expect(merchantA.storeId).toBe(merchantB.storeId);
    expect(merchantA.storeId).not.toBe(provider.storeId);
    expect(merchantA.isMerchant).toBe(true);
    expect(merchantA.nameSource).toBe("merchant");
    expect(merchantA.storeId).toMatch(/^merchant-/);
  });

  it("a real Admitad feed merchant keeps its own store identity (not the network)", () => {
    const ajazz = resolveCanonicalStore("admitad", "Ajazz");
    expect(ajazz.storeId).toBe("merchant-ajazz");
    expect(ajazz.name).toBe("Ajazz");
    expect(ajazz.isMerchant).toBe(true);
    expect(ajazz.providerId).toBe("admitad");
  });

  it("collapses an indirect merchant that merely repeats the provider's own store (Amazon)", () => {
    // Amazon affiliate links: the store IS Amazon, so "Amazon" must resolve
    // through the Store Registry — never become a fake separate merchant.
    const viaMerchant = resolveCanonicalStore("amazon", "Amazon");
    const direct = resolveCanonicalStore("amazon");
    expect(viaMerchant.storeId).toBe("store-amazon");
    expect(viaMerchant.storeId).toBe(direct.storeId);
    expect(viaMerchant.isMerchant).toBe(false);
    expect(viaMerchant.nameSource).toBe("registry");
    expect(viaMerchant.name).toBe("Amazon");
  });

  it("falls back to a stable store id for unknown providers (mirrors legacy tolerance)", () => {
    const store = resolveCanonicalStore("not-a-provider");
    expect(store.storeId).toBe("store-not-a-provider");
    expect(store.nameSource).toBe("provider");
  });
});

describe("getCanonicalStoreName", () => {
  it("returns the display name for a known provider", () => {
    expect(getCanonicalStoreName("ebay")).toBe("eBay");
  });
  it("returns the merchant name when provided", () => {
    expect(getCanonicalStoreName("admitad", "Alibaba")).toBe("Alibaba");
  });
});

describe("provider registry integration", () => {
  it("rebuilds the provider id set non-empty and includes the active set", () => {
    expect(isRegisteredProviderId("aliexpress")).toBe(true);
    expect(isRegisteredProviderId("amazon-eg")).toBe(true);
    expect(isRegisteredProviderId("not-real")).toBe(false);
  });
  it("classifies admitad and amazon as indirect, api providers as direct", () => {
    expect(providerAcquisitionMode("admitad")).toBe("indirect");
    expect(providerAcquisitionMode("amazon")).toBe("indirect");
    expect(providerAcquisitionMode("amazon-eg")).toBe("indirect");
    expect(providerAcquisitionMode("aliexpress")).toBe("direct");
    expect(providerAcquisitionMode("ebay")).toBe("direct");
    expect(providerAcquisitionMode("cjdropshipping")).toBe("direct");
  });
  it("exposes registry-supported currencies", () => {
    expect(providerSupportedCurrencies("aliexpress")).toContain("USD");
    expect(providerSupportedCurrencies("nope")).toBeUndefined();
  });
});