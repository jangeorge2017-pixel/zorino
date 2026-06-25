import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["WALMART_API_KEY"] as const;

/** Walmart Open API adapter (placeholder). */
export class WalmartProvider extends BaseConnector {
  id = "walmart" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "walmart",
    name: "Walmart",
    phase: "placeholder",
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

export function createWalmartProvider() {
  return new WalmartProvider();
}
