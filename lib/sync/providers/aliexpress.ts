import type { ExternalDeal, ExternalProduct, PartnerConnector, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET"] as const;

/**
 * AliExpress Open Platform adapter.
 * Placeholder until ALIEXPRESS_APP_KEY + ALIEXPRESS_APP_SECRET are configured.
 * Target API: aliexpress.affiliate.product.query
 */
export class AliExpressProvider extends BaseConnector {
  id = "aliexpress" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "aliexpress",
    name: "AliExpress",
    phase: "placeholder",
    apiDocs: "https://openservice.aliexpress.com/doc/api.htm",
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
    // Phase 2: call aliexpress.affiliate.product.query with signed request
    await this.logPlaceholderFetch("fetchProducts", ctx);
    return [];
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    if (!this.isConfigured()) return [];
    await this.logPlaceholderFetch("fetchDeals", ctx);
    return [];
  }

  private async logPlaceholderFetch(method: string, ctx: SyncContext) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[AliExpressProvider] ${method} placeholder — credentials set, API integration pending`,
        { store: ctx.storeSlug, country: ctx.countryCode }
      );
    }
  }
}

export function createAliExpressProvider(): AliExpressProvider {
  return new AliExpressProvider();
}

export function getAliExpressProviderId(): ImportProviderId {
  return "aliexpress";
}
