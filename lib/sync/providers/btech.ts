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

export class BtechProvider extends BaseConnector {
  id = "btech" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "btech",
    name: "B.TECH",
    phase: "live",
  };

  isConfigured(): boolean {
    return hasStoreSearchAdapter("btech");
  }

  getCredentials() {
    return checkProviderCredentials([]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) throw this.notConfiguredError();
    return fetchStorefrontCatalog("btech", ctx, { retries: 2 });
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return externalProductsToDeals(await this.fetchProducts(ctx));
  }
}

export function createBtechProvider(): BtechProvider {
  return new BtechProvider();
}
