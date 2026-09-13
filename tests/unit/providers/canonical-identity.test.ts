import { describe, it, expect } from "vitest";
import {
  LIVE_PROVIDER_IDS,
  PROVIDER_IDS,
  PROVIDER_REGISTRY,
  STUB_PROVIDER_IDS,
  resolveProviderId,
} from "@/lib/providers/registry";
import {
  getSyncStoreMeta,
  searchProviderToProductionId,
} from "@/lib/integration/provider-context";
import { LIVE_SEARCH_PROVIDER_IDS } from "@/lib/search/types";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";
import { getAllSearchConnectors } from "@/lib/search/connectors/registry";
import { CONNECTOR_REGISTRY } from "@/lib/integration/registry";
import { getAllProviderAdapters } from "@/lib/providers/adapter-registry";

// ─── Live / Stub Derivation ─────────────────────────────────────────────────

describe("Live / stub provider derivation", () => {
  const expectedLive = ["aliexpress", "ebay", "cjdropshipping", "admitad"];
  const expectedStub = ["walmart", "bestbuy", "temu", "noon", "jumia"];
  const expectedConfigured = ["amazon", "amazon-eg"];

  it("LIVE_PROVIDER_IDS equals the active providers in registry order", () => {
    expect(Array.from(LIVE_PROVIDER_IDS)).toEqual(expectedLive);
  });

  it("STUB_PROVIDER_IDS equals the placeholder-only providers", () => {
    expect(new Set(STUB_PROVIDER_IDS)).toEqual(new Set(expectedStub));
  });

  it("every provider is in exactly one of live / configured / stub", () => {
    const live = new Set(LIVE_PROVIDER_IDS);
    const stub = new Set(STUB_PROVIDER_IDS);
    const configured = new Set(
      PROVIDER_REGISTRY.filter((p) => p.status === "configured").map((p) => p.id),
    );
    expect(new Set(configured)).toEqual(new Set(expectedConfigured));
    for (const id of PROVIDER_IDS) {
      const memberships = [live, stub, configured].filter((set) => set.has(id)).length;
      expect(memberships, `${id} must belong to exactly one state`).toBe(1);
    }
  });

  it("LIVE_SEARCH_PROVIDER_IDS derives from the registry (never hardcoded)", () => {
    expect(Array.from(LIVE_SEARCH_PROVIDER_IDS)).toEqual(Array.from(LIVE_PROVIDER_IDS));
  });

  it("registered live providers are never flagged as stubs", () => {
    for (const id of expectedLive) {
      expect(STUB_PROVIDER_IDS).not.toContain(id);
    }
    expect(STUB_PROVIDER_IDS).not.toContain("amazon");
  });
});

// ─── Canonical Resolver Unification ─────────────────────────────────────────

describe("Canonical resolver unification", () => {
  const inputs = [
    "aliexpress",
    "ebay",
    "admitad",
    "amazon-eg",
    "amazon-egypt",
    "alibaba",
    "alibaba-ww",
    "alibaba (via admitad)",
    "flash-ebay-123",
    "pick-amazon-abc",
    "walmart",
    "nonexistent-store",
  ];

  it("resolveMarketplaceId delegates to resolveProviderId", () => {
    for (const input of inputs) {
      expect(resolveMarketplaceId(input)).toBe(resolveProviderId(input));
    }
  });

  it("resolves display names and aliases to canonical ids", () => {
    expect(resolveMarketplaceId("alibaba")).toBe("admitad");
    expect(resolveMarketplaceId("amazon-egypt")).toBe("amazon-eg");
    expect(resolveMarketplaceId("flash-ebay-123")).toBe("ebay");
  });

  it("passes unknown store slugs through unchanged", () => {
    expect(resolveMarketplaceId("some-random-store")).toBe("some-random-store");
  });

  it("empty input resolves to unknown", () => {
    expect(resolveMarketplaceId("")).toBe("unknown");
  });
});

// ─── Sync Store Identity ────────────────────────────────────────────────────

describe("Sync store identity (getSyncStoreMeta)", () => {
  it("admitad provider identity is the network, not the merchant", () => {
    expect(getSyncStoreMeta("admitad").name).toBe("Admitad");
  });

  it("integrationType values match the canonical registry", () => {
    for (const provider of PROVIDER_REGISTRY) {
      expect(getSyncStoreMeta(provider.id).integrationType, provider.id).toBe(
        provider.integrationType,
      );
    }
  });

  it("searchProviderToProductionId recognizes all registered providers", () => {
    for (const id of PROVIDER_IDS) {
      expect(searchProviderToProductionId(id), id).toBe(id);
    }
  });

  it("returns a synthetic fallback for unknown providers", () => {
    const meta = getSyncStoreMeta("nonexistent");
    expect(meta.storeId).toBe("store-nonexistent");
  });
});

// ─── Connector / Adapter / Registry 1:1 ─────────────────────────────────────

describe("Connector / adapter / registry alignment", () => {
  it("every search connector id is a registered provider", () => {
    const registry = new Set(PROVIDER_IDS);
    for (const connector of getAllSearchConnectors()) {
      expect(registry.has(connector.id), connector.id).toBe(true);
    }
  });

  it("every adapter id is a registered provider", () => {
    const registry = new Set(PROVIDER_IDS);
    for (const adapter of getAllProviderAdapters()) {
      expect(registry.has(adapter.id), adapter.id).toBe(true);
    }
  });

  it("adapter registry covers every provider exactly once", () => {
    const adapterIds = getAllProviderAdapters()
      .map((a) => a.id)
      .sort();
    const providerIds = Array.from(PROVIDER_IDS)
      .slice()
      .sort();
    expect(adapterIds).toEqual(providerIds);
  });

  it("CONNECTOR_REGISTRY documents every registered provider", () => {
    const documented = new Set(CONNECTOR_REGISTRY.map((spec) => spec.id));
    for (const id of PROVIDER_IDS) {
      expect(documented.has(id), id).toBe(true);
    }
  });
});