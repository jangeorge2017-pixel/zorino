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

const CREDENTIAL_KEYS = ["TEMU_API_KEY"] as const;

export class TemuProvider extends BaseConnector {
  id = "temu" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "temu",
    name: "Temu",
    phase: "live",
    apiDocs: "https://www.temu.com",
  };

  isConfigured(): boolean {
    return hasStoreSearchAdapter("temu");
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) throw this.notConfiguredError();
    return fetchStorefrontCatalog("temu", ctx);
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return externalProductsToDeals(await this.fetchProducts(ctx));
  }
}

export function createTemuProvider() {
  return new TemuProvider();
}
