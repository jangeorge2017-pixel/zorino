import type {
  Category,
  Coupon,
  Price,
  Product,
  Store,
} from "@/lib/types/entities";
import { isEnvConfigured } from "@/lib/data-layer/config/env";
import { createDataLayerError } from "@/lib/data-layer/types/errors";
import type {
  CategoryQueryParams,
  CouponQueryParams,
  DataLayerOperation,
  PriceQueryParams,
  ProductQueryParams,
  StoreQueryParams,
} from "@/lib/data-layer/types";
import type {
  DataProviderMeta,
  IDataProvider,
  ProviderResult,
} from "@/lib/data-layer/types/provider";

function emptyMeta(
  providerId: DataProviderMeta["id"],
  attempt: number,
  cached: boolean,
  durationMs: number
) {
  return {
    providerId,
    cached,
    durationMs,
    timestamp: new Date().toISOString(),
    attempt,
  };
}

/**
 * Abstract base for all marketplace providers.
 * Subclasses override fetch* methods when wiring live APIs.
 */
export abstract class BaseDataProvider implements IDataProvider {
  abstract readonly meta: DataProviderMeta;

  isConfigured(): boolean {
    return isEnvConfigured(this.meta.envKeys);
  }

  async getProducts(params: ProductQueryParams = {}): Promise<ProviderResult<Product[]>> {
    return this.runOperation("products", params, () => this.fetchProducts(params), []);
  }

  async getProductById(
    id: string,
    params: ProductQueryParams = {}
  ): Promise<ProviderResult<Product | null>> {
    return this.runOperation("product", { ...params, id }, () =>
      this.fetchProductById(id, params), null);
  }

  async getStores(params: StoreQueryParams = {}): Promise<ProviderResult<Store[]>> {
    return this.runOperation("stores", params, () => this.fetchStores(params), []);
  }

  async getPrices(params: PriceQueryParams = {}): Promise<ProviderResult<Price[]>> {
    return this.runOperation("prices", params, () => this.fetchPrices(params), []);
  }

  async getCoupons(params: CouponQueryParams = {}): Promise<ProviderResult<Coupon[]>> {
    return this.runOperation("coupons", params, () => this.fetchCoupons(params), []);
  }

  async getCategories(
    params: CategoryQueryParams = {}
  ): Promise<ProviderResult<Category[]>> {
    return this.runOperation("categories", params, () => this.fetchCategories(params), []);
  }

  protected async runOperation<T>(
    _operation: DataLayerOperation,
    _params: object,
    fetcher: () => Promise<T>,
    emptyValue: T
  ): Promise<ProviderResult<T>> {
    const started = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        data: emptyValue,
        error: createDataLayerError(
          "NOT_CONFIGURED",
          `${this.meta.name} is not configured. Missing env: ${this.meta.envKeys.join(", ")}`,
          this.meta.id,
          { retryable: false }
        ),
        meta: emptyMeta(this.meta.id, 1, false, Date.now() - started),
      };
    }

    try {
      const data = await fetcher();
      return {
        success: true,
        data,
        meta: emptyMeta(this.meta.id, 1, false, Date.now() - started),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider fetch failed";
      return {
        success: false,
        data: emptyValue,
        error: createDataLayerError("PROVIDER_ERROR", message, this.meta.id, {
          cause: error,
          retryable: false,
        }),
        meta: emptyMeta(this.meta.id, 1, false, Date.now() - started),
      };
    }
  }

  /** Override in live provider implementations. */
  protected async fetchProducts(_params: ProductQueryParams): Promise<Product[]> {
    return [];
  }

  protected async fetchProductById(
    _id: string,
    _params: ProductQueryParams
  ): Promise<Product | null> {
    return null;
  }

  protected async fetchStores(_params: StoreQueryParams): Promise<Store[]> {
    return [];
  }

  protected async fetchPrices(_params: PriceQueryParams): Promise<Price[]> {
    return [];
  }

  protected async fetchCoupons(_params: CouponQueryParams): Promise<Coupon[]> {
    return [];
  }

  protected async fetchCategories(_params: CategoryQueryParams): Promise<Category[]> {
    return [];
  }
}
