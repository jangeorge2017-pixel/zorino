import { PROVIDER_REGISTRY } from "@/lib/data-layer/config/providers";
import { BaseDataProvider } from "@/lib/data-layer/providers/base";
import type { ProductQueryParams } from "@/lib/data-layer/types";
import {
  externalProductToCatalogItem,
  externalProductsToCatalogItems,
} from "@/lib/integration/normalize";
import { buildProviderSyncContext } from "@/lib/integration/provider-context";
import type { ProductionProviderId } from "@/lib/integration/constants";
import { productionIdToDataProviderId } from "@/lib/integration/provider-map";
import type { AliExpressProvider } from "@/lib/sync/providers/aliexpress";
import type { Product } from "@/lib/types/entities";

/**
 * Bridges the live AliExpress sync connector into the data-layer Product contract.
 */
export abstract class SyncLiveProvider extends BaseDataProvider {
  abstract readonly providerId: ProductionProviderId;

  constructor(
    private connector: AliExpressProvider,
    private configured: () => boolean,
  ) {
    super();
  }

  get meta() {
    const dataId = productionIdToDataProviderId(this.providerId);
    if (!dataId) {
      return PROVIDER_REGISTRY.aliexpress;
    }
    return PROVIDER_REGISTRY[dataId];
  }

  isConfigured(): boolean {
    return this.configured();
  }

  protected async fetchProducts(params: ProductQueryParams = {}): Promise<Product[]> {
    const ctx = buildProviderSyncContext(this.providerId, {
      countryCode: params.countryCode,
      currency: params.currency,
    });

    const external = await this.connector.fetchProducts(ctx);
    const items = externalProductsToCatalogItems(this.providerId, external);
    const limit = params.limit ?? items.length;

    return items.slice(0, limit).map((item) => this.catalogItemToProduct(item));
  }

  protected async fetchProductById(
    id: string,
    params: ProductQueryParams = {},
  ): Promise<Product | null> {
    const products = await this.fetchProducts({ ...params, limit: 200 });
    return products.find((product) => product.id === id || product.slug === id) ?? null;
  }

  private catalogItemToProduct(
    item: ReturnType<typeof externalProductToCatalogItem>,
  ): Product {
    return {
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
    };
  }
}
