import type { SearchConnector, ConnectorSearchOptions } from "@/lib/search/connectors/types";
import type { RawProviderListing } from "@/lib/search/types";

/**
 * Amazon Egypt search connector — seed-link only.
 * The AmazonEgSeedLinks component renders "Buy on Amazon Egypt" buttons
 * with real amazon.eg affiliate URLs. This connector returns no results
 * because we have no API access and cannot fabricate product data.
 */
export const amazonEgSearchConnector: SearchConnector = {
  id: "amazon-eg",
  name: "Amazon Egypt",

  async isAvailable(): Promise<boolean> {
    return true;
  },

  async search(
    _query: string,
    _options?: ConnectorSearchOptions
  ): Promise<RawProviderListing[]> {
    // No API access — seed links component handles product display.
    return [];
  },
};
