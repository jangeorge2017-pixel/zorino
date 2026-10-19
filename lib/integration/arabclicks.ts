/**
 * ArabClicks Affiliate Network router.
 *
 * Regional strategy: Noon EG and Jumia EG are delivered through the ArabClicks
 * network so their LOCAL markets (EGP/SAR + EG/SA/AE) flow into the same
 * unified catalog/search pipeline even when a direct Noon/Jumia API contract is
 * unavailable.
 *
 * Anti-fabrication (real data only): this router is BOTH credential-gated
 * (ARABCLICKS_API_KEY + ARABCLICKS_PUBLISHER_ID) AND endpoint-gated
 * (ARABCLICKS_API_BASE + ARABCLICKS_API_ENDPOINT). Until the real ArabClicks
 * product-feed contract is confirmed and those endpoint vars are set, every
 * sweep returns an explicit skip reason and NEVER touches the network — so
 * injecting credentials alone can never fabricate inventory. The pipeline stays
 * completely unblocked (a dormant step that no-ops), and activates
 * automatically the moment a real endpoint is configured.
 *
 * Provider identity is preserved: Noon offers are saved as provider "noon",
 * Jumia offers as "jumia" (never "arabclicks"), with the store metadata the
 * existing Noon/Jumia runners use.
 */

import { getIntegrationCredential } from "@/lib/integration/credentials";
import { saveCatalogItemsAs } from "@/lib/integration/catalog-saver";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { StoreIntegrationType } from "@/lib/types/entities";
import { noonRawToCatalogItem } from "@/lib/integrations/noon/normalization";
import { jumiaRawToCatalogItem } from "@/lib/integrations/jumia/normalization";

export const ARABCLICKS_NETWORK_ID = "arabclicks" as const;

export const ARABCLICKS_CREDENTIAL_KEYS = {
  API_KEY: "ARABCLICKS_API_KEY",
  PUBLISHER_ID: "ARABCLICKS_PUBLISHER_ID",
} as const;

/**
 * Product-feed endpoint — deliberately left unset until a REAL ArabClicks
 * feed contract is confirmed. The public ArabClicks API is documented for
 * affiliate LINK/CONVERSION data, not a product feed; setting these two vars on
 * the deployment is what turns the sweep on. Without them the router reports
 * `no-api-endpoint` and never touches the network.
 */
export const ARABCLICKS_API_BASE = process.env.ARABCLICKS_API_BASE?.trim() ?? "";
export const ARABCLICKS_API_ENDPOINT =
  process.env.ARABCLICKS_API_ENDPOINT?.trim() ?? "";

export function isArabClicksEndpointConfigured(): boolean {
  return Boolean(ARABCLICKS_API_BASE && ARABCLICKS_API_ENDPOINT);
}

export type ArabClicksCredentialStatus = {
  configured: boolean;
  hasApiKey: boolean;
  hasPublisherId: boolean;
  source: "env" | "database" | "none";
};

export function getArabClicksCredentialStatus(): ArabClicksCredentialStatus {
  const apiKey = getIntegrationCredential(ARABCLICKS_CREDENTIAL_KEYS.API_KEY);
  const publisherId = getIntegrationCredential(
    ARABCLICKS_CREDENTIAL_KEYS.PUBLISHER_ID,
  );
  const configured = Boolean(apiKey && publisherId);
  const source = configured
    ? process.env[ARABCLICKS_CREDENTIAL_KEYS.API_KEY]?.trim()
      ? "env"
      : "database"
    : "none";
  return {
    configured,
    hasApiKey: Boolean(apiKey),
    hasPublisherId: Boolean(publisherId),
    source,
  };
}

export function isArabClicksConfigured(): boolean {
  return getArabClicksCredentialStatus().configured;
}

export type ArabClicksConfig = {
  apiKey: string;
  publisherId: string;
  apiBase: string;
  endpoint: string;
};

export function getArabClicksConfig(): ArabClicksConfig | null {
  const apiKey = getIntegrationCredential(ARABCLICKS_CREDENTIAL_KEYS.API_KEY);
  const publisherId = getIntegrationCredential(
    ARABCLICKS_CREDENTIAL_KEYS.PUBLISHER_ID,
  );
  if (!apiKey || !publisherId) return null;
  return { apiKey, publisherId, apiBase: ARABCLICKS_API_BASE, endpoint: ARABCLICKS_API_ENDPOINT };
}

// ---------------------------------------------------------------------------
// Target markets + routing table (Noon EG, Jumia EG, plus KSA/UAE)
// ---------------------------------------------------------------------------

export type ArabClicksMarket = {
  /** ISO 3166-1 alpha-2 market the sweep targets. */
  countryCode: string;
  /** ISO 4217 local currency for the market. */
  currency: string;
  /** ArabClicks market/locale locator used as the feed market path. */
  locale: string;
};

export type ArabClicksTargetId = "noon" | "jumia";

/** Permissive, provider-agnostic raw offer shape shared by both targets. */
export type ArabClicksRawProduct = {
  externalId?: string;
  title?: string;
  imageUrl?: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  countryCode?: string;
  productUrl?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
};

type ArabClicksTarget = {
  id: ArabClicksTargetId;
  storeSlug: string;
  storeName: string;
  storeNameAr: string;
  website: string;
  integrationType: StoreIntegrationType;
  logoUrl?: string;
  logoInitial: string;
  keywords: string[];
  markets: ArabClicksMarket[];
  normalize: (raw: ArabClicksRawProduct, countryCode: string) => NormalizedCatalogItem | null;
};

const ARABCLICKS_TARGETS: readonly ArabClicksTarget[] = [
  {
    id: "noon",
    storeSlug: "noon",
    storeName: "Noon",
    storeNameAr: "نون",
    website: "https://www.noon.com",
    integrationType: "noon",
    logoUrl: "/stores/noon.svg",
    logoInitial: "NN",
    keywords: [
      "mobile phones",
      "electronics",
      "laptops",
      "headphones",
      "smart watches",
      "home appliances",
    ],
    markets: [
      { countryCode: "EG", currency: "EGP", locale: "egypt-en" },
      { countryCode: "SA", currency: "SAR", locale: "saudi-en" },
      { countryCode: "AE", currency: "AED", locale: "uae-en" },
    ],
    normalize: (raw, countryCode) => noonRawToCatalogItem(raw, countryCode),
  },
  {
    id: "jumia",
    storeSlug: "jumia",
    storeName: "Jumia",
    storeNameAr: "جوميا",
    website: "https://www.jumia.com",
    integrationType: "jumia",
    logoInitial: "JM",
    keywords: [
      "smartphones",
      "electronics",
      "laptops",
      "headphones",
      "smart watches",
      "home appliances",
    ],
    markets: [
      { countryCode: "EG", currency: "EGP", locale: "egypt-en" },
      { countryCode: "SA", currency: "SAR", locale: "saudi-en" },
    ],
    normalize: (raw, countryCode) => jumiaRawToCatalogItem(raw, countryCode),
  },
];

export function getArabClicksTargets(): readonly ArabClicksTargetId[] {
  return ARABCLICKS_TARGETS.map((t) => t.id);
}

// ---------------------------------------------------------------------------
// Client — talks ONLY to the configured endpoint
// ---------------------------------------------------------------------------

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function productFromEntry(entry: Record<string, unknown>): ArabClicksRawProduct | null {
  const id = entry.externalId ?? entry.id ?? entry.sku ?? entry.productId;
  const title = entry.title ?? entry.name;
  if (!id || !title) return null;

  const price = toNumber(entry.price ?? entry.salePrice ?? entry.sale_price);
  if (!price) return null;

  const image =
    entry.imageUrl ??
    entry.image ??
    (Array.isArray(entry.images) ? entry.images[0] : undefined);
  const productUrl = entry.productUrl ?? entry.url ?? entry.affiliateUrl;

  return {
    externalId: String(id),
    title: String(title),
    imageUrl: typeof image === "string" ? image : undefined,
    price,
    originalPrice: toNumber(entry.originalPrice ?? entry.original_price) ?? price,
    currency: typeof entry.currency === "string" ? entry.currency : undefined,
    countryCode: typeof entry.countryCode === "string" ? entry.countryCode : undefined,
    productUrl: typeof productUrl === "string" ? productUrl : undefined,
    rating: toNumber(entry.rating) ?? undefined,
    reviewCount: toNumber(entry.reviewCount ?? entry.reviews_count) ?? undefined,
    category: typeof entry.category === "string" ? entry.category : undefined,
  };
}

function extractProductList(payload: unknown): Record<string, unknown>[] {
  const asRecords = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value)
      ? value.filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
      : [];

  if (Array.isArray(payload)) return asRecords(payload);
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "products", "items", "result", "results"]) {
      const value = obj[key];
      if (Array.isArray(value)) return asRecords(value);
      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        for (const k of ["items", "products", "results"]) {
          const v = nested[k];
          if (Array.isArray(v)) return asRecords(v);
        }
      }
    }
  }
  return [];
}

/**
 * Minimal ArabClicks client. With no configured endpoint it returns [] without
 * touching the network, so a credential-only environment can never advertise
 * fake inventory.
 */
export class ArabClicksClient {
  constructor(private config: ArabClicksConfig) {}

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      "X-ArabClicks-Publisher-Id": this.config.publisherId,
    };
  }

  async searchProducts(
    query: string,
    market: ArabClicksMarket,
    opts: { page?: number; pageSize?: number } = {},
  ): Promise<ArabClicksRawProduct[]> {
    if (!this.config.apiBase || !this.config.endpoint) return [];
    const { page = 1, pageSize = 30 } = opts;

    const params = new URLSearchParams({
      q: query,
      page: String(page),
      pageSize: String(pageSize),
      country: market.countryCode,
      currency: market.currency,
      market: market.locale,
      publisher_id: this.config.publisherId,
    });

    try {
      const res = await fetch(
        `${this.config.apiBase}${this.config.endpoint}?${params.toString()}`,
        { headers: this.headers(), signal: AbortSignal.timeout(15_000) },
      );
      if (!res.ok) {
        console.warn(
          `[arabclicks-api] "${query}" ${market.countryCode}: HTTP ${res.status}`,
        );
        return [];
      }
      const payload: unknown = await res.json();
      return extractProductList(payload)
        .map(productFromEntry)
        .filter((p): p is ArabClicksRawProduct => p !== null);
    } catch (err) {
      console.warn(
        `[arabclicks-api] "${query}" ${market.countryCode} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// Ingestion runner
// ---------------------------------------------------------------------------

export type ArabClicksIngestionResult = {
  skipped?: boolean;
  reason?: string;
  configured: boolean;
  endpointConfigured: boolean;
  targetsRun: number;
  totalProducts: number;
  productsSaved: number;
  byTarget: Record<string, { total: number; saved: number; markets: string[] }>;
  errors: string[];
};

/** Module-level lock: prevents overlapping ArabClicks runs in one instance. */
let ingestionRunInProgress = false;

/**
 * ArabClicks ingestion runner.
 *
 * Sweeps Noon + Jumia offers across their EG/SA (and AE) markets and saves real
 * products under provider "noon"/"jumia". Credential-gated AND endpoint-gated:
 * returns `not-configured` / `no-api-endpoint` (and never touches the network)
 * until both are set.
 */
export async function runArabClicksIngestion(
  options: {
    maxProductsPerTarget?: number;
    deadlineMs?: number;
    dryRun?: boolean;
  } = {},
): Promise<ArabClicksIngestionResult> {
  if (ingestionRunInProgress) {
    return {
      skipped: true,
      reason: "already-running",
      configured: isArabClicksConfigured(),
      endpointConfigured: isArabClicksEndpointConfigured(),
      targetsRun: 0,
      totalProducts: 0,
      productsSaved: 0,
      byTarget: {},
      errors: [],
    };
  }
  ingestionRunInProgress = true;
  try {
    return await runArabClicksIngestionLocked(options);
  } finally {
    ingestionRunInProgress = false;
  }
}

async function runArabClicksIngestionLocked(
  options: {
    maxProductsPerTarget?: number;
    deadlineMs?: number;
    dryRun?: boolean;
  } = {},
): Promise<ArabClicksIngestionResult> {
  const { maxProductsPerTarget = 100, deadlineMs = 20_000, dryRun = false } = options;
  const startedAt = Date.now();

  const result: ArabClicksIngestionResult = {
    configured: isArabClicksConfigured(),
    endpointConfigured: isArabClicksEndpointConfigured(),
    targetsRun: 0,
    totalProducts: 0,
    productsSaved: 0,
    byTarget: {},
    errors: [],
  };

  if (!result.configured) return { ...result, skipped: true, reason: "not-configured" };
  if (!result.endpointConfigured)
    return { ...result, skipped: true, reason: "no-api-endpoint" };

  const config = getArabClicksConfig();
  if (!config) return { ...result, skipped: true, reason: "not-configured" };

  const client = new ArabClicksClient(config);

  for (const target of ARABCLICKS_TARGETS) {
    result.targetsRun++;
    const items: NormalizedCatalogItem[] = [];
    const seen = new Set<string>();
    const marketsUsed: string[] = [];
    const markets = target.markets;

    for (const market of markets) {
      if (items.length >= maxProductsPerTarget) break;
      if (Date.now() - startedAt > deadlineMs) {
        result.errors.push(
          `Deadline ${deadlineMs}ms reached during ${target.id} after ${items.length} products`,
        );
        break;
      }
      marketsUsed.push(`${market.countryCode}:${market.currency}`);

      for (const keyword of target.keywords) {
        if (items.length >= maxProductsPerTarget) break;
        const raws = await client.searchProducts(keyword, market, { pageSize: 30 });
        for (const raw of raws) {
          if (items.length >= maxProductsPerTarget) break;
          // Bind the real market signal: what we asked the network for.
          const enriched: ArabClicksRawProduct = {
            ...raw,
            countryCode: raw.countryCode ?? market.countryCode,
            currency: raw.currency ?? market.currency,
          };
          const key = enriched.externalId ?? "";
          if (!key || seen.has(key)) continue;
          const item = target.normalize(enriched, market.countryCode);
          if (!item) continue;
          seen.add(key);
          items.push(item);
        }
      }
    }

    result.byTarget[target.id] = { total: items.length, saved: 0, markets: marketsUsed };
    result.totalProducts += items.length;

    if (dryRun || items.length === 0) continue;

    try {
      const saved = await saveCatalogItemsAs(items, {
        providerId: target.id,
        store: {
          slug: target.storeSlug,
          name: target.storeName,
          nameAr: target.storeNameAr,
          website: target.website,
          integrationType: target.integrationType,
          logoUrl: target.logoUrl,
          logoInitial: target.logoInitial,
          supportedRegions: Array.from(new Set(markets.map((m) => m.countryCode))),
          supportedCurrencies: Array.from(new Set(markets.map((m) => m.currency))),
        },
      });
      result.byTarget[target.id].saved = saved;
      result.productsSaved += saved;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}
