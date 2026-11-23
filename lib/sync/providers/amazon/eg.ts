import { fetchAmazonSearchScraper } from "@/lib/integrations/amazon-scraper";
import { BaseConnector } from "@/lib/sync/connectors/base";
import { normalizeAmazonScraperSearchResults } from "@/lib/search/normalization";
import {
  externalProductsToDeals,
  rawListingToExternalProduct,
} from "@/lib/sync/providers/shared/storefront-catalog";
import {
  checkProviderCredentials,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";

export class AmazonEgProvider extends BaseConnector {
  id = "amazon-eg" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "amazon-eg",
    name: "Amazon Egypt",
    phase: "live",
  };

  isConfigured(): boolean {
    return true;
  }

  getCredentials() {
    return checkProviderCredentials([]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    const keywords = ctx.jobConfig?.keywords?.length
      ? ctx.jobConfig.keywords
      : ["iphone", "samsung galaxy", "laptop", "smart tv", "headphones"];
    const maxPages = Math.min(Math.max(ctx.jobConfig?.maxPages ?? 2, 1), 3);
    const pageSize = Math.min(Math.max(ctx.jobConfig?.pageSize ?? 24, 1), 50);
    const seen = new Set<string>();
    const products: ExternalProduct[] = [];

    for (const query of keywords) {
      const raw = await fetchAmazonSearchScraper(query, "amazon-eg", pageSize * maxPages, true);
      for (const listing of normalizeAmazonScraperSearchResults(raw, "amazon-eg")) {
        if (!listing.externalId || seen.has(listing.externalId)) continue;
        const product = rawListingToExternalProduct("amazon-eg", listing, ctx);
        if (!product) continue;
        seen.add(listing.externalId);
        products.push(product);
      }
    }

    return products;
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    return externalProductsToDeals(await this.fetchProducts(ctx));
  }
}

export function createAmazonEgProvider(): AmazonEgProvider {
  return new AmazonEgProvider();
}
