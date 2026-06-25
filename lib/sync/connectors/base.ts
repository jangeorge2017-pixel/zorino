import type { ExternalDeal, ExternalProduct, PartnerConnector, SyncContext } from "@/lib/sync/types";

export abstract class BaseConnector implements PartnerConnector {
  abstract id: PartnerConnector["id"];

  abstract isConfigured(): boolean;

  abstract fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]>;

  abstract fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]>;

  async fetchPrices(
    ctx: SyncContext,
    externalIds: string[]
  ): Promise<Pick<ExternalProduct, "externalId" | "price" | "originalPrice" | "currency" | "inStock">[]> {
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

  protected notConfiguredError(): Error {
    return new Error(`Connector "${this.id}" is not configured — set API credentials or use mock mode.`);
  }
}
