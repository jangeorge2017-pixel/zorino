import {
  EbayAffiliateClient,
  getEbayCredentials,
  isEbayConfigured,
} from "@/lib/integrations/ebay";
import { mapEbayProduct } from "@/lib/sync/providers/ebay/mapper";
import { resolveImportConfig } from "@/lib/sync/providers/shared/import-config";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = ["EBAY_APP_ID", "EBAY_CERT_ID"] as const;

/**
 * eBay Browse API — affiliate-aware item search.
 * @see https://developer.ebay.com/api-docs/buy/static/api-browse.html
 */
export class EbayProvider extends BaseConnector {
  id = "ebay" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "ebay",
    name: "eBay",
    phase: "live",
    apiDocs: "https://developer.ebay.com/api-docs/buy/static/api-browse.html",
  };

  private client(): EbayAffiliateClient {
    const creds = getEbayCredentials();
    if (!creds) throw this.notConfiguredError();
    return new EbayAffiliateClient(creds.campaignId);
  }

  isConfigured(): boolean {
    return isEbayConfigured();
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) {
      throw this.notConfiguredError();
    }

    const client = this.client();
    const config = resolveImportConfig("ebay", ctx.jobConfig as Record<string, unknown>);
    const rawItems = await client.searchProducts(config, ctx.countryCode);

    const products: ExternalProduct[] = [];
    for (const raw of rawItems) {
      const mapped = mapEbayProduct(ctx, raw, config.categorySlug);
      if (mapped) products.push(mapped);
    }
    return products;
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    const products = await this.fetchProducts(ctx);
    return products
      .filter((p) => (p.discount ?? 0) > 0 || (p.originalPrice ?? p.price) > p.price)
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

    const client = this.client();
    const rawItems = await client.getItemsByIds(externalIds, ctx.countryCode);

    return rawItems
      .map((raw) => {
        const mapped = mapEbayProduct(ctx, raw);
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

export function createEbayProvider(): EbayProvider {
  return new EbayProvider();
}

export function getEbayProviderId(): ImportProviderId {
  return "ebay";
}
