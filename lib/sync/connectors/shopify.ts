import { BaseConnector } from "@/lib/sync/connectors/base";
import { MockConnector } from "@/lib/sync/connectors/mock";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";

/** Shopify Storefront / Admin API connector (stub — falls back to mock until configured). */
export class ShopifyConnector extends BaseConnector {
  id = "shopify" as const;
  private fallback = new MockConnector();

  isConfigured(): boolean {
    return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) return this.fallback.fetchProducts(ctx);
    // TODO: GET /admin/api/2024-01/products.json
    return [];
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    if (!this.isConfigured()) return this.fallback.fetchDeals(ctx);
    return [];
  }
}
