import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  externalProductsToDeals,
  fetchStorefrontCatalog,
  hasStoreSearchAdapter,
} from "@/lib/sync/providers/shared/storefront-catalog";
import {
  checkProviderCredentials,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["JUMIA_API_KEY", "JUMIA_AFFILIATE_ID"] as const;

export class JumiaProvider extends BaseConnector {
  id = "jumia" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "jumia",
    name: "Jumia",
    phase: "live",
    apiDocs: "https://developer.jumia.com/",
  };

  isConfigured(): boolean {
    return hasStoreSearchAdapter("jumia");
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) throw this.notConfiguredError();
    return fetchStorefrontCatalog("jumia", ctx);
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return externalProductsToDeals(await this.fetchProducts(ctx));
  }
}

export function createJumiaProvider() {
  return new JumiaProvider();
}
