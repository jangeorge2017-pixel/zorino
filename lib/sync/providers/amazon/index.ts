import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";
import { getAmazonPaApiConfig } from "@/lib/sync/providers/amazon/paapi-types";

const CREDENTIAL_KEYS = [
  "AMAZON_PAAPI_ACCESS_KEY",
  "AMAZON_PAAPI_SECRET_KEY",
  "AMAZON_ASSOCIATE_TAG",
] as const;

/**
 * Amazon Product Advertising API 5.0 adapter.
 * Prepared for Phase 2 — types and config helpers ready; live calls pending.
 */
export class AmazonProvider extends BaseConnector {
  id = "amazon" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "amazon",
    name: "Amazon",
    phase: "placeholder",
    apiDocs: "https://webservices.amazon.com/paapi5/documentation/",
  };

  isConfigured(): boolean {
    return checkProviderCredentials([...CREDENTIAL_KEYS]).configured;
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  getPaApiConfig() {
    return getAmazonPaApiConfig();
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) {
      throw this.notConfiguredError();
    }
    const config = getAmazonPaApiConfig();
    if (!config) return [];

    // Phase 2: Sign and POST to /paapi5/searchitems
    if (process.env.NODE_ENV !== "production") {
      console.info("[AmazonProvider] fetchProducts — PA-API 5.0 integration pending", {
        marketplace: config.marketplace,
        store: ctx.storeSlug,
      });
    }
    return [];
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    if (!this.isConfigured()) return [];
    return [];
  }
}

export function createAmazonProvider(): AmazonProvider {
  return new AmazonProvider();
}

export function getAmazonProviderId(): ImportProviderId {
  return "amazon";
}
