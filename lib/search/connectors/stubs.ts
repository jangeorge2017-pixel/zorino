import { isIntegrationConfigured } from "@/lib/integration/credentials";
import { createSyncBridgeConnector } from "@/lib/search/connectors/sync-bridge";
import type { SearchConnector } from "@/lib/search/connectors/types";
import type { SearchProviderId } from "@/lib/search/types";

/**
 * Placeholder connectors for providers that are NOT available in production.
 *
 * Each stub requires specific environment variables to become active.
 * Without those variables, isAvailable() returns false and search() returns [].
 *
 * To activate a connector:
 *   1. Obtain valid API credentials from the provider
 *   2. Add the required env vars to Vercel Production Environment Variables
 *   3. The connector will automatically become available on next deployment
 */
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

/**
 * Walmart — UNAVAILABLE in production.
 * Requires: WALMART_API_KEY
 * Status: No API credentials configured. Placeholder provider.
 */
export const walmartSearchConnector = createSyncBridgeConnector({
  id: "walmart",
  name: "Walmart",
  importId: "walmart",
  productionId: "walmart",
});

/**
 * Temu — UNAVAILABLE in production.
 * Requires: TEMU_API_KEY
 * Status: No API credentials configured. Placeholder provider.
 */
export const temuSearchConnector = createSyncBridgeConnector({
  id: "temu",
  name: "Temu",
  importId: "temu",
  productionId: "temu",
});

/**
 * Best Buy — UNAVAILABLE in production.
 * Requires: sync-layer provider adapter + BESTBUY_API_KEY credentials.
 * Status: No API credentials configured. Architecture-ready.
 */
export const bestBuySearchConnector = createSyncBridgeConnector({
  id: "bestbuy",
  name: "Best Buy",
  importId: "bestbuy",
  productionId: "bestbuy",
});

/**
 * Noon — UNAVAILABLE in production.
 * Requires: sync-layer provider adapter + NOON_API_KEY credentials.
 * Status: No API credentials configured. Architecture-ready.
 */
export const noonSearchConnector = createSyncBridgeConnector({
  id: "noon",
  name: "Noon",
  importId: "noon",
  productionId: "noon",
});

/**
 * Jumia — UNAVAILABLE in production.
 * Requires: sync-layer provider adapter + JUMIA_API_KEY + JUMIA_AFFILIATE_ID credentials.
 * Status: No API credentials configured. Architecture-ready.
 */
export const jumiaSearchConnector = createSyncBridgeConnector({
  id: "jumia",
  name: "Jumia",
  importId: "jumia",
  productionId: "jumia",
});
