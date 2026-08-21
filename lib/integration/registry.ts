/**
 * Zorino Integration Registry — Single Source of Truth
 *
 * Every marketplace/connector in the project is declared here with its
 * complete environment-variable schema. This file is the authoritative
 * reference for:
 *
 *   - Which connectors exist and their current status
 *   - What environment variables each connector requires/accepts
 *   - Configuration validation (detects drift between code and env)
 *   - .env.example documentation generation
 *
 * Vercel Production Environment Variables are the authoritative source
 * for production secrets. .env.local is the local-development mirror.
 * .env.example is documentation only.
 */

import { getIntegrationCredential } from "./credentials";

// ── Types ─────────────────────────────────────────────────────────────

export type ConnectorCategory =
  | "marketplace"     // Full marketplace with products + search
  | "affiliate-network" // Affiliate network (e.g. Admitad)
  | "platform"        // E-commerce platform connector (e.g. Shopify)
  | "data-provider";  // Data/product feed provider

export type ConnectorStatus =
  | "active"                      // Fully operational in production
  | "configuration-missing"       // Code exists, approved, but required vars missing
  | "not-approved"                // Not yet approved for production
  | "code-exists-not-connected"   // Code exists but not wired into production pipeline
  | "error";                      // Misconfigured or broken

export type EnvVarRequirement = "required" | "optional";

export type EnvVarSpec = {
  name: string;
  requirement: EnvVarRequirement;
  description: string;
  /** If true, this variable contains secrets and must not be logged/exposed. */
  secret: boolean;
  /** Default value used when variable is absent (code-level fallback). */
  defaultValue?: string;
};

export type ConnectorSpec = {
  /** Unique identifier (matches SearchProviderId, ProductionProviderId, etc.) */
  id: string;
  /** Human-readable display name */
  name: string;
  /** What category of integration this is */
  category: ConnectorCategory;
  /** Short description of the connector */
  description: string;
  /** All environment variables this connector reads */
  envVars: EnvVarSpec[];
  /** Connector implementation file(s) */
  implementationFiles: string[];
  /** Whether a search connector exists */
  hasSearchConnector: boolean;
  /** Whether a sync-layer provider exists */
  hasSyncProvider: boolean;
  /** Whether affiliate link generation is supported */
  hasAffiliateLinks: boolean;
  /** Whether this connector provides homepage/catalog products */
  hasCatalogIntegration: boolean;
  /** Whether the connector is expected to return real results when configured */
  producesRealResults: boolean;
  /** Additional notes about the connector's current state */
  notes?: string;
};

export type ConnectorEvaluation = {
  spec: ConnectorSpec;
  status: ConnectorStatus;
  /** Which required env vars are missing */
  missingVars: string[];
  /** Which optional env vars are present */
  presentOptionalVars: string[];
  /** Which required env vars are present */
  presentRequiredVars: string[];
  /** Human-readable status reason */
  reason: string;
};

// ── Registry ──────────────────────────────────────────────────────────

export const CONNECTOR_REGISTRY: ConnectorSpec[] = [
  // ── AliExpress ──────────────────────────────────────────────────────
  {
    id: "aliexpress",
    name: "AliExpress",
    category: "marketplace",
    description: "AliExpress Open Platform — live product search, prices, and affiliate links",
    envVars: [
      { name: "ALIEXPRESS_APP_KEY", requirement: "required", description: "AliExpress Open Platform App Key", secret: false },
      { name: "ALIEXPRESS_APP_SECRET", requirement: "required", description: "AliExpress Open Platform App Secret", secret: true },
      { name: "ALIEXPRESS_TRACKING_ID", requirement: "optional", description: "AliExpress Affiliate Portal tracking ID for portal links", secret: false },
      { name: "ALIEXPRESS_AFFILIATE_BASE_URL", requirement: "optional", description: "Custom deep-link wrapper URL", secret: false },
    ],
    implementationFiles: [
      "lib/integrations/aliexpress/",
      "lib/search/connectors/aliexpress.ts",
      "lib/sync/providers/aliexpress.ts",
    ],
    hasSearchConnector: true,
    hasSyncProvider: true,
    hasAffiliateLinks: true,
    hasCatalogIntegration: true,
    producesRealResults: true,
  },

  // ── eBay ────────────────────────────────────────────────────────────
  {
    id: "ebay",
    name: "eBay",
    category: "marketplace",
    description: "eBay Browse API + eBay Partner Network (ePN) affiliate tracking",
    envVars: [
      { name: "EBAY_APP_ID", requirement: "required", description: "eBay Client ID (App ID). Production: *-PRD-*", secret: false, defaultValue: "Also accepts EBAY_CLIENT_ID or EBAY_Client_ID" },
      { name: "EBAY_CERT_ID", requirement: "required", description: "eBay Client Secret (Cert ID)", secret: true, defaultValue: "Also accepts EBAY_CLIENT_SECRET or EBAY_Client_Secret" },
      { name: "EBAY_CAMPAIGN_ID", requirement: "optional", description: "eBay Partner Network campaign ID for affiliate tracking", secret: false },
      { name: "EBAY_OAUTH_TOKEN", requirement: "optional", description: "Pre-set OAuth token (alternative to App ID + Cert ID)", secret: true },
      { name: "EBAY_REFERENCE_ID", requirement: "optional", description: "ePN sub-tracking ID", secret: false },
      { name: "EBAY_SANDBOX", requirement: "optional", description: "Force sandbox endpoints (true/1/yes). Auto-detected from key format.", secret: false },
      { name: "EBAY_VERIFICATION_TOKEN", requirement: "optional", description: "Required for marketplace account-deletion notifications in Production", secret: true },
      { name: "EBAY_NOTIFICATION_ENDPOINT_URL", requirement: "optional", description: "Override account-deletion notification endpoint", secret: false },
    ],
    implementationFiles: [
      "lib/integrations/ebay/",
      "lib/search/connectors/ebay.ts",
      "lib/sync/providers/ebay.ts",
    ],
    hasSearchConnector: true,
    hasSyncProvider: true,
    hasAffiliateLinks: true,
    hasCatalogIntegration: true,
    producesRealResults: true,
  },

  // ── Amazon ──────────────────────────────────────────────────────────
  {
    id: "amazon",
    name: "Amazon",
    category: "marketplace",
    description: "Amazon Creators API (PA-API) + Amazon Associates affiliate tracking",
    envVars: [
      { name: "AMAZON_CREATORS_CLIENT_ID", requirement: "required", description: "Amazon Creators API Client ID", secret: false },
      { name: "AMAZON_CREATORS_CLIENT_SECRET", requirement: "required", description: "Amazon Creators API Client Secret", secret: true },
      { name: "AMAZON_ASSOCIATE_TAG", requirement: "optional", description: "Amazon Associates tracking tag", secret: false, defaultValue: "zorino-20" },
      { name: "AMAZON_CREATORS_MARKETPLACE", requirement: "optional", description: "Amazon marketplace domain", secret: false, defaultValue: "www.amazon.com" },
      { name: "AMAZON_CREATORS_VERSION", requirement: "optional", description: "PA-API version", secret: false, defaultValue: "3.1" },
    ],
    implementationFiles: [
      "lib/integrations/amazon/",
      "lib/search/connectors/amazon.ts",
      "lib/sync/providers/amazon/",
    ],
    hasSearchConnector: true,
    hasSyncProvider: true,
    hasAffiliateLinks: true,
    hasCatalogIntegration: true,
    producesRealResults: true,
    notes: "Real implementation exists but no production credentials configured on Vercel",
  },

  // ── Admitad (Alibaba feed) ─────────────────────────────────────────
  {
    id: "admitad",
    name: "Alibaba (via Admitad)",
    category: "affiliate-network",
    description: "Admitad XML product feed — provides Alibaba marketplace products",
    envVars: [
      { name: "ADMITAD_FEED_URL", requirement: "required", description: "Admitad XML export feed URL (contains embedded auth)", secret: true },
      { name: "ADMITAD_CLIENT_ID", requirement: "optional", description: "Admitad Publisher API OAuth client ID (for feed discovery)", secret: false },
      { name: "ADMITAD_CLIENT_SECRET", requirement: "optional", description: "Admitad Publisher API OAuth client secret", secret: true },
    ],
    implementationFiles: [
      "lib/integrations/admitad/",
      "lib/search/connectors/admitad.ts",
    ],
    hasSearchConnector: true,
    hasSyncProvider: false,
    hasAffiliateLinks: true,
    hasCatalogIntegration: true,
    producesRealResults: true,
    notes: "Feed-based; no sync-layer adapter. Search connector always available when feed URL is set.",
  },

  // ── CJdropshipping ─────────────────────────────────────────────────
  {
    id: "cjdropshipping",
    name: "CJdropshipping",
    category: "marketplace",
    description: "CJdropshipping product list API",
    envVars: [
      { name: "CJDROPSHIPPING_API_KEY", requirement: "required", description: "CJdropshipping API key", secret: true },
    ],
    implementationFiles: [
      "lib/sync/providers/cjdropshipping.ts",
      "lib/sync/providers/cjdropshipping/",
    ],
    hasSearchConnector: true,
    hasSyncProvider: true,
    hasAffiliateLinks: false,
    hasCatalogIntegration: false,
    producesRealResults: true,
    notes: "Real sync adapter with API client. Search connector wired through sync-bridge. Requires CJDROPSHIPPING_API_KEY.",
  },

  // ── Walmart ─────────────────────────────────────────────────────────
  {
    id: "walmart",
    name: "Walmart",
    category: "marketplace",
    description: "Walmart Open API (placeholder — not yet implemented)",
    envVars: [
      { name: "WALMART_API_KEY", requirement: "required", description: "Walmart Open API key", secret: true },
      { name: "WALMART_AFFILIATE_ID", requirement: "optional", description: "Walmart affiliate tracking ID", secret: false },
    ],
    implementationFiles: [
      "lib/sync/providers/walmart.ts",
      "lib/search/connectors/stubs.ts",
    ],
    hasSearchConnector: true,
    hasSyncProvider: true,
    hasAffiliateLinks: true,
    hasCatalogIntegration: false,
    producesRealResults: false,
    notes: "Placeholder provider — fetchProducts() returns []. Even with API key, search returns empty.",
  },

  // ── Temu ────────────────────────────────────────────────────────────
  {
    id: "temu",
    name: "Temu",
    category: "marketplace",
    description: "Temu product/affiliate API (placeholder — not yet implemented)",
    envVars: [
      { name: "TEMU_API_KEY", requirement: "required", description: "Temu API key", secret: true },
      { name: "TEMU_AFFILIATE_ID", requirement: "optional", description: "Temu affiliate tracking ID", secret: false },
    ],
    implementationFiles: [
      "lib/sync/providers/temu.ts",
      "lib/search/connectors/stubs.ts",
    ],
    hasSearchConnector: true,
    hasSyncProvider: true,
    hasAffiliateLinks: true,
    hasCatalogIntegration: false,
    producesRealResults: false,
    notes: "Placeholder provider — fetchProducts() returns []. Even with API key, search returns empty.",
  },

  // ── Best Buy ────────────────────────────────────────────────────────
  {
    id: "bestbuy",
    name: "Best Buy",
    category: "marketplace",
    description: "Best Buy API (stub — no implementation)",
    envVars: [
      { name: "BESTBUY_API_KEY", requirement: "required", description: "Best Buy API key", secret: true },
      { name: "BESTBUY_AFFILIATE_ID", requirement: "optional", description: "Best Buy affiliate tracking ID", secret: false },
    ],
    implementationFiles: [
      "lib/search/connectors/stubs.ts",
    ],
    hasSearchConnector: true,
    hasSyncProvider: false,
    hasAffiliateLinks: false,
    hasCatalogIntegration: false,
    producesRealResults: false,
    notes: "Env-gated stub only — search() returns [] even when configured.",
  },

  // ── Noon ────────────────────────────────────────────────────────────
  {
    id: "noon",
    name: "Noon",
    category: "marketplace",
    description: "Noon UAE/KSA marketplace (stub — no real API implementation)",
    envVars: [
      { name: "NOON_API_KEY", requirement: "required", description: "Noon API key", secret: true },
      { name: "NOON_UAE_AFFILIATE_ID", requirement: "optional", description: "Noon UAE affiliate tracking ID", secret: false },
      { name: "NOON_KSA_AFFILIATE_ID", requirement: "optional", description: "Noon KSA affiliate tracking ID", secret: false },
    ],
    implementationFiles: [
      "lib/search/connectors/stubs.ts",
      "lib/sync/providers/amazon/noon.ts",
    ],
    hasSearchConnector: true,
    hasSyncProvider: false,
    hasAffiliateLinks: true,
    hasCatalogIntegration: false,
    producesRealResults: false,
    notes: "Env-gated search stub. Sync provider is orphaned mock data (not registered).",
  },

  // ── Jumia ───────────────────────────────────────────────────────────
  {
    id: "jumia",
    name: "Jumia",
    category: "marketplace",
    description: "Jumia marketplace (stub — no implementation)",
    envVars: [
      { name: "JUMIA_API_KEY", requirement: "required", description: "Jumia API key", secret: true },
      { name: "JUMIA_AFFILIATE_ID", requirement: "required", description: "Jumia affiliate tracking ID", secret: false },
    ],
    implementationFiles: [
      "lib/search/connectors/stubs.ts",
    ],
    hasSearchConnector: true,
    hasSyncProvider: false,
    hasAffiliateLinks: false,
    hasCatalogIntegration: false,
    producesRealResults: false,
    notes: "Env-gated stub only — search() returns [] even when configured.",
  },

  // ── Shopify ─────────────────────────────────────────────────────────
  {
    id: "shopify",
    name: "Shopify",
    category: "platform",
    description: "Shopify store integration (stub — API call not implemented)",
    envVars: [
      { name: "SHOPIFY_STORE_DOMAIN", requirement: "required", description: "Shopify store domain (e.g. mystore.myshopify.com)", secret: false },
      { name: "SHOPIFY_ACCESS_TOKEN", requirement: "required", description: "Shopify Storefront API access token", secret: true },
    ],
    implementationFiles: [
      "lib/sync/connectors/shopify.ts",
    ],
    hasSearchConnector: false,
    hasSyncProvider: true,
    hasAffiliateLinks: false,
    hasCatalogIntegration: false,
    producesRealResults: false,
    notes: "Legacy connector stub — falls back to mock data when unconfigured; returns [] when configured.",
  },
];

// ── Evaluation Engine ─────────────────────────────────────────────────

/**
 * Evaluate a single connector's configuration status.
 */
export function evaluateConnector(spec: ConnectorSpec): ConnectorEvaluation {
  const requiredVars = spec.envVars.filter((v) => v.requirement === "required");
  const optionalVars = spec.envVars.filter((v) => v.requirement === "optional");

  const presentRequired = requiredVars.filter((v) => Boolean(getIntegrationCredential(v.name)));
  const missingRequired = requiredVars.filter((v) => !getIntegrationCredential(v.name));
  const presentOptional = optionalVars.filter((v) => Boolean(getIntegrationCredential(v.name)));

  let status: ConnectorStatus;
  let reason: string;

  if (!spec.producesRealResults) {
    // Stub/placeholder — code exists but won't produce results
    if (missingRequired.length === 0) {
      status = "code-exists-not-connected";
      reason = "All required vars present, but connector implementation is a stub that returns empty results";
    } else {
      status = "not-approved";
      reason = `Placeholder implementation. Missing: ${missingRequired.map((v) => v.name).join(", ")}`;
    }
  } else if (missingRequired.length === 0) {
    status = "active";
    reason = "All required variables present";
  } else {
    status = "configuration-missing";
    reason = `Missing required: ${missingRequired.map((v) => v.name).join(", ")}`;
  }

  return {
    spec,
    status,
    missingVars: missingRequired.map((v) => v.name),
    presentRequiredVars: presentRequired.map((v) => v.name),
    presentOptionalVars: presentOptional.map((v) => v.name),
    reason,
  };
}

/**
 * Evaluate all connectors in the registry.
 */
export function evaluateAllConnectors(): ConnectorEvaluation[] {
  return CONNECTOR_REGISTRY.map(evaluateConnector);
}

/**
 * Get only connectors with a given status.
 */
export function getConnectorsByStatus(status: ConnectorStatus): ConnectorEvaluation[] {
  return evaluateAllConnectors().filter((e) => e.status === status);
}

/**
 * Get a summary of all connector statuses.
 */
export function getConfigurationSummary(): Record<ConnectorStatus, string[]> {
  const evaluations = evaluateAllConnectors();
  const summary: Record<ConnectorStatus, string[]> = {
    active: [],
    "configuration-missing": [],
    "not-approved": [],
    "code-exists-not-connected": [],
    error: [],
  };
  for (const eval_ of evaluations) {
    summary[eval_.status].push(`${eval_.spec.id}: ${eval_.reason}`);
  }
  return summary;
}

/**
 * Validate the entire configuration and return a structured report.
 * Call this at application startup or from a diagnostic endpoint.
 */
export function validateConfiguration(): {
  timestamp: string;
  totalConnectors: number;
  activeCount: number;
  summary: Record<ConnectorStatus, string[]>;
  evaluations: ConnectorEvaluation[];
} {
  const evaluations = evaluateAllConnectors();
  const summary = getConfigurationSummary();

  return {
    timestamp: new Date().toISOString(),
    totalConnectors: evaluations.length,
    activeCount: summary.active.length,
    summary,
    evaluations,
  };
}

/**
 * Get the required environment variable names for all connectors.
 * Useful for .env.example generation and drift detection.
 */
export function getAllRequiredEnvVars(): string[] {
  const vars = new Set<string>();
  for (const spec of CONNECTOR_REGISTRY) {
    for (const v of spec.envVars) {
      if (v.requirement === "required") vars.add(v.name);
    }
  }
  return Array.from(vars).sort();
}

/**
 * Get all environment variable names referenced by any connector.
 */
export function getAllEnvVars(): string[] {
  const vars = new Set<string>();
  for (const spec of CONNECTOR_REGISTRY) {
    for (const v of spec.envVars) vars.add(v.name);
  }
  return Array.from(vars).sort();
}
