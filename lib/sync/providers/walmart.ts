import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  externalProductsToDeals,
} from "@/lib/sync/providers/shared/storefront-catalog";
import {
  fetchWalmartCatalog,
  isWalmartConfigured,
} from "@/lib/sync/providers/shared/global-retail-catalog";
import {
  checkProviderCredentials,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["WALMART_API_KEY"] as const;

export class WalmartProvider extends BaseConnector {
  id = "walmart" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "walmart",
    name: "Walmart",
    phase: "live",
    apiDocs: "https://wallet.walmart.com/apidocs/affiliates/affiliate-marketing-api",
  };

  isConfigured(): boolean {
    return isWalmartConfigured();
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) throw this.notConfiguredError();
    return fetchWalmartCatalog(ctx);
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return externalProductsToDeals(await this.fetchProducts(ctx));
  }
}

export function createWalmartProvider() {
  return new WalmartProvider();
}
