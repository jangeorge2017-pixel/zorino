import type { ImportProviderId } from "@/lib/sync/providers/types";
import type { PartnerConnector } from "@/lib/sync/types";
import { createAmazonProvider } from "@/lib/sync/providers/amazon";
import { createAliExpressProvider } from "@/lib/sync/providers/aliexpress";
import { createCJdropshippingProvider } from "@/lib/sync/providers/cjdropshipping";
import { createEbayProvider } from "@/lib/sync/providers/ebay";
import { createTemuProvider } from "@/lib/sync/providers/temu";
import { createWalmartProvider } from "@/lib/sync/providers/walmart";
const providerInstances: Record<ImportProviderId, PartnerConnector> = {
  amazon: createAmazonProvider(),
  aliexpress: createAliExpressProvider(),
  cjdropshipping: createCJdropshippingProvider(),
  ebay: createEbayProvider(),
  temu: createTemuProvider(),
  walmart: createWalmartProvider(),
};

/** Resolve provider — live adapters only; never fall back to mock/demo catalogs. */
export function getProviderAdapter(providerId: ImportProviderId | string): PartnerConnector {
  const adapter = providerInstances[providerId as ImportProviderId];
  if (!adapter) {
    return createAliExpressProvider();
  }
  return adapter;
}

export function listProviderAdapters(): PartnerConnector[] {
  return Object.values(providerInstances);
}

export function isImportProviderId(value: string): value is ImportProviderId {
  return value in providerInstances;
}

export {
  createAmazonProvider,
  createAliExpressProvider,
  createCJdropshippingProvider,
  createEbayProvider,
  createTemuProvider,
  createWalmartProvider,
};
