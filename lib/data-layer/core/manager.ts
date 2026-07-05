import { getDataLayerConfig } from "@/lib/data-layer/config/env";
import {
  getProviderMeta,
  resolveProviderByStoreSlug,
} from "@/lib/data-layer/config/providers";
import { buildCacheKey, globalDataLayerCache } from "@/lib/data-layer/core/cache";
import { toFailedResult } from "@/lib/data-layer/core/errors";
import { dataLayerLogger } from "@/lib/data-layer/core/logger";
import { globalRateLimiter } from "@/lib/data-layer/core/rate-limit";
import { globalRequestQueue } from "@/lib/data-layer/core/queue";
import { withRetry } from "@/lib/data-layer/core/retry";
import { getDataProvider, listDataProviders } from "@/lib/data-layer/providers";
import { DATA_LAYER_PRODUCTION_IDS } from "@/lib/integration/provider-map";
import type {
  CategoryQueryParams,
  CouponQueryParams,
  DataLayerOperation,
  PriceQueryParams,
  ProductQueryParams,
  StoreQueryParams,
} from "@/lib/data-layer/types";
import type { DataProviderId, IDataProvider, ProviderResult } from "@/lib/data-layer/types";
import { dataProviderIds, isDataProviderId } from "@/lib/data-layer/types";

export interface ExecuteOptions {
  skipCache?: boolean;
  skipQueue?: boolean;
  skipRateLimit?: boolean;
  cacheTtlMs?: number;
}

type OperationHandler<T> = (provider: IDataProvider) => Promise<ProviderResult<T>>;

/**
 * Central router for all provider data requests.
 * Applies cache → rate limit → queue → retry → provider pipeline.
 */
export class ProviderManager {
  private config = getDataLayerConfig();

  constructor() {
    dataLayerLogger.setLevel(
      this.config.logLevel as "debug" | "info" | "warn" | "error"
    );
  }

  getProvider(id: DataProviderId): IDataProvider {
    return getDataProvider(id);
  }

  listProviders(): IDataProvider[] {
    return listDataProviders();
  }

  resolveByStoreSlug(storeSlug: string): IDataProvider | null {
    const providerId = resolveProviderByStoreSlug(storeSlug);
    if (!providerId) return null;
    return getDataProvider(providerId);
  }

  resolveProviderId(storeSlug: string): DataProviderId | null {
    return resolveProviderByStoreSlug(storeSlug);
  }

  async getProducts(
    providerId: DataProviderId,
    params?: ProductQueryParams,
    options?: ExecuteOptions
  ) {
    return this.execute(providerId, "products", params, (provider) =>
      provider.getProducts(params)
    , options);
  }

  async getProductById(
    providerId: DataProviderId,
    id: string,
    params?: ProductQueryParams,
    options?: ExecuteOptions
  ) {
    return this.execute(providerId, "product", { ...params, id }, (provider) =>
      provider.getProductById(id, params)
    , options);
  }

  async getStores(
    providerId: DataProviderId,
    params?: StoreQueryParams,
    options?: ExecuteOptions
  ) {
    return this.execute(providerId, "stores", params, (provider) =>
      provider.getStores(params)
    , options);
  }

  async getPrices(
    providerId: DataProviderId,
    params?: PriceQueryParams,
    options?: ExecuteOptions
  ) {
    return this.execute(providerId, "prices", params, (provider) =>
      provider.getPrices(params)
    , options);
  }

  async getCoupons(
    providerId: DataProviderId,
    params?: CouponQueryParams,
    options?: ExecuteOptions
  ) {
    return this.execute(providerId, "coupons", params, (provider) =>
      provider.getCoupons(params)
    , options);
  }

  async getCategories(
    providerId: DataProviderId,
    params?: CategoryQueryParams,
    options?: ExecuteOptions
  ) {
    return this.execute(providerId, "categories", params, (provider) =>
      provider.getCategories(params)
    , options);
  }

  /** Fan-out across all configured providers for an operation. */
  async getProductsFromAll(params?: ProductQueryParams, options?: ExecuteOptions) {
    return this.fanOut("products", (id) => this.getProducts(id, params, options));
  }

  /** Fan-out across AliExpress + eBay production providers only. */
  async getProductsFromProductionProviders(
    params?: ProductQueryParams,
    options?: ExecuteOptions,
  ) {
    return this.fanOutProviders(DATA_LAYER_PRODUCTION_IDS, (id) =>
      this.getProducts(id, params, options),
    );
  }

  async getConfiguredProductionProviders(): Promise<IDataProvider[]> {
    return DATA_LAYER_PRODUCTION_IDS.map((id) => getDataProvider(id)).filter((provider) =>
      provider.isConfigured(),
    );
  }

  async getConfiguredProviders(): Promise<IDataProvider[]> {
    return listDataProviders().filter((provider) => provider.isConfigured());
  }

  getHealthSummary() {
    return listDataProviders().map((provider) => ({
      id: provider.meta.id,
      name: provider.meta.name,
      configured: provider.isConfigured(),
      capabilities: provider.meta.capabilities,
      cache: globalDataLayerCache.stats(),
      queue: globalRequestQueue.stats(),
    }));
  }

  private async fanOut<T>(
    operation: DataLayerOperation,
    runner: (providerId: DataProviderId) => Promise<ProviderResult<T[]>>
  ) {
    return this.fanOutProviders(dataProviderIds as unknown as DataProviderId[], runner);
  }

  private async fanOutProviders<T>(
    providerIds: readonly DataProviderId[],
    runner: (providerId: DataProviderId) => Promise<ProviderResult<T[]>>,
  ) {
    const results = await Promise.all(providerIds.map((id) => runner(id)));

    const data = results.flatMap((result) => (result.success ? result.data : []));
    const errors = results
      .filter((result) => !result.success && result.error)
      .map((result) => result.error!);

    return {
      success: errors.length === 0,
      data,
      errors,
      providers: results.length,
    };
  }

  private async execute<T>(
    providerId: DataProviderId,
    operation: DataLayerOperation,
    params: object | undefined,
    handler: OperationHandler<T>,
    options: ExecuteOptions = {}
  ): Promise<ProviderResult<T>> {
    if (!this.config.enabled) {
      return toFailedResult<T>(
        new Error("Data layer is disabled"),
        providerId,
        operation,
        { durationMs: 0, attempt: 1 }
      );
    }

    if (!isDataProviderId(providerId)) {
      return toFailedResult<T>(
        new Error(`Unknown provider: ${providerId}`),
        providerId,
        operation,
        { durationMs: 0, attempt: 1 }
      );
    }

    const meta = getProviderMeta(providerId);
    const cacheKey = buildCacheKey(
      providerId,
      operation,
      params as Record<string, unknown> | undefined
    );
    const ttl = options.cacheTtlMs ?? meta.defaultCacheTtlMs;

    if (!options.skipCache) {
      const cached = globalDataLayerCache.get<ProviderResult<T>>(cacheKey);
      if (cached) {
        dataLayerLogger.debug("Cache hit", { providerId, operation });
        return {
          ...cached,
          meta: { ...cached.meta, cached: true },
        };
      }
    }

    const started = Date.now();

    const run = async (attempt: number): Promise<ProviderResult<T>> => {
      if (!options.skipRateLimit) {
        globalRateLimiter.assertAllowed(providerId, meta.rateLimitPerMinute);
      }

      const provider = getDataProvider(providerId);
      const result = await handler(provider);

      return {
        ...result,
        meta: {
          ...result.meta,
          attempt,
          durationMs: Date.now() - started,
        },
      };
    };

    try {
      const executeTask = () =>
        withRetry((attempt) => run(attempt), {
          maxAttempts: this.config.maxRetries,
          baseDelayMs: this.config.retryBaseMs,
          providerId,
          operation,
        });

      const result = options.skipQueue
        ? await executeTask()
        : await globalRequestQueue.enqueue(providerId, operation, executeTask);

      if (result.success && !options.skipCache) {
        globalDataLayerCache.set(cacheKey, result, ttl);
      }

      dataLayerLogger.info("Provider request completed", {
        providerId,
        operation,
        success: result.success,
        cached: result.meta.cached,
        durationMs: result.meta.durationMs,
      });

      return result;
    } catch (error) {
      return toFailedResult<T>(error, providerId, operation, {
        durationMs: Date.now() - started,
        attempt: this.config.maxRetries,
      });
    }
  }
}

let singletonManager: ProviderManager | null = null;

export function getProviderManager(): ProviderManager {
  if (!singletonManager) {
    singletonManager = new ProviderManager();
  }
  return singletonManager;
}
