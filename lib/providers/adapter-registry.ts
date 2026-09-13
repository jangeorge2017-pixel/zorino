/**
 * Adapter Registry — bridges existing SearchConnectors to the ProviderAdapter
 * interface and provides adapter selection by provider ID.
 *
 * This is the single entry point for obtaining a ProviderAdapter. It wraps
 * existing SearchConnector implementations without modifying them, so all
 * existing behavior is preserved.
 *
 * In later phases, adapters will be migrated to self-contained implementations
 * (lib/providers/adapters/<provider>/) that replace the connector layer.
 */

import type { SearchProviderId } from "@/lib/search/types";
import { SEARCH_PROVIDER_IDS } from "@/lib/search/types";
import type { ConnectorSearchOptions } from "@/lib/search/connectors/types";
import type { ProviderAdapter } from "./adapter";
import type { ProviderSearchResult } from "./adapter";
import type { ProductDetail } from "@/lib/data/product-detail";
import { getSearchConnector, getActiveSearchConnectors } from "@/lib/search/connectors/registry";
import { normalizeAliExpressRaw } from "@/lib/search/normalization";
import { normalizeEbayRaw } from "@/lib/search/normalization";
import { normalizeAmazonRaw } from "@/lib/search/normalization";
import { normalizeCJRaw } from "@/lib/search/normalization";
import { normalizeAdmitadRaw } from "@/lib/search/normalization";

// ─── Connector → Adapter Bridge ─────────────────────────────────────────────

/**
 * Creates a ProviderAdapter that delegates search and availability to an
 * existing SearchConnector. The normalize function must be provided explicitly
 * since the connector does not expose its normalizer.
 */
function createConnectorAdapter(
  id: SearchProviderId,
  name: string,
  normalizeFn: (raw: unknown) => import("@/lib/search/types").RawProviderListing | null,
  detailResolver?: (externalId: string) => Promise<ProductDetail | null>,
): ProviderAdapter {
  return {
    id,
    name,

    async isAvailable(): Promise<boolean> {
      const connector = getSearchConnector(id);
      if (!connector) return false;
      return connector.isAvailable();
    },

    normalize(raw: unknown): import("@/lib/search/types").RawProviderListing | null {
      if (raw == null || typeof raw !== "object") return null;
      try {
        return normalizeFn(raw);
      } catch {
        return null;
      }
    },

    normalizeBatch(raws: unknown[]): import("@/lib/search/types").RawProviderListing[] {
      const out: import("@/lib/search/types").RawProviderListing[] = [];
      for (const raw of raws) {
        const normalized = this.normalize(raw);
        if (normalized) out.push(normalized);
      }
      return out;
    },

    async search(
      query: string,
      options?: ConnectorSearchOptions,
    ): Promise<ProviderSearchResult> {
      const connector = getSearchConnector(id);
      if (!connector) {
        return { providerId: id, listings: [], durationMs: 0 };
      }

      const start = Date.now();
      try {
        const listings = await connector.search(query, options);
        return { providerId: id, listings, durationMs: Date.now() - start };
      } catch {
        return { providerId: id, listings: [], durationMs: Date.now() - start };
      }
    },

    ...(detailResolver ? { getProductDetail: detailResolver } : {}),
  };
}

// ─── Provider-Specific Adapters ─────────────────────────────────────────────

/**
 * AliExpress adapter.
 * Wraps the existing AliExpress SearchConnector + normalizeAliExpressRaw.
 * The connector handles API calls, keyword expansion, and affiliate links.
 * Product-detail lookups delegate to the existing real AliExpress API client
 * (getAliExpressProductDetail), preserving today's PDP behavior exactly while
 * hiding the provider service behind the adapter layer.
 */
export const aliExpressAdapter: ProviderAdapter = createConnectorAdapter(
  "aliexpress",
  "AliExpress",
  (raw) => normalizeAliExpressRaw(raw as Parameters<typeof normalizeAliExpressRaw>[0]),
  async (externalId) => {
    const { getAliExpressProductDetail } = await import(
      "@/services/aliexpress/search"
    );
    return getAliExpressProductDetail(`aliexpress-${externalId}`);
  },
);

/**
 * eBay adapter.
 * Wraps the existing eBay SearchConnector + normalizeEbayRaw.
 */
export const ebayAdapter: ProviderAdapter = createConnectorAdapter(
  "ebay",
  "eBay",
  (raw) => normalizeEbayRaw(raw as Parameters<typeof normalizeEbayRaw>[0]),
);

/**
 * Amazon adapter.
 * Wraps the existing Amazon SearchConnector. The connector handles both
 * Creators API and Oxylabs sources; the normalizer varies by source.
 * For the adapter, we use normalizeAmazonRaw as the canonical normalizer;
 * Oxylabs normalization is handled internally by the connector.
 */
export const amazonAdapter: ProviderAdapter = createConnectorAdapter(
  "amazon",
  "Amazon",
  (raw) => normalizeAmazonRaw(raw as Parameters<typeof normalizeAmazonRaw>[0]),
);

/**
 * Amazon Egypt adapter.
 * Wraps the existing Amazon EG SearchConnector.
 * The connector handles Creators API + Oxylabs for the EG marketplace.
 */
export const amazonEgAdapter: ProviderAdapter = createConnectorAdapter(
  "amazon-eg",
  "Amazon Egypt",
  (raw) => normalizeAmazonRaw(raw as Parameters<typeof normalizeAmazonRaw>[0]),
);

/**
 * CJdropshipping adapter.
 * Wraps the existing CJdropshipping SearchConnector + normalizeCJRaw.
 */
export const cjdropshippingAdapter: ProviderAdapter = createConnectorAdapter(
  "cjdropshipping",
  "CJdropshipping",
  (raw) => normalizeCJRaw(raw as Parameters<typeof normalizeCJRaw>[0]),
);

/**
 * Admitad adapter.
 * Wraps the existing Admitad SearchConnector + normalizeAdmitadRaw.
 * The connector handles multi-feed aggregation and DB cold-start safety.
 */
export const admitadAdapter: ProviderAdapter = createConnectorAdapter(
  "admitad",
  "Admitad",
  (raw) =>
    normalizeAdmitadRaw(
      raw as Parameters<typeof normalizeAdmitadRaw>[0],
      (raw as { feedName?: string }).feedName ?? "",
    ),
);

/**
 * Creates a stub adapter for providers without live credentials.
 * Delegates to the existing stub SearchConnector.
 */
function createStubAdapter(
  id: SearchProviderId,
  name: string,
): ProviderAdapter {
  return {
    id,
    name,

    async isAvailable(): Promise<boolean> {
      const connector = getSearchConnector(id);
      if (!connector) return false;
      return connector.isAvailable();
    },

    normalize(): import("@/lib/search/types").RawProviderListing | null {
      return null;
    },

    normalizeBatch(): import("@/lib/search/types").RawProviderListing[] {
      return [];
    },

    async search(): Promise<ProviderSearchResult> {
      return { providerId: id, listings: [], durationMs: 0 };
    },
  };
}

// ─── Adapter Registry ───────────────────────────────────────────────────────

/**
 * All adapters, keyed by provider ID.
 * Populated once at module load time — immutable thereafter.
 */
const ADAPTER_MAP: ReadonlyMap<SearchProviderId, ProviderAdapter> = new Map<
  SearchProviderId,
  ProviderAdapter
>([
  ["aliexpress", aliExpressAdapter],
  ["ebay", ebayAdapter],
  ["amazon", amazonAdapter],
  ["amazon-eg", amazonEgAdapter],
  ["cjdropshipping", cjdropshippingAdapter],
  ["admitad", admitadAdapter],
  ["walmart", createStubAdapter("walmart", "Walmart")],
  ["bestbuy", createStubAdapter("bestbuy", "Best Buy")],
  ["temu", createStubAdapter("temu", "Temu")],
  ["noon", createStubAdapter("noon", "Noon")],
  ["jumia", createStubAdapter("jumia", "Jumia")],
]);

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get a ProviderAdapter by provider ID.
 * Returns undefined when the ID is not registered.
 */
export function getProviderAdapter(id: string): ProviderAdapter | undefined {
  return ADAPTER_MAP.get(id as SearchProviderId);
}

/**
 * Get a ProviderAdapter by provider ID, throwing if not found.
 */
export function requireProviderAdapter(id: string): ProviderAdapter {
  const adapter = ADAPTER_MAP.get(id as SearchProviderId);
  if (!adapter) {
    throw new Error(`Provider adapter not found: ${id}`);
  }
  return adapter;
}

/**
 * Get all registered provider adapters.
 */
export function getAllProviderAdapters(): ProviderAdapter[] {
  return Array.from(ADAPTER_MAP.values());
}

/**
 * Get adapters for only the providers that are currently available
 * (credentials configured, connector ready).
 *
 * Respects an optional provider ID filter — when provided, only those
 * adapters are checked for availability.
 */
export async function getActiveProviderAdapters(
  providerIds?: SearchProviderId[],
): Promise<ProviderAdapter[]> {
  const ids = providerIds ?? (Array.from(SEARCH_PROVIDER_IDS) as SearchProviderId[]);
  const adapters = ids
    .map((id) => ADAPTER_MAP.get(id))
    .filter((a): a is ProviderAdapter => a !== undefined);

  const availability = await Promise.all(
    adapters.map(async (adapter) => ({
      adapter,
      available: await adapter.isAvailable(),
    })),
  );

  return availability.filter((row) => row.available).map((row) => row.adapter);
}

/**
 * Get all active SearchConnector IDs (backed by the connector registry).
 * This is the bridge function that lets existing code migrate to the
 * adapter layer without changing the connector registry.
 */
export async function getActiveProviderIds(
  providerIds?: SearchProviderId[],
): Promise<SearchProviderId[]> {
  const connectors = await getActiveSearchConnectors(providerIds);
  return connectors.map((c) => c.id);
}

/**
 * Total count of registered adapters.
 */
export function getRegisteredAdapterCount(): number {
  return ADAPTER_MAP.size;
}

/**
 * Provider-neutral product-detail resolution.
 *
 * Routes a product-detail request to the adapter registered for the provider.
 * Returns null when the provider has no detail resolver (stub/unconfigured
 * providers) or when the underlying detail source fails. Consumer code (e.g.
 * marketplace-product-detail.ts) MUST use this function instead of importing
 * provider-specific services directly.
 */
export async function resolveProviderProductDetail(
  providerId: SearchProviderId,
  externalId: string,
): Promise<ProductDetail | null> {
  const adapter = ADAPTER_MAP.get(providerId);
  if (!adapter?.getProductDetail) return null;
  try {
    return await adapter.getProductDetail(externalId);
  } catch {
    return null;
  }
}
