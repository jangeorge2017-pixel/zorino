import type {
  Category,
  Coupon,
  Price,
  Product,
  Store,
} from "@/lib/types/entities";
import type { DataLayerError } from "@/lib/data-layer/types/errors";
import type {
  CategoryQueryParams,
  CouponQueryParams,
  PriceQueryParams,
  ProductQueryParams,
  StoreQueryParams,
} from "@/lib/data-layer/types/queries";

/** Supported marketplace / retailer provider identifiers. */
export const dataProviderIds = [
  "amazon",
  "ebay",
  "aliexpress",
  "walmart",
  "best-buy",
  "noon",
  "jarir",
  "extra",
  "btech",
  "raya",
] as const;

export type DataProviderId = (typeof dataProviderIds)[number];

export type ProviderCapability =
  | "products"
  | "stores"
  | "prices"
  | "coupons"
  | "categories";

export interface DataProviderMeta {
  id: DataProviderId;
  name: string;
  website: string;
  supportedRegions: string[];
  supportedCurrencies: string[];
  capabilities: ProviderCapability[];
  /** Environment variable keys required for live API access. */
  envKeys: string[];
  /** Requests per minute budget for rate limiting. */
  rateLimitPerMinute: number;
  /** Default cache TTL in milliseconds per operation. */
  defaultCacheTtlMs: number;
}

export interface ProviderResultMeta {
  providerId: DataProviderId;
  cached: boolean;
  durationMs: number;
  timestamp: string;
  attempt: number;
}

export interface ProviderResult<T> {
  success: boolean;
  data: T;
  error?: DataLayerError;
  meta: ProviderResultMeta;
}

/**
 * Contract every marketplace provider must implement.
 * Live HTTP clients plug into the protected fetch* methods later.
 */
export interface IDataProvider {
  readonly meta: DataProviderMeta;

  isConfigured(): boolean;

  getProducts(params?: ProductQueryParams): Promise<ProviderResult<Product[]>>;
  getProductById(
    id: string,
    params?: ProductQueryParams
  ): Promise<ProviderResult<Product | null>>;
  getStores(params?: StoreQueryParams): Promise<ProviderResult<Store[]>>;
  getPrices(params?: PriceQueryParams): Promise<ProviderResult<Price[]>>;
  getCoupons(params?: CouponQueryParams): Promise<ProviderResult<Coupon[]>>;
  getCategories(params?: CategoryQueryParams): Promise<ProviderResult<Category[]>>;
}

export function isDataProviderId(value: string): value is DataProviderId {
  return dataProviderIds.includes(value as DataProviderId);
}
