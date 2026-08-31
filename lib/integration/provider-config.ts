import {
  PRODUCTION_PROVIDER_IDS,
  type ProductionProviderId,
} from "@/lib/integration/constants";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress";
import { isAmazonConfigured } from "@/lib/integrations/amazon";
import { isEbayConfigured } from "@/lib/integrations/ebay/config";
import { isIntegrationConfigured } from "@/lib/integration/credentials";
import { isOxylabsConfigured } from "@/lib/integrations/oxylabs";
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
 * ACTIVE in production (confirmed returning real products):
 *   aliexpress — live API credentials
 *   ebay       — live Browse API + ePN tracking
 *   admitad    — live Admitad XML feed (~120K Alibaba marketplace products)
 *   cjdropshipping — live REST API
 *
 * UNAVAILABLE (no credentials on Vercel):
 *   amazon, walmart, temu, bestbuy, noon, jumia
 *
 * Note: Admitad products display as "Alibaba" in the UI (brand name),
 * but the provider id is "admitad" (affiliate network).
 */
export function isProductionProviderConfigured(providerId: ProductionProviderId): boolean {
  switch (providerId) {
    // --- ACTIVE in production (credentials configured on Vercel) ---
    case "aliexpress":
      return isAliExpressConfigured();
    case "ebay":
      return isEbayConfigured();
    case "admitad": {
      // Feed-based primary feed, plus Publisher-API multi-merchant discovery
      // (feeds + deeplinks) when OAuth client credentials are configured.
      const feedUrl = process.env.ADMITAD_FEED_URL?.trim();
      const apiCredentials =
        process.env.ADMITAD_CLIENT_ID?.trim() && process.env.ADMITAD_CLIENT_SECRET?.trim();
      return Boolean(feedUrl) || Boolean(apiCredentials);
    }

    // --- ACTIVE in production (CJDROPSHIPPING_API_KEY configured on Vercel) ---
    case "cjdropshipping":
      return createCJdropshippingProvider().isConfigured();

    // --- UNAVAILABLE in production (no credentials configured) ---
    // Amazon is only advertised as configured when a REAL Amazon data source is
    // present: Amazon Creators API credentials OR the Oxylabs Amazon scraper.
    // Without either there is no genuine Amazon product data, so Amazon must
    // not be falsely reported as active/configured. Never fabricated.
    case "amazon":
      return isAmazonConfigured() || isOxylabsConfigured();
    case "amazon-eg":
      return isAmazonConfigured() || isOxylabsConfigured();
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
