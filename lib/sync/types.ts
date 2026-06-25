/**
 * Sync pipeline types for external partner product ingestion.
 */

import type { DiscountType, StoreIntegrationType } from "@/lib/types/entities";

export type SyncJobType = "products" | "prices" | "deals" | "images" | "full";
export type SyncRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type ProductSyncStatus = "idle" | "pending" | "syncing" | "synced" | "failed" | "stale";
export type ConnectorId = StoreIntegrationType | "mock";
export type ImportProviderId = "amazon" | "aliexpress" | "cjdropshipping" | "ebay";

/** Normalized payload from any partner connector before DB persistence. */
export interface ExternalProduct {
  externalId: string;
  title: string;
  titleAr?: string;
  slug: string;
  description?: string;
  brand?: string;
  categorySlug: string;
  imageUrl: string;
  imageUrls?: string[];
  emoji?: string;
  price: number;
  originalPrice?: number;
  currency: string;
  countryCode: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
  productUrl: string;
  affiliateUrl?: string;
  specifications?: Record<string, string>;
  tags?: string[];
  discount?: number;
  discountType?: DiscountType;
}

export interface ExternalDeal {
  externalProductId: string;
  title: string;
  discount: number;
  discountType: DiscountType;
  price: number;
  originalPrice: number;
  currency: string;
  countryCode: string;
  imageUrl: string;
  productUrl: string;
  isFeatured?: boolean;
  sortOrder?: number;
}

export interface SyncContext {
  storeId: string;
  storeSlug: string;
  integrationType: StoreIntegrationType;
  countryCode: string;
  currency: string;
  connectorId: ConnectorId;
}

export interface SyncJobDefinition {
  id?: string;
  storeId?: string;
  jobType: SyncJobType;
  countryCode: string;
  currency: string;
  intervalMinutes: number;
  connectorId: ConnectorId;
}

export interface SyncRunResult {
  jobType: SyncJobType;
  status: SyncRunStatus;
  itemsFetched: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsFailed: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface PartnerConnector {
  id: ConnectorId;
  isConfigured(): boolean;
  fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]>;
  fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]>;
  fetchPrices(ctx: SyncContext, externalIds: string[]): Promise<Pick<ExternalProduct, "externalId" | "price" | "originalPrice" | "currency" | "inStock">[]>;
}

export interface SyncEngineOptions {
  persist?: boolean;
  dryRun?: boolean;
}
