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
};

export function getProviderStoreMeta(providerId: ProductionProviderId) {
  return STORE_META[providerId];
}

export function buildProviderSyncContext(
  providerId: ProductionProviderId,
  options?: { countryCode?: string; currency?: string },
): SyncContext {
  const meta = STORE_META[providerId];
  return {
    storeId: meta.storeId,
    storeSlug: meta.storeSlug,
    integrationType: meta.integrationType,
    countryCode: options?.countryCode ?? DEFAULT_INTEGRATION_COUNTRY,
    currency: options?.currency ?? DEFAULT_INTEGRATION_CURRENCY,
    connectorId: meta.integrationType,
  };
}
