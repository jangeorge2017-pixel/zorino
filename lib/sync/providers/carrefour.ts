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

export class CarrefourProvider extends BaseConnector {
  id = "carrefour" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "carrefour",
    name: "Carrefour Egypt",
    phase: "live",
  };

  isConfigured(): boolean {
    return hasStoreSearchAdapter("carrefour");
  }

  getCredentials() {
    return checkProviderCredentials([]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) throw this.notConfiguredError();
    return fetchStorefrontCatalog("carrefour", ctx, { retries: 2 });
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return externalProductsToDeals(await this.fetchProducts(ctx));
  }
}

export function createCarrefourProvider(): CarrefourProvider {
  return new CarrefourProvider();
}
