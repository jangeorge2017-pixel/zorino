import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["TEMU_API_KEY"] as const;

/** Temu product/affiliate API adapter (placeholder). */
export class TemuProvider extends BaseConnector {
  id = "temu" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "temu",
    name: "Temu",
    phase: "placeholder",
    apiDocs: "https://www.temu.com",
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

export function createTemuProvider() {
  return new TemuProvider();
}
