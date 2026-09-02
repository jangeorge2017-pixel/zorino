import {
  PRODUCTION_PROVIDER_IDS,
  type ProductionProviderId,
} from "@/lib/integration/constants";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress";
import { isAmazonConfigured } from "@/lib/integrations/amazon";
import { isEbayConfigured } from "@/lib/integrations/ebay/config";
import { isIntegrationConfigured } from "@/lib/integration/credentials";
import { isOxylabsConfigured } from "@/lib/integrations/oxylabs";
import { isProviderLive } from "@/lib/integration/provider-health";
import { createTemuProvider } from "@/lib/sync/providers/temu";
import { createWalmartProvider } from "@/lib/sync/providers/walmart";
import { createCJdropshippingProvider } from "@/lib/sync/providers/cjdropshipping";

/**
 * Whether a production marketplace provider has credentials and can be queried.
 *
 * Authoritative source: Vercel Production Environment Variables.
 * Some providers also accept credentials from DB integration_settings
 * via hydrateIntegrationCredentials().
 *
 * ACTIVE in production (confirmed returning real products):
 *   aliexpress — live API credentials
 *   ebay       — live Browse API + ePN tracking
 *   admitad    — live Admitad XML feed (~120K Alibaba marketplace products)
 *   cjdropshipping — live REST API
 *
 * UNAVAILABLE (no credentials on Vercel):
 *   amazon, walmart, temu, bestbuy, noon, jumia
 *
 * Note: Admitad products display as "Alibaba" in the UI (brand name),
 * but the provider id is "admitad" (affiliate network).
 */
export function isProductionProviderConfigured(providerId: ProductionProviderId): boolean {
  switch (providerId) {
    // --- ACTIVE in production (credentials configured on Vercel) ---
    case "aliexpress":
      return isAliExpressConfigured();
    case "ebay":
      return isEbayConfigured();
    case "admitad": {
      // Feed-based primary feed, plus Publisher-API multi-merchant discovery
      // (feeds + deeplinks) when OAuth client credentials are configured.
      const feedUrl = process.env.ADMITAD_FEED_URL?.trim();
      const apiCredentials =
        process.env.ADMITAD_CLIENT_ID?.trim() && process.env.ADMITAD_CLIENT_SECRET?.trim();
      return Boolean(feedUrl) || Boolean(apiCredentials);
    }

    // --- ACTIVE in production (CJDROPSHIPPING_API_KEY configured on Vercel) ---
    case "cjdropshipping":
      return createCJdropshippingProvider().isConfigured();

    // --- UNAVAILABLE in production (no credentials configured) ---
    // Amazon is only advertised as configured when a REAL Amazon data source is
    // present: Amazon Creators API credentials OR the Oxylabs Amazon scraper.
    // Without either there is no genuine Amazon product data, so Amazon must
    // not be falsely reported as active/configured. Never fabricated.
    case "amazon":
      return isAmazonConfigured() || isOxylabsConfigured();
    case "amazon-eg":
      return isAmazonConfigured() || isOxylabsConfigured();
    case "walmart":
      return createWalmartProvider().isConfigured(); // Requires WALMART_API_KEY
    case "temu":
      return createTemuProvider().isConfigured(); // Requires TEMU_API_KEY
    case "bestbuy":
      return isIntegrationConfigured(["BESTBUY_API_KEY"]); // Requires BESTBUY_API_KEY
    case "noon":
      return isIntegrationConfigured(["NOON_API_KEY"]); // Requires NOON_API_KEY
    case "jumia":
      return isIntegrationConfigured(["JUMIA_API_KEY", "JUMIA_AFFILIATE_ID"]); // Requires both

    default:
      return false;
  }
}

export function getConfiguredProductionProviders(): ProductionProviderId[] {
  return PRODUCTION_PROVIDER_IDS.filter(isProductionProviderConfigured);
}

/**
 * Runtime health + durable evidence gates for provider ACTIVATION.
 *
 * "Configured" only means credentials exist. A provider is ACTIVATED (allowed
 * to appear in search/homepage and counted in stats/UI) only when it also
 * passes at least one of:
 *   1. durable DB evidence of real product rows (provider-evidence), or
 *   2. recent successful runtime runs through the search engine
 *      (provider-health, recorded on every fan-out).
 *
 * This is the synchronous form (runtime health only) — usable where a DB
 * round-trip cannot be awaited (e.g. per-row store filtering).
 */
export function isProductionProviderActive(providerId: ProductionProviderId): boolean {
  if (!isProductionProviderConfigured(providerId)) return false;
  return isProviderLive(providerId) || hasLoadedEvidenceFor(providerId);
}

/** Evidence snapshot loaded via refreshProviderEvidence(). */
let loadedEvidenceIds: ReadonlySet<ProductionProviderId> | null = null;

/** (Re)load the durable DB evidence snapshot (called by page/engine entry). */
export async function refreshProviderEvidence(): Promise<void> {
  try {
    const { hasProviderEvidence } = await import(
      "@/lib/integration/provider-evidence"
    );
    const result = new Set<ProductionProviderId>();
    for (const providerId of PRODUCTION_PROVIDER_IDS) {
      if (await hasProviderEvidence(providerId)) result.add(providerId);
    }
    loadedEvidenceIds = result;
  } catch {
    loadedEvidenceIds = null;
  }
}

function hasLoadedEvidenceFor(providerId: ProductionProviderId): boolean {
  return loadedEvidenceIds?.has(providerId) ?? false;
}

/**
 * Active providers = configured AND (durable DB evidence OR recent live runs).
 * Async form — refreshes the DB evidence snapshot first (cached, cheap).
 */
export async function getActiveProductionProviders(): Promise<ProductionProviderId[]> {
  await refreshProviderEvidence();
  return PRODUCTION_PROVIDER_IDS.filter(isProductionProviderActive);
}

/** Only for tests. */
export function resetProviderEvidenceForTests(): void {
  loadedEvidenceIds = null;
}
