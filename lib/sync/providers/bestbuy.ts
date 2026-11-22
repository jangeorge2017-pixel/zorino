import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import { externalProductsToDeals } from "@/lib/sync/providers/shared/storefront-catalog";
import {
  fetchBestBuyCatalog,
  isBestBuyConfigured,
} from "@/lib/sync/providers/shared/global-retail-catalog";
import {
  checkProviderCredentials,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["BESTBUY_API_KEY"] as const;

export class BestBuyProvider extends BaseConnector {
  id = "bestbuy" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "bestbuy",
    name: "Best Buy",
    phase: "live",
    apiDocs: "https://developer.bestbuy.com/apis",
  };

  isConfigured(): boolean {
    return isBestBuyConfigured();
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) throw this.notConfiguredError();
    return fetchBestBuyCatalog(ctx);
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return externalProductsToDeals(await this.fetchProducts(ctx));
  }
}

export function createBestBuyProvider() {
  return new BestBuyProvider();
}
