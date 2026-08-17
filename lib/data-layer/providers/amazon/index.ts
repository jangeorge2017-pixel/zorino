import type { DataProviderMeta } from "@/lib/data-layer/types";
import { BaseDataProvider } from "@/lib/data-layer/providers/base";
import type { ProductQueryParams } from "@/lib/data-layer/types";
import {
  externalProductsToCatalogItems,
} from "@/lib/integration/normalize";
import { buildProviderSyncContext } from "@/lib/integration/provider-context";
import { isAmazonConfigured } from "@/lib/integrations/amazon";
import { createAmazonProvider } from "@/lib/sync/providers/amazon";
import { PROVIDER_REGISTRY } from "@/lib/data-layer/config/providers";
import { productionIdToDataProviderId } from "@/lib/integration/provider-map";
import type { Product } from "@/lib/types/entities";

class AmazonLiveProvider extends BaseDataProvider {
  readonly providerId = "amazon" as const;

  readonly meta: DataProviderMeta = (() => {
    const dataId = productionIdToDataProviderId("amazon");
    return (dataId ? PROVIDER_REGISTRY[dataId] : PROVIDER_REGISTRY.amazon) as DataProviderMeta;
  })();

  isConfigured(): boolean {
    return isAmazonConfigured();
  }

  protected async fetchProducts(params: ProductQueryParams = {}): Promise<Product[]> {
    const connector = createAmazonProvider();
    if (!connector.isConfigured()) return [];

    const ctx = buildProviderSyncContext(this.providerId, {
      countryCode: params.countryCode,
      currency: params.currency,
    });

    const external = await connector.fetchProducts(ctx);
    const items = externalProductsToCatalogItems(this.providerId, external);
    const limit = params.limit ?? items.length;

    return items.slice(0, limit).map((item) => ({
      id: item.id,
      name: item.title,
      slug: item.slug,
      imageUrl: item.imageUrl,
      emoji: item.emoji,
      categorySlug: item.categorySlug,
      rating: item.rating,
      reviewCount: item.reviewCount,
      currency: item.currency,
      countryCode: item.countryCode,
      inStock: item.offers[0]?.inStock ?? true,
      tags: item.providerIds,
      isActive: true,
    }));
  }
}

export const amazonProvider = new AmazonLiveProvider();
export default amazonProvider;
