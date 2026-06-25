import type { ImportProviderId } from "@/lib/sync/providers/types";
import type { PartnerConnector } from "@/lib/sync/types";
import { createAmazonProvider } from "@/lib/sync/providers/amazon";
import { createAliExpressProvider } from "@/lib/sync/providers/aliexpress";
import { createCJdropshippingProvider } from "@/lib/sync/providers/cjdropshipping";
import { createEbayProvider } from "@/lib/sync/providers/ebay";
import { createTemuProvider } from "@/lib/sync/providers/temu";
import { createWalmartProvider } from "@/lib/sync/providers/walmart";
import { createDemoImportConnector } from "@/lib/sync/connectors/demo-import";
import { MockConnector } from "@/lib/sync/connectors/mock";

const mockConnector = new MockConnector();

const providerInstances: Record<ImportProviderId, PartnerConnector> = {
  amazon: createAmazonProvider(),
  aliexpress: createAliExpressProvider(),
  cjdropshipping: createCJdropshippingProvider(),
  ebay: createEbayProvider(),
  temu: createTemuProvider(),
  walmart: createWalmartProvider(),
};

const PHASE1_PROVIDER_IDS = new Set<ImportProviderId>([
  "aliexpress",
  "ebay",
  "cjdropshipping",
]);

/** Resolve provider — Phase 1 uses demo/cached catalog when live API keys are absent. */
export function getProviderAdapter(providerId: ImportProviderId | string): PartnerConnector {
  const adapter = providerInstances[providerId as ImportProviderId];
  if (!adapter) return mockConnector;

  if (PHASE1_PROVIDER_IDS.has(providerId as ImportProviderId)) {
    if (adapter.isConfigured()) return adapter;
    return createDemoImportConnector(providerId as ImportProviderId);
  }

  if (adapter.isConfigured()) return adapter;
  return mockConnector;
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
