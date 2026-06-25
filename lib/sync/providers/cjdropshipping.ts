import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["CJDROPSHIPPING_API_KEY"] as const;

/**
 * CJdropshipping API adapter.
 * Placeholder until CJDROPSHIPPING_API_KEY is configured.
 * Target API: https://developers.cjdropshipping.com/api2.0/v1/product/list
 */
export class CJdropshippingProvider extends BaseConnector {
  id = "cjdropshipping" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "cjdropshipping",
    name: "CJdropshipping",
    phase: "placeholder",
    apiDocs: "https://developers.cjdropshipping.com/",
  };

  isConfigured(): boolean {
    return checkProviderCredentials([...CREDENTIAL_KEYS]).configured;
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) {
      throw this.notConfiguredError();
    }
    await this.logPlaceholderFetch("fetchProducts", ctx);
    return [];
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    if (!this.isConfigured()) return [];
    return [];
  }

  private async logPlaceholderFetch(method: string, ctx: SyncContext) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[CJdropshippingProvider] ${method} placeholder — credentials set, API integration pending`,
        { store: ctx.storeSlug }
      );
    }
  }
}

export function createCJdropshippingProvider(): CJdropshippingProvider {
  return new CJdropshippingProvider();
}

export function getCJdropshippingProviderId(): ImportProviderId {
  return "cjdropshipping";
}
