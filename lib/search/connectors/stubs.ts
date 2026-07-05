import { isIntegrationConfigured } from "@/lib/integration/credentials";
import { createSyncBridgeConnector } from "@/lib/search/connectors/sync-bridge";
import type { SearchConnector } from "@/lib/search/connectors/types";
import type { SearchProviderId } from "@/lib/search/types";

/** Placeholder connectors for providers pending live search API wiring. */
function createEnvGatedStub(
  id: SearchProviderId,
  name: string,
  envKeys: string[]
): SearchConnector {
  return {
    id,
    name,
    async isAvailable() {
      return isIntegrationConfigured(envKeys);
    },
    async search() {
      return [];
    },
  };
}

export const amazonSearchConnector = createSyncBridgeConnector({
  id: "amazon",
  name: "Amazon",
  importId: "amazon",
  productionId: "amazon",
});

export const walmartSearchConnector = createSyncBridgeConnector({
  id: "walmart",
  name: "Walmart",
  importId: "walmart",
  productionId: "walmart",
});

export const temuSearchConnector = createSyncBridgeConnector({
  id: "temu",
  name: "Temu",
  importId: "temu",
  productionId: "temu",
});

export const bestBuySearchConnector = createEnvGatedStub("bestbuy", "Best Buy", [
  "BESTBUY_API_KEY",
]);
export const noonSearchConnector = createEnvGatedStub("noon", "Noon", ["NOON_API_KEY"]);
export const jumiaSearchConnector = createEnvGatedStub("jumia", "Jumia", [
  "JUMIA_API_KEY",
  "JUMIA_AFFILIATE_ID",
]);
