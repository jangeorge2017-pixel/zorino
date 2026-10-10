import {
  AliExpressAffiliateClient,
  getAliExpressCredentials,
  isAliExpressConfigured,
} from "@/lib/integrations/aliexpress";
import { mapAliExpressProduct } from "@/lib/sync/providers/aliexpress/mapper";
import { resolveImportConfig } from "@/lib/sync/providers/shared/import-config";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";
import {
  advanceSweepCursor,
  ALIEXPRESS_CHUNK_RESULT_COUNT,
  startSweepCursor,
  type AliExpressImportCursor,
} from "@/lib/integrations/aliexpress/import-cursor";

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

  private client(): AliExpressAffiliateClient {
    const creds = getAliExpressCredentials();
    if (!creds) throw this.notConfiguredError();
    return new AliExpressAffiliateClient(creds.appKey, creds.appSecret, creds.trackingId);
  }

  isConfigured(): boolean {
    return isAliExpressConfigured();
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) {
      throw this.notConfiguredError();
    }

    const client = this.client();
    const config = resolveImportConfig("aliexpress", ctx.jobConfig as Record<string, unknown>);
    const rawProducts = await client.searchProducts(config, ctx.currency);

    const products: ExternalProduct[] = [];
    for (const raw of rawProducts) {
      const mapped = mapAliExpressProduct(ctx, raw, config.categorySlug);
      if (mapped) products.push(mapped);
    }
    return products;
  }

  /**
   * Chunked sweep fetch — one keyword page per call (resumes from a cursor).
   *
   * The scheduled cron cannot run the whole keyword×page sweep in one
   * invocation (Vercel Hobby 60s / Cloudflare 504). Callers drive the sweep
   * with an `AliExpressImportCursor`, persist it after each chunk, and the next
   * invocation resumes exactly where the last one stopped.
   */
  async fetchProductsChunk(
    ctx: SyncContext,
    cursor: AliExpressImportCursor | null,
  ): Promise<{
    products: ExternalProduct[];
    next: AliExpressImportCursor | null;
    done: boolean;
  }> {
    if (!this.isConfigured()) {
      throw this.notConfiguredError();
    }

    const client = this.client();
    const config = resolveImportConfig("aliexpress", ctx.jobConfig as Record<string, unknown>);
    const keywords = config.keywords ?? ["electronics"];
    const pageSize = Math.min(ALIEXPRESS_CHUNK_RESULT_COUNT, 50);

    const start = cursor ?? startSweepCursor();
    if (start.type !== "sweep") {
      return { products: [], next: null, done: true };
    }

    const keywordIndex = Math.max(0, Math.trunc(start.keywordIndex) || 0);
    if (keywordIndex >= keywords.length) {
      return { products: [], next: null, done: true };
    }

    const page = Math.max(1, Math.trunc(start.page) || 1);
    const keyword = keywords[keywordIndex];

    const rawProducts = await client.searchByKeyword(keyword, {
      pageNo: page,
      pageSize,
      currency: ctx.currency,
    });

    const products: ExternalProduct[] = [];
    for (const raw of rawProducts) {
      const mapped = mapAliExpressProduct(ctx, raw, config.categorySlug);
      if (mapped) products.push(mapped);
    }

    const { next, done } = advanceSweepCursor(
      start,
      keywords.length,
      config.maxPages ?? 3,
      pageSize,
      rawProducts.length,
    );

    return { products, next, done };
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

    const client = this.client();
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
