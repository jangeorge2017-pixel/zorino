import type { SearchProviderId } from "@/lib/search/types";
import type { SearchConnector } from "@/lib/search/connectors/types";

/** Placeholder connectors for future marketplace integrations. */
function createStubConnector(id: SearchProviderId, name: string): SearchConnector {
  return {
    id,
    name,
    async isAvailable() {
      return false;
    },
    async search() {
      return [];
    },
  };
}

export const amazonSearchConnector = createStubConnector("amazon", "Amazon");
export const walmartSearchConnector = createStubConnector("walmart", "Walmart");
export const bestBuySearchConnector = createStubConnector("bestbuy", "Best Buy");
export const temuSearchConnector = createStubConnector("temu", "Temu");
export const noonSearchConnector = createStubConnector("noon", "Noon");
export const jumiaSearchConnector = createStubConnector("jumia", "Jumia");
