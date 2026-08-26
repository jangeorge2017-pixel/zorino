import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["JUMIA_API_KEY", "JUMIA_AFFILIATE_ID"] as const;

/** Jumia API adapter (placeholder). */
export class JumiaProvider extends BaseConnector {
  id = "jumia" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "jumia",
    name: "Jumia",
    phase: "placeholder",
    apiDocs: "https://developer.jumia.com/",
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

export function createJumiaProvider() {
  return new JumiaProvider();
}
