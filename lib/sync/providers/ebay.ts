import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["EBAY_APP_ID", "EBAY_CERT_ID"] as const;

/**
 * eBay Browse / Finding API adapter.
 * Placeholder until EBAY_APP_ID + EBAY_CERT_ID are configured.
 * Target API: GET /buy/browse/v1/item_summary/search
 */
export class EbayProvider extends BaseConnector {
  id = "ebay" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "ebay",
    name: "eBay",
    phase: "placeholder",
    apiDocs: "https://developer.ebay.com/api-docs/buy/static/api-browse.html",
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
        `[EbayProvider] ${method} placeholder — credentials set, API integration pending`,
        { store: ctx.storeSlug }
      );
    }
  }
}

export function createEbayProvider(): EbayProvider {
  return new EbayProvider();
}

export function getEbayProviderId(): ImportProviderId {
  return "ebay";
}
