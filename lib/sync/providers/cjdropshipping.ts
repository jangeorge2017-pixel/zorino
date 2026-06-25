import { CJdropshippingClient } from "@/lib/sync/providers/cjdropshipping/client";
import { mapCJProduct } from "@/lib/sync/providers/cjdropshipping/mapper";
import { resolveImportConfig } from "@/lib/sync/providers/shared/import-config";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["CJDROPSHIPPING_API_KEY"] as const;

/**
 * CJdropshipping product list API.
 * @see https://developers.cjdropshipping.com/
 */
export class CJdropshippingProvider extends BaseConnector {
  id = "cjdropshipping" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "cjdropshipping",
    name: "CJdropshipping",
    phase: "live",
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

    const apiKey = process.env.CJDROPSHIPPING_API_KEY!.trim();
    const client = new CJdropshippingClient(apiKey);
    const config = resolveImportConfig("cjdropshipping", ctx.jobConfig as Record<string, unknown>);
    const rawProducts = await client.searchProducts(config);

    const products: ExternalProduct[] = [];
    for (const raw of rawProducts) {
      const mapped = mapCJProduct(ctx, raw, config.categorySlug);
      if (mapped) products.push(mapped);
    }
    return products;
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return [];
  }

  async fetchPrices(
    ctx: SyncContext,
    externalIds: string[]
  ): Promise<
    Pick<ExternalProduct, "externalId" | "price" | "originalPrice" | "currency" | "inStock">[]
  > {
    if (!this.isConfigured() || externalIds.length === 0) return [];

    const apiKey = process.env.CJDROPSHIPPING_API_KEY!.trim();
    const client = new CJdropshippingClient(apiKey);
    const rawProducts = await client.getProductsByIds(externalIds);

    return rawProducts
      .map((raw) => {
        const mapped = mapCJProduct(ctx, raw);
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

export function createCJdropshippingProvider(): CJdropshippingProvider {
  return new CJdropshippingProvider();
}

export function getCJdropshippingProviderId(): ImportProviderId {
  return "cjdropshipping";
}
