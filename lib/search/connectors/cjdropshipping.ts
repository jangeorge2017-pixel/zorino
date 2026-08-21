import { createSyncBridgeConnector } from "@/lib/search/connectors/sync-bridge";

/**
 * CJdropshipping — real API adapter wired through the sync-layer bridge.
 *
 * The sync adapter (lib/sync/providers/cjdropshipping.ts) has a working
 * REST API client that searches by keyword via CJdropshipping's v2.0 API.
 * This connector exposes it to the search pipeline.
 *
 * Requires: CJDROPSHIPPING_API_KEY in Vercel Production Environment Variables.
 */
export const cjdropshippingSearchConnector = createSyncBridgeConnector({
  id: "cjdropshipping",
  name: "CJdropshipping",
  importId: "cjdropshipping",
  productionId: "cjdropshipping",
});
