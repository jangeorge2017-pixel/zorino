import {
  PRODUCTION_PROVIDER_IDS,
  type ProductionProviderId,
} from "@/lib/integration/constants";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress";
import { isAmazonConfigured, isAmazonDirectEnabled } from "@/lib/integrations/amazon";
import { isEbayConfigured } from "@/lib/integrations/ebay/config";
import { isIntegrationConfigured } from "@/lib/integration/credentials";
import { isAmazonScraperAvailable } from "@/lib/integrations/amazon-scraper";
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
 *   aliexpress     — live API credentials
 *   ebay           — live Browse API + ePN tracking
 *   admitad        — Admitad Publisher-API multi-merchant discovery + product
 *                    feeds (products surface as their REAL merchants; durable
 *                    DB evidence also serves them via lowest_prices_today)
 *   cjdropshipping — live REST API
 *
* ACTIVATABLE when credentials are added (currently no credentials on Vercel):
     *   amazon / amazon-eg — Amazon Creators API credentials; the account-local
     *     Oxylabs scraper subscription is retired (401).
     *
     * PHASE 5 DECISION: AMAZON AND AMAZON-EG ARE INDIRECT. The only approved
     * acquisition path is affiliate/network URL → host-guarded ASIN extraction →
     * indirect ingestion. The LATENT DIRECT path (query → Creators API / Oxylabs)
     * stays isolated/deferred: adding credentials later must NOT activate it. Both
     * amazon / amazon-eg report configured ONLY behind the explicit
     * AMAZON_DIRECT_ENABLE=1 architecture opt-in. (The approved indirect
     * affiliate-ingestion path is unaffected and remains credential-gated.)
     *
     * DIRECT DATA SOURCES (checked behind the AMAZON_DIRECT_ENABLE=1 opt-in):
     *   - Amazon Creators API credentials (isAmazonConfigured())
     *   - the account-local Oxylabs scraper creds (isOxylabsConfigured()) — retired
     *   - the local open-source storefront scraper (isAmazonScraperAvailable()),
     *     which needs NO API keys and is the current production source.
 *
 * UNAVAILABLE placeholders (no credentials on Vercel). Capability-gated:
 *   credentials alone can never make these report as available, because their
 *   sync adapters are placeholders that cannot produce real products.
 *   walmart, temu, bestbuy, noon, jumia
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

    // --- PHASE 5: AMAZON / AMAZON-EG ARE INDIRECT (latent direct isolated) ---
    // Amazon is only advertised as configured when BOTH the explicit
    // AMAZON_DIRECT_ENABLE=1 architecture opt-in AND a REAL Amazon data source
    // (Creators API credentials OR the local open-source storefront scraper,
    // which needs no keys) are present. The account-local Oxylabs scraper creds
    // are retired (401) and no longer count. This ensures the latent direct
    // search/sync path can never activate merely because credentials are later
    // added to Vercel. The approved indirect path (affiliate URL → ASIN →
    // ingestion) does not flow through this gate. Never fabricated.
    case "amazon":
      return isAmazonDirectEnabled() && (isAmazonConfigured() || isAmazonScraperAvailable());
    case "amazon-eg":
      return isAmazonDirectEnabled() && (isAmazonConfigured() || isAmazonScraperAvailable());
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
    const { hasProviderEvidence, isProviderEvidenceFresh } = await import(
      "@/lib/integration/provider-evidence"
    );
    // Skip the recompute when the cached snapshot is still within its 10-min
    // TTL — identical data, avoids 11 redundant per-provider count reads
    // serialized on every search fan-out.
    if (loadedEvidenceIds !== null && isProviderEvidenceFresh()) return;
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
