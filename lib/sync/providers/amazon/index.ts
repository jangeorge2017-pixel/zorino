import { createAmazonClientFromEnv } from "@/lib/integrations/amazon";
import {
  getAmazonPaApiConfig,
  mapAmazonItemToNormalized,
} from "@/lib/sync/providers/amazon/paapi-types";
import { mapAmazonProduct } from "@/lib/sync/providers/amazon/mapper";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = [
  "AMAZON_PAAPI_ACCESS_KEY",
  "AMAZON_PAAPI_SECRET_KEY",
] as const;

/**
 * Amazon Product Advertising API 5.0 — live search + catalog sync.
 * @see https://webservices.amazon.com/paapi5/documentation/
 */
export class AmazonProvider extends BaseConnector {
  id = "amazon" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "amazon",
    name: "Amazon",
    phase: "live",
    apiDocs: "https://webservices.amazon.com/paapi5/documentation/",
  };

  isConfigured(): boolean {
    return checkProviderCredentials([...CREDENTIAL_KEYS, "AMAZON_ASSOCIATE_TAG"]).configured ||
      checkProviderCredentials([...CREDENTIAL_KEYS]).configured;
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) {
      throw this.notConfiguredError();
    }

    const client = createAmazonClientFromEnv();
    if (!client) return [];

    const keywords = ctx.jobConfig?.keywords ?? ["electronics"];
    const maxPages = Math.min(ctx.jobConfig?.maxPages ?? 5, 10);
    const products: ExternalProduct[] = [];

    for (const keyword of keywords) {
      const items = await client.searchByKeyword(keyword, {
        itemCount: 10,
        maxPages,
      });
      for (const raw of items) {
        const external = mapAmazonProduct(ctx, raw);
        if (external) products.push(external);
      }
    }

    return products;
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    const products = await this.fetchProducts(ctx);
    return products
      .filter((p) => (p.discount ?? 0) > 0 || (p.originalPrice ?? p.price) > p.price)
      .slice(0, 12)
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
}

export function createAmazonProvider(): AmazonProvider {
  return new AmazonProvider();
}

export function getAmazonProviderId(): ImportProviderId {
  return "amazon";
}

// Re-export for backward compatibility
export { getAmazonPaApiConfig, mapAmazonItemToNormalized };
