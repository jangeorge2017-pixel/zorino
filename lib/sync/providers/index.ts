import type { ImportProviderId } from "@/lib/sync/providers/types";
import type { PartnerConnector } from "@/lib/sync/types";
import { createAmazonProvider } from "@/lib/sync/providers/amazon";
import { createAliExpressProvider } from "@/lib/sync/providers/aliexpress";
import { createCJdropshippingProvider } from "@/lib/sync/providers/cjdropshipping";
import { createEbayProvider } from "@/lib/sync/providers/ebay";
import { createTemuProvider } from "@/lib/sync/providers/temu";
import { createWalmartProvider } from "@/lib/sync/providers/walmart";
import { createBestBuyProvider } from "@/lib/sync/providers/bestbuy";
import { createNoonProvider } from "@/lib/sync/providers/amazon/noon";
import { createJumiaProvider } from "@/lib/sync/providers/jumia";
const providerInstances: Record<ImportProviderId, PartnerConnector> = {
  amazon: createAmazonProvider(),
  aliexpress: createAliExpressProvider(),
  cjdropshipping: createCJdropshippingProvider(),
  ebay: createEbayProvider(),
  temu: createTemuProvider(),
  walmart: createWalmartProvider(),
  bestbuy: createBestBuyProvider(),
  noon: createNoonProvider(),
  jumia: createJumiaProvider(),
};

/** Resolve provider — live adapters only; never fall back to mock/demo catalogs. */
export function getProviderAdapter(providerId: ImportProviderId | string): PartnerConnector {
  const adapter = providerInstances[providerId as ImportProviderId];
  if (!adapter) {
    throw new Error(
      `Unknown sync provider adapter: "${providerId}". Register the provider in providerInstances — an unknown provider must never silently alias to a different (e.g. AliExpress) adapter.`,
    );
  }
  return adapter;
}

/**
 * Capability gate: whether a sync provider adapter can actually produce real
 * products. Placeholder adapters (phase "placeholder") return empty sets by
 * design — they must never be advertised as available merely because
 * credentials exist (see the sync-bridge availability check). A "live" phase
 * only means a real client path exists; actual activation is still decided by
 * the credential/config checks.
 */
export function isSyncProviderCapable(providerId: ImportProviderId | string): boolean {
  const adapter = providerInstances[providerId as ImportProviderId];
  if (!adapter) return false;
  const meta = (adapter as { meta?: { phase: "placeholder" | "live" } }).meta;
  return meta?.phase === "live";
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
  createBestBuyProvider,
  createNoonProvider,
  createJumiaProvider,
};
