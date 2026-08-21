import {
  PRODUCTION_PROVIDER_IDS,
  type ProductionProviderId,
} from "@/lib/integration/constants";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress";
import { isAmazonConfigured } from "@/lib/integrations/amazon";
import { isEbayConfigured } from "@/lib/integrations/ebay/config";
import { isIntegrationConfigured } from "@/lib/integration/credentials";
import { createTemuProvider } from "@/lib/sync/providers/temu";
import { createWalmartProvider } from "@/lib/sync/providers/walmart";
import { createCJdropshippingProvider } from "@/lib/sync/providers/cjdropshipping";

/**
 * Whether a production marketplace provider has credentials and can be queried.
 *
 * Authoritative source: Vercel Production Environment Variables.
 * Some providers also accept credentials from DB integration_settings
 * via hydrateIntegrationCredentials().
 *
 * Active in production:  aliexpress, ebay, admitad
 * Sync-layer only (no creds on Vercel): cjdropshipping
 * Unavailable (no creds): amazon, walmart, temu, bestbuy, noon, jumia
 */
export function isProductionProviderConfigured(providerId: ProductionProviderId): boolean {
  switch (providerId) {
    // --- ACTIVE in production (credentials configured on Vercel) ---
    case "aliexpress":
      return isAliExpressConfigured();
    case "ebay":
      return isEbayConfigured();
    case "admitad": {
      // Feed-based; only available when ADMITAD_FEED_URL env var is set
      const feedUrl = process.env.ADMITAD_FEED_URL?.trim();
      return Boolean(feedUrl);
    }

    // --- SYNC-LAYER ONLY (no search connector, no homepage integration) ---
    case "cjdropshipping":
      return createCJdropshippingProvider().isConfigured(); // Requires CJDROPSHIPPING_API_KEY

    // --- UNAVAILABLE in production (no credentials configured) ---
    // These return false until valid API keys are added to Vercel.
    case "amazon":
      return isAmazonConfigured(); // Requires AMAZON_CREATORS_CLIENT_ID + CLIENT_SECRET
    case "walmart":
      return createWalmartProvider().isConfigured(); // Requires WALMART_API_KEY
    case "temu":
      return createTemuProvider().isConfigured(); // Requires TEMU_API_KEY
    case "bestbuy":
      return isIntegrationConfigured(["BESTBUY_API_KEY"]); // Requires BESTBUY_API_KEY
    case "noon":
      return isIntegrationConfigured(["NOON_API_KEY"]); // Requires NOON_API_KEY
    case "jumia":
      return isIntegrationConfigured(["JUMIA_API_KEY", "JUMIA_AFFILIATE_ID"]); // Requires both

    default:
      return false;
  }
}

export function getConfiguredProductionProviders(): ProductionProviderId[] {
  return PRODUCTION_PROVIDER_IDS.filter(isProductionProviderConfigured);
}
