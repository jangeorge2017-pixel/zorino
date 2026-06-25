import { AliExpressClient } from "@/lib/sync/providers/aliexpress/client";
import { mapAliExpressProduct } from "@/lib/sync/providers/aliexpress/mapper";
import { resolveImportConfig } from "@/lib/sync/providers/shared/import-config";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET"] as const;

/**
 * AliExpress Open Platform — affiliate product query API.
 * @see https://openservice.aliexpress.com/doc/api.htm
 */
export class AliExpressProvider extends BaseConnector {
  id = "aliexpress" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "aliexpress",
    name: "AliExpress",
    phase: "live",
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

    const appKey = process.env.ALIEXPRESS_APP_KEY!.trim();
    const appSecret = process.env.ALIEXPRESS_APP_SECRET!.trim();
    const trackingId = process.env.ALIEXPRESS_TRACKING_ID?.trim();

    const client = new AliExpressClient(appKey, appSecret, trackingId);
    const config = resolveImportConfig("aliexpress", ctx.jobConfig as Record<string, unknown>);
    const rawProducts = await client.searchProducts(config, ctx.currency);

    const products: ExternalProduct[] = [];
    for (const raw of rawProducts) {
      const mapped = mapAliExpressProduct(ctx, raw, config.categorySlug);
      if (mapped) products.push(mapped);
    }
    return products;
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    const products = await this.fetchProducts(ctx);
    return products
      .filter((p) => p.discount && p.discount > 0)
      .slice(0, 8)
      .map((p) => ({
        externalProductId: p.externalId,
        title: p.title,
        discount: p.discount ?? 0,
        discountType: p.discountType ?? "percentage",
        price: p.price,
        originalPrice: p.originalPrice ?? p.price,
        currency: p.currency,
        countryCode: p.countryCode,
        imageUrl: p.imageUrl,
        productUrl: p.affiliateUrl ?? p.productUrl,
      }));
  }

  async fetchPrices(
    ctx: SyncContext,
    externalIds: string[]
  ): Promise<
    Pick<ExternalProduct, "externalId" | "price" | "originalPrice" | "currency" | "inStock">[]
  > {
    if (!this.isConfigured() || externalIds.length === 0) return [];

    const appKey = process.env.ALIEXPRESS_APP_KEY!.trim();
    const appSecret = process.env.ALIEXPRESS_APP_SECRET!.trim();
    const trackingId = process.env.ALIEXPRESS_TRACKING_ID?.trim();
    const client = new AliExpressClient(appKey, appSecret, trackingId);
    const rawProducts = await client.getProductsByIds(externalIds, ctx.currency);

    return rawProducts
      .map((raw) => {
        const mapped = mapAliExpressProduct(ctx, raw);
        if (!mapped) return null;
        return {
          externalId: mapped.externalId,
          price: mapped.price,
          originalPrice: mapped.originalPrice,
          currency: mapped.currency,
          inStock: mapped.inStock,
        };
      })
      .filter(Boolean) as Pick<
      ExternalProduct,
      "externalId" | "price" | "originalPrice" | "currency" | "inStock"
    >[];
  }
}

export function createAliExpressProvider(): AliExpressProvider {
  return new AliExpressProvider();
}

export function getAliExpressProviderId(): ImportProviderId {
  return "aliexpress";
}
