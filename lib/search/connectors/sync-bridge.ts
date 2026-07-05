import type { ImportProviderId } from "@/lib/sync/providers/types";
import { getProviderAdapter } from "@/lib/sync/providers";
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
      return isProductionProviderConfigured(config.productionId);
    },

    async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
      const trimmed = query.trim();
      if (!trimmed) return [];

      if (!isProductionProviderConfigured(config.productionId)) return [];

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
