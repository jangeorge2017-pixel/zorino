import type { ProductionProviderId } from "@/lib/integration/constants";
import {
  DEFAULT_INTEGRATION_COUNTRY,
  DEFAULT_INTEGRATION_CURRENCY,
} from "@/lib/integration/constants";
import type { SyncContext } from "@/lib/sync/types";
import type { StoreIntegrationType } from "@/lib/types/entities";

/**
 * Sync-layer store identity per provider.
 *
 * This is a SEPARATE data model from the display metadata in the provider
 * registry (lib/providers/registry.ts PROVIDER_STORE_META). These fields
 * describe the sync/DB store row (storeId, storeSlug) plus the
 * stores.integration_type CHECK-compatible value used by the sync engine.
 * Display name follows the provider's canonical name.
 */
const SYNC_STORE_META: Record<
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
  "amazon-eg": {
    storeId: "store-amazon-eg",
    storeSlug: "amazon-eg",
    integrationType: "amazon",
    name: "Amazon Egypt",
  },
  cjdropshipping: {
    storeId: "store-cjdropshipping",
    storeSlug: "cjdropshipping",
    integrationType: "partner",
    name: "CJdropshipping",
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
  admitad: {
    storeId: "store-admitad",
    storeSlug: "alibaba",
    integrationType: "partner",
    // Provider network identity. Individual merchants (e.g. "Alibaba" itself)
    // are carried per-offer via the offer storeName, not here.
    name: "Admitad",
  },
};

export function getSyncStoreMeta(providerId: string) {
  return SYNC_STORE_META[providerId as ProductionProviderId] ?? {
    storeId: `store-${providerId}`,
    storeSlug: providerId,
    integrationType: "partner",
    name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
  };
}

export function buildProviderSyncContext(
  providerId: ProductionProviderId,
  options?: {
    countryCode?: string;
    currency?: string;
    jobConfig?: SyncContext["jobConfig"];
  },
): SyncContext {
  const meta = SYNC_STORE_META[providerId];
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
  if (providerId in SYNC_STORE_META) {
    return providerId as ProductionProviderId;
  }
  return null;
}
