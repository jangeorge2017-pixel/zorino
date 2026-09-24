import { createAmazonClientFromEnv, isAmazonDirectEnabled } from "@/lib/integrations/amazon";
import {
  getAmazonCreatorsConfig,
} from "@/lib/sync/providers/amazon/paapi-types";
import { mapAmazonProduct } from "@/lib/sync/providers/amazon/mapper";
import { mapAmazonScraperSyncProduct } from "@/lib/sync/providers/amazon/scraper-mapper";
import { fetchAmazonSearchScraper, isAmazonScraperAvailable } from "@/lib/integrations/amazon-scraper";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const CREDENTIAL_KEYS = [
  "AMAZON_CREATORS_CLIENT_ID",
  "AMAZON_CREATORS_CLIENT_SECRET",
] as const;

/**
 * Amazon Creators API — live search + catalog sync.
 * @see https://affiliate-program.amazon.com/creatorsapi/docs/en-us/
 */
export class AmazonProvider extends BaseConnector {
  id = "amazon" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "amazon",
    name: "Amazon",
    phase: "live",
    apiDocs: "https://affiliate-program.amazon.com/creatorsapi/docs/en-us/",
  };

  isConfigured(): boolean {
    // Phase 5 decision (AMAZON IS INDIRECT): this is the LATENT DIRECT sync
    // path (keyword → Creators API / storefront scraper). It must NOT
    // activate merely because credentials are later added to Vercel — it
    // requires the explicit AMAZON_DIRECT_ENABLE=1 architecture opt-in. The
    // approved indirect path (affiliate URL → host-guarded ASIN → ingestion)
    // does not go through the sync provider.
    if (!isAmazonDirectEnabled()) return false;
    if (checkProviderCredentials([...CREDENTIAL_KEYS, "AMAZON_ASSOCIATE_TAG"]).configured ||
      checkProviderCredentials([...CREDENTIAL_KEYS]).configured) {
      return true;
    }
    // Phase 6: the account-local Oxylabs scraper is retired (401). The local
    // open-source storefront scraper needs no keys, so when the direct opt-in
    // is set the provider is fully operational through it.
    return isAmazonScraperAvailable();
  }

  getCredentials() {
    return checkProviderCredentials([...CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) {
      throw this.notConfiguredError();
    }

    const client = createAmazonClientFromEnv();
    const keywords = ctx.jobConfig?.keywords ?? ["electronics"];
    const maxPages = Math.min(ctx.jobConfig?.maxPages ?? 5, 10);
    const products: ExternalProduct[] = [];

    // Creators API path (preferred when credentials configured).
    if (client) {
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
      if (products.length > 0) return products;
    }

    // Storefront scraper path (no credentials). Searches the real Amazon US +
    // UK storefronts and builds affiliate-tagged product URLs for the same
    // sync/catalog pipeline.
    for (const keyword of keywords) {
      try {
        const [us, uk] = await Promise.all([
          fetchAmazonSearchScraper(keyword, "amazon-storefront"),
          fetchAmazonSearchScraper(keyword, "amazon-co-uk"),
        ]);
        for (const item of [...us, ...uk]) {
          const external = mapAmazonScraperSyncProduct(ctx, item);
          if (external) products.push(external);
        }
      } catch {
        // A scraper failure must never abort the whole sync job.
      }
      if (products.length >= 20) break;
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
export { getAmazonCreatorsConfig };
