/**
 * Provider Registry — single source of truth for all provider configurations.
 *
 * Every provider that participates in Zorino's search, homepage, or comparison
 * must be registered here. Other files that currently hardcode provider lists
 * (SEARCH_PROVIDER_IDS, PRODUCTION_PROVIDER_IDS, COMPARISON_STORES, etc.)
 * should migrate to import from this module.
 *
 * This file does NOT contain provider implementation code — only metadata.
 * Adapter implementations live in lib/providers/adapters/<provider>/.
 */
import type { ProviderConfig, ProviderStatus } from "./schema";

export type { ProviderStatus };

// ─── Registered Provider Configs ────────────────────────────────────────────

/**
 * All known providers. This is the canonical list.
 * - "active": credentials configured on Vercel, returning real products
 * - "configured": credentials exist but not yet verified in production
 * - "stub": no credentials, placeholder only
 */
export const PROVIDER_REGISTRY: ProviderConfig[] = [
  {
    id: "aliexpress",
    name: "AliExpress",
    version: "1.0.0",
    status: "active",
    integrationType: "aliexpress",
    requiredEnvVars: [
      "ALIEXPRESS_APP_KEY",
      "ALIEXPRESS_APP_SECRET",
      "ALIEXPRESS_TRACKING_ID",
    ],
    supportedCurrencies: ["USD", "EUR", "GBP", "AED", "SAR", "EGP"],
    supportedCountries: ["US", "GB", "DE", "FR", "ES", "IT", "AE", "SA", "EG"],
    rateLimit: { requests: 10, perSeconds: 1 },
    maxPageSize: 50,
  },
  {
    id: "ebay",
    name: "eBay",
    version: "1.0.0",
    status: "active",
    integrationType: "ebay",
    requiredEnvVars: ["EBAY_APP_ID", "EBAY_CERT_ID"],
    supportedCurrencies: ["USD", "EUR", "GBP"],
    supportedCountries: ["US", "UK", "DE"],
    maxPageSize: 50,
  },
  {
    id: "amazon",
    name: "Amazon",
    version: "1.0.0",
    // PHASE 5 DECISION: amazon/amazon-eg are INDIRECT — the only approved
    // acquisition path is affiliate/network URL → host-guarded ASIN extraction
    // → indirect ingestion → RawOffer → validate → canonicalize. The LATENT
    // DIRECT path (query → Creators API / local storefront scraper) is
    // isolated/deferred and requires AMAZON_DIRECT_ENABLE=1 to even advertise
    // as configured — adding credentials alone must never activate it.
    status: "configured",
    integrationType: "amazon",
    requiredEnvVars: ["AMAZON_CREATORS_CLIENT_ID", "AMAZON_CREATORS_CLIENT_SECRET"],
    supportedCurrencies: ["USD", "EUR", "GBP"],
    supportedCountries: ["US", "UK", "DE"],
    rateLimit: { requests: 1, perSeconds: 1 },
    maxPageSize: 10,
  },
  {
    id: "amazon-eg",
    name: "Amazon Egypt",
    version: "1.0.0",
    status: "configured",
    integrationType: "amazon",
    requiredEnvVars: ["AMAZON_CREATORS_CLIENT_ID", "AMAZON_CREATORS_CLIENT_SECRET"],
    supportedCurrencies: ["EGP", "USD"],
    supportedCountries: ["EG"],
    rateLimit: { requests: 1, perSeconds: 1 },
    maxPageSize: 10,
  },
  {
    id: "cjdropshipping",
    name: "CJdropshipping",
    version: "1.0.0",
    status: "active",
    integrationType: "partner",
    requiredEnvVars: ["CJDROPSHIPPING_API_KEY"],
    supportedCurrencies: ["USD"],
    supportedCountries: ["US"],
    maxPageSize: 50,
  },
  {
    id: "walmart",
    name: "Walmart",
    version: "1.0.0",
    status: "stub",
    integrationType: "walmart",
    requiredEnvVars: ["WALMART_API_KEY"],
    supportedCurrencies: ["USD"],
    supportedCountries: ["US"],
    maxPageSize: 50,
  },
  {
    id: "bestbuy",
    name: "Best Buy",
    version: "1.0.0",
    status: "stub",
    integrationType: "partner",
    requiredEnvVars: ["BESTBUY_API_KEY"],
    supportedCurrencies: ["USD"],
    supportedCountries: ["US"],
    maxPageSize: 50,
  },
  {
    id: "temu",
    name: "Temu",
    version: "1.0.0",
    status: "stub",
    integrationType: "temu",
    requiredEnvVars: ["TEMU_API_KEY"],
    supportedCurrencies: ["USD"],
    supportedCountries: ["US"],
    maxPageSize: 50,
  },
  {
    id: "noon",
    name: "Noon",
    version: "1.0.0",
    status: "stub",
    integrationType: "noon",
    requiredEnvVars: ["NOON_API_KEY"],
    supportedCurrencies: ["AED", "SAR", "EGP"],
    supportedCountries: ["AE", "SA", "EG"],
    maxPageSize: 50,
  },
  {
    id: "jumia",
    name: "Jumia",
    version: "1.0.0",
    status: "stub",
    integrationType: "partner",
    requiredEnvVars: ["JUMIA_API_KEY", "JUMIA_AFFILIATE_ID"],
    supportedCurrencies: ["USD", "NGN", "KES", "GHS"],
    supportedCountries: ["NG", "KE", "GH", "EG", "MA"],
    maxPageSize: 50,
  },
  {
    id: "admitad",
    name: "Admitad",
    version: "1.0.0",
    status: "active",
    integrationType: "partner",
    requiredEnvVars: ["ADMITAD_FEED_URL"],
    supportedCurrencies: ["USD"],
    supportedCountries: ["US"],
    maxPageSize: 100,
  },
] as const;

// ─── Lookup Helpers ─────────────────────────────────────────────────────────

export type ProviderId = (typeof PROVIDER_REGISTRY)[number]["id"];

/**
 * All registered provider IDs, as a readonly tuple.
 * This is the canonical source that SEARCH_PROVIDER_IDS and
 * PRODUCTION_PROVIDER_IDS derive from, so provider identity lives in exactly
 * one place.
 */
export const PROVIDER_IDS = PROVIDER_REGISTRY.map((p) => p.id) as readonly ProviderId[];

/**
 * Providers currently live in production — real product retrieval path is
 * wired and credentials are configured (status: "active"). Replaces the
 * hardcoded LIVE_SEARCH_PROVIDER_IDS / REAL_CATALOG_PROVIDERS lists.
 */
export const LIVE_PROVIDER_IDS = PROVIDER_REGISTRY.filter(
  (p) => p.status === "active",
).map((p) => p.id) as readonly ProviderId[];

/**
 * Placeholder-only providers (status: "stub") — no real data path, return []
 * regardless of credentials. Replaces STUB_CATALOG_PROVIDERS.
 */
export const STUB_PROVIDER_IDS = PROVIDER_REGISTRY.filter(
  (p) => p.status === "stub",
).map((p) => p.id) as readonly ProviderId[];

/**
 * Get a provider config by ID. Returns undefined if not found.
 */
export function getProviderConfig(id: string): ProviderConfig | undefined {
  return PROVIDER_REGISTRY.find((p) => p.id === id);
}

/**
 * Get all registered provider IDs.
 */
export function getAllProviderIds(): readonly string[] {
  return PROVIDER_REGISTRY.map((p) => p.id);
}

/**
 * Get provider display name by ID. Falls back to the ID if not found.
 */
export function getProviderDisplayName(id: string): string {
  return getProviderConfig(id)?.name ?? id;
}

/**
 * Get provider display name from a store slug, store name, product ID prefix,
 * or raw provider ID. Handles common aliases.
 */
const PROVIDER_ALIASES: Record<string, string> = {
  alibaba: "admitad",
  "alibaba-ww": "admitad",
  "alibaba (via admitad)": "admitad",
  "amazon-egypt": "amazon-eg",
};

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveProviderId(raw: string | null | undefined): string {
  const input = (raw ?? "").trim().toLowerCase();
  if (!input) return "unknown";

  const slug = input.replace(/\s+/g, "-");
  const packed = compact(input);

  // Check aliases first
  const alias = PROVIDER_ALIASES[packed] ?? PROVIDER_ALIASES[slug];
  if (alias) return alias;

  const allIds = getAllProviderIds() as readonly string[];

  // Exact match
  for (const id of allIds) {
    if (slug === id || packed === compact(id)) return id;
  }

  // Substring match
  for (const id of allIds) {
    if (slug.includes(id) || packed.includes(compact(id))) return id;
  }

  // Prefix split (e.g. "flash-ebay-123")
  const parts = slug.split("-").filter(Boolean);
  for (const part of parts) {
    for (const id of allIds) {
      if (part === id || compact(part) === compact(id)) return id;
    }
  }

  return slug || packed || "unknown";
}

/**
 * Check if a provider ID is registered.
 */
export function isRegisteredProvider(id: string): boolean {
  return PROVIDER_REGISTRY.some((p) => p.id === id);
}

/**
 * Get all required env vars across all providers (for documentation/setup).
 */
export function getAllRequiredEnvVars(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const provider of PROVIDER_REGISTRY) {
    result[provider.id] = [...provider.requiredEnvVars];
  }
  return result;
}

// ─── Provider Store Display Metadata ────────────────────────────────────────

/**
 * Canonical store display metadata, keyed by provider id.
 *
 * This is the single source for the store identity shown across product
 * pages / compare UI (store name, slug, website, logo initial). It replaces
 * the legacy STORE_META table in marketplace-product-detail.ts (values
 * copied verbatim — no display value changed). The sync-oriented STORE_META
 * in provider-context.ts is a SEPARATE data model (storeId / generic slugs
 * like "default") and is intentionally left untouched.
 */
export type ProviderStoreMeta = {
  id: string;
  name: string;
  slug: string;
  website: string;
  logoInitial: string;
};

export const PROVIDER_STORE_META: Readonly<Record<string, ProviderStoreMeta>> = {
  aliexpress: {
    id: "aliexpress",
    name: "AliExpress",
    slug: "aliexpress",
    website: "https://www.aliexpress.com",
    logoInitial: "AE",
  },
  ebay: {
    id: "ebay",
    name: "eBay",
    slug: "ebay",
    website: "https://www.ebay.com",
    logoInitial: "EB",
  },
  walmart: {
    id: "walmart",
    name: "Walmart",
    slug: "walmart",
    website: "https://www.walmart.com",
    logoInitial: "WM",
  },
  temu: {
    id: "temu",
    name: "Temu",
    slug: "temu",
    website: "https://www.temu.com",
    logoInitial: "TM",
  },
  bestbuy: {
    id: "bestbuy",
    name: "Best Buy",
    slug: "best-buy",
    website: "https://www.bestbuy.com",
    logoInitial: "BB",
  },
  noon: {
    id: "noon",
    name: "Noon",
    slug: "noon",
    website: "https://www.noon.com",
    logoInitial: "NN",
  },
  jumia: {
    id: "jumia",
    name: "Jumia",
    slug: "jumia",
    website: "https://www.jumia.com",
    logoInitial: "JM",
  },
  amazon: {
    id: "amazon",
    name: "Amazon",
    slug: "amazon",
    website: "https://www.amazon.eg",
    logoInitial: "AZ",
  },
  "amazon-eg": {
    id: "amazon-eg",
    name: "Amazon Egypt",
    slug: "amazon-eg",
    website: "https://www.amazon.eg",
    logoInitial: "AZ",
  },
};

/**
 * Look up canonical store display metadata by slug/provider id.
 * Returns undefined for unknown slugs so callers keep their own fallback.
 */
export function getProviderStoreMeta(slug: string): ProviderStoreMeta | undefined {
  return PROVIDER_STORE_META[slug];
}
