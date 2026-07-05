import type { ProductionProviderId } from "@/lib/integration/constants";
import {
  DEFAULT_INTEGRATION_COUNTRY,
  DEFAULT_INTEGRATION_CURRENCY,
} from "@/lib/integration/constants";
import type { SyncContext } from "@/lib/sync/types";
import type { StoreIntegrationType } from "@/lib/types/entities";

const STORE_META: Record<
  ProductionProviderId,
  { storeId: string; storeSlug: string; integrationType: StoreIntegrationType; name: string }
> = {
  aliexpress: {
    storeId: "store-aliexpress",
    storeSlug: "aliexpress",
    integrationType: "aliexpress",
    name: "AliExpress",
  },
  ebay: {
    storeId: "store-ebay",
    storeSlug: "ebay",
    integrationType: "ebay",
    name: "eBay",
  },
  amazon: {
    storeId: "store-amazon",
    storeSlug: "amazon",
    integrationType: "amazon",
    name: "Amazon",
  },
  walmart: {
    storeId: "store-walmart",
    storeSlug: "walmart",
    integrationType: "walmart",
    name: "Walmart",
  },
  bestbuy: {
    storeId: "store-bestbuy",
    storeSlug: "best-buy",
    integrationType: "partner",
    name: "Best Buy",
  },
  temu: {
    storeId: "store-temu",
    storeSlug: "default",
    integrationType: "temu",
    name: "Temu",
  },
  noon: {
    storeId: "store-noon",
    storeSlug: "noon",
    integrationType: "noon",
    name: "Noon",
  },
  jumia: {
    storeId: "store-jumia",
    storeSlug: "default",
    integrationType: "partner",
    name: "Jumia",
  },
};

export function getProviderStoreMeta(providerId: ProductionProviderId) {
  return STORE_META[providerId];
}

export function buildProviderSyncContext(
  providerId: ProductionProviderId,
  options?: {
    countryCode?: string;
    currency?: string;
    jobConfig?: SyncContext["jobConfig"];
  },
): SyncContext {
  const meta = STORE_META[providerId];
  return {
    storeId: meta.storeId,
    storeSlug: meta.storeSlug,
    integrationType: meta.integrationType,
    countryCode: options?.countryCode ?? DEFAULT_INTEGRATION_COUNTRY,
    currency: options?.currency ?? DEFAULT_INTEGRATION_CURRENCY,
    connectorId: meta.integrationType,
    jobConfig: options?.jobConfig,
  };
}

/** Map search provider id → production provider id (aligned 1:1). */
export function searchProviderToProductionId(
  providerId: string
): ProductionProviderId | null {
  if (providerId in STORE_META) {
    return providerId as ProductionProviderId;
  }
  return null;
}
