import type { ImportProviderId } from "@/lib/sync/providers/types";
import { getProviderAdapter, isSyncProviderCapable } from "@/lib/sync/providers";
import { buildProviderSyncContext } from "@/lib/integration/provider-context";
import { isProductionProviderConfigured } from "@/lib/integration/provider-config";
import { externalProductToRawListing } from "@/lib/search/normalization";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ConnectorSearchOptions, SearchConnector } from "@/lib/search/connectors/types";
import type { ProductionProviderId } from "@/lib/integration/constants";

type SyncBridgeConfig = {
  id: SearchProviderId;
  name: string;
  importId: ImportProviderId;
  productionId: ProductionProviderId;
};

/**
 * Search connector backed by sync-layer PartnerConnector.
 * Used for providers without a dedicated live search client yet.
 */
export function createSyncBridgeConnector(config: SyncBridgeConfig): SearchConnector {
  return {
    id: config.id,
    name: config.name,

    async isAvailable() {
      // Credentials alone do not make a provider operational. A provider is
      // available only when it passes BOTH the production-configuration gate
      // AND the sync-capability gate (a non-placeholder adapter that can
      // actually fetch real products). Placeholder sync adapters (walmart /
      // temu / bestbuy / noon / jumia) return empty sets by design, so even
      // fully-configured credentials must not advertise them as available —
      // this closes the "configured but contributes 0" phantom-source path.
      if (!isProductionProviderConfigured(config.productionId)) return false;
      return isSyncProviderCapable(config.importId);
    },

    async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
      const trimmed = query.trim();
      if (!trimmed) return [];

      if (!isProductionProviderConfigured(config.productionId)) return [];
      if (!isSyncProviderCapable(config.importId)) return [];

      const connector = getProviderAdapter(config.importId);
      if (!connector.isConfigured()) return [];

      const ctx = buildProviderSyncContext(config.productionId, {
        jobConfig: {
          keywords: [trimmed],
          maxPages: options?.maxPages ?? SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER,
          pageSize: options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
        },
      });

      try {
        const products = await connector.fetchProducts(ctx);
        return products
          .map((product) => externalProductToRawListing(product, config.id))
          .filter((item): item is RawProviderListing => item !== null);
      } catch {
        return [];
      }
    },
  };
}
