import { EGYPT_STORE_ADAPTERS } from "@/lib/integrations/egypt-stores";
import { buildAffiliateUrl } from "@/lib/integrations/egypt-stores/affiliate";
import type { StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import type { SearchConnector } from "@/lib/search/connectors/types";

function createEgyptStoreConnector(adapter: StoreSearchAdapter): SearchConnector {
  return {
    id: adapter.id,
    name: adapter.name,
    async isAvailable() {
      return true;
    },
    async search(query, options) {
      try {
        const listings = await adapter.search(query, options);
        if (listings.length === 0 && query.trim()) {
          console.warn(`[egypt-store] ${adapter.id}: 0 listings for "${query}"`);
        }
        return listings.map((listing) => ({
          ...listing,
          affiliateUrl: buildAffiliateUrl(adapter.name, listing.productUrl),
        }));
      } catch {
        return [];
      }
    },
  };
}

export const egyptStoreSearchConnectors: readonly SearchConnector[] =
  EGYPT_STORE_ADAPTERS.map(createEgyptStoreConnector);
