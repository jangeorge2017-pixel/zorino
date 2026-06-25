import { getMockDealsForStore, getMockProductsForStore } from "@/lib/sync/mock-catalog";
import { finalizeExternalProduct } from "@/lib/sync/providers/shared/product-utils";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";

/** Mock connector — serves static catalog until partner APIs are connected. */
export class MockConnector extends BaseConnector {
  id = "mock" as const;

  isConfigured(): boolean {
    return true;
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    return getMockProductsForStore(ctx.storeSlug).map((p) =>
      finalizeExternalProduct(ctx, {
        ...p,
        countryCode: ctx.countryCode,
        currency: ctx.currency,
      })
    );
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return getMockDealsForStore(ctx.storeSlug).map((d) => ({
      ...d,
      countryCode: ctx.countryCode,
      currency: ctx.currency,
    }));
  }
}
