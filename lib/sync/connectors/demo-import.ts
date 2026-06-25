import { getMockDealsForStore, getMockProductsForStore } from "@/lib/sync/mock-catalog";
import { finalizeExternalProduct } from "@/lib/sync/providers/shared/product-utils";
import type { ImportProviderId } from "@/lib/sync/providers/types";
import { checkProviderCredentials } from "@/lib/sync/providers/types";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";

const PROVIDER_STORE_SLUG: Record<ImportProviderId, string> = {
  aliexpress: "aliexpress",
  ebay: "ebay",
  cjdropshipping: "cjdropshipping",
  amazon: "amazon",
  temu: "temu",
  walmart: "walmart",
};

/**
 * Demo/cached import connector — feeds the real pipeline when live API keys are absent.
 * Products flow through the same Supabase staging → merge path as live imports.
 */
export class DemoImportConnector extends BaseConnector {
  readonly id: ImportProviderId;

  constructor(providerId: ImportProviderId) {
    super();
    this.id = providerId;
  }

  isConfigured(): boolean {
    return true;
  }

  private storeSlug(): string {
    return PROVIDER_STORE_SLUG[this.id] ?? this.id;
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    return getMockProductsForStore(this.storeSlug()).map((p) =>
      finalizeExternalProduct(ctx, {
        ...p,
        countryCode: ctx.countryCode,
        currency: ctx.currency,
        description: p.description ?? `[Demo] ${p.title}`,
      })
    );
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return getMockDealsForStore(this.storeSlug()).map((d) => ({
      ...d,
      countryCode: ctx.countryCode,
      currency: ctx.currency,
    }));
  }

  async fetchPrices(ctx: SyncContext, externalIds: string[]) {
    const products = await this.fetchProducts(ctx);
    const idSet = new Set(externalIds);
    return products
      .filter((p) => idSet.has(p.externalId))
      .map((p) => ({
        externalId: p.externalId,
        price: p.price,
        originalPrice: p.originalPrice,
        currency: p.currency,
        inStock: p.inStock,
      }));
  }
}

export function createDemoImportConnector(providerId: ImportProviderId): DemoImportConnector {
  return new DemoImportConnector(providerId);
}

const PROVIDER_CREDENTIAL_KEYS: Partial<Record<ImportProviderId, string[]>> = {
  aliexpress: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET"],
  ebay: ["EBAY_APP_ID", "EBAY_CERT_ID"],
  cjdropshipping: ["CJDROPSHIPPING_API_KEY"],
  amazon: ["AMAZON_PAAPI_ACCESS_KEY", "AMAZON_PAAPI_SECRET_KEY"],
  temu: ["TEMU_API_KEY"],
  walmart: ["WALMART_API_KEY"],
};

export function isDemoImportMode(providerId: ImportProviderId): boolean {
  const keys = PROVIDER_CREDENTIAL_KEYS[providerId];
  if (!keys) return true;
  return !checkProviderCredentials(keys).configured;
}
