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

/** Whether a production marketplace provider has credentials and can be queried. */
export function isProductionProviderConfigured(providerId: ProductionProviderId): boolean {
  switch (providerId) {
    case "aliexpress":
      return isAliExpressConfigured();
    case "ebay":
      return isEbayConfigured();
    case "amazon":
      return isAmazonConfigured();
    case "walmart":
      return createWalmartProvider().isConfigured();
    case "temu":
      return createTemuProvider().isConfigured();
    case "bestbuy":
      return isIntegrationConfigured(["BESTBUY_API_KEY"]);
    case "noon":
      return isIntegrationConfigured(["NOON_API_KEY"]);
    case "jumia":
      return isIntegrationConfigured(["JUMIA_API_KEY", "JUMIA_AFFILIATE_ID"]);
    default:
      return false;
  }
}

export function getConfiguredProductionProviders(): ProductionProviderId[] {
  return PRODUCTION_PROVIDER_IDS.filter(isProductionProviderConfigured);
}
