import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["BESTBUY_API_KEY"] as const;

/** Best Buy API adapter (placeholder). */
export class BestBuyProvider extends BaseConnector {
  id = "bestbuy" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "bestbuy",
    name: "Best Buy",
    phase: "placeholder",
    apiDocs: "https://developer.bestbuy.com/",
  };

  isConfigured(): boolean {
    return checkProviderCredentials([...CREDENTIAL_KEYS]).configured;
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  async fetchProducts(_ctx: SyncContext): Promise<ExternalProduct[]> {
    return [];
  }

  async fetchDeals(_ctx: SyncContext): Promise<ExternalDeal[]> {
    return [];
  }
}

export function createBestBuyProvider() {
  return new BestBuyProvider();
}
