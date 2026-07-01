import type { DataProviderId } from "@/lib/data-layer/types/provider";

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ProductQueryParams extends PaginationParams {
  query?: string;
  categorySlug?: string;
  storeId?: string;
  countryCode?: string;
  currency?: string;
  inStockOnly?: boolean;
}

export interface StoreQueryParams extends PaginationParams {
  countryCode?: string;
  activeOnly?: boolean;
}

export interface PriceQueryParams extends PaginationParams {
  productId?: string;
  productIds?: string[];
  storeId?: string;
  countryCode?: string;
  currency?: string;
}

export interface CouponQueryParams extends PaginationParams {
  storeId?: string;
  storeSlug?: string;
  countryCode?: string;
  verifiedOnly?: boolean;
}

export interface CategoryQueryParams extends PaginationParams {
  parentId?: string | null;
  countryCode?: string;
  activeOnly?: boolean;
}

export type DataLayerOperation =
  | "products"
  | "product"
  | "stores"
  | "prices"
  | "coupons"
  | "categories";

export interface DataLayerRequestContext {
  providerId: DataProviderId;
  operation: DataLayerOperation;
  params?: Record<string, unknown>;
  skipCache?: boolean;
  priority?: number;
}
