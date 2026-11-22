import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  externalProductsToDeals,
  fetchStorefrontCatalog,
  hasStoreSearchAdapter,
} from "@/lib/sync/providers/shared/storefront-catalog";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const NOON_CREDENTIAL_KEYS = [
  "NOON_API_KEY",
  "NOON_UAE_AFFILIATE_ID",
  "NOON_KSA_AFFILIATE_ID",
] as const;

export class NoonProvider extends BaseConnector {
  id = "noon" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "noon" as ImportProviderId,
    name: "Noon UAE/KSA",
    phase: "live",
    apiDocs: "https://www.noon.com/help/platform",
  };

  isConfigured(): boolean {
    return hasStoreSearchAdapter("noon");
  }

  getCredentials() {
    return checkProviderCredentials([...NOON_CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) throw this.notConfiguredError();
    return fetchStorefrontCatalog("noon", ctx);
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return externalProductsToDeals(await this.fetchProducts(ctx));
  }
}

export function createNoonProvider(): NoonProvider {
  return new NoonProvider();
}

export function getNoonProviderId(): ImportProviderId {
  return "noon";
}
