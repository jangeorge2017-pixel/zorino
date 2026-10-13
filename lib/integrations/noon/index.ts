import {
  getNoonConfig,
  isNoonConfigured,
  isNoonEndpointConfigured,
  NOON_PROVIDER_ID,
} from "./config";
import { NoonClient } from "./client";
import { noonRawToCatalogItem } from "./normalization";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import { saveCatalogItemsAs } from "@/lib/integration/catalog-saver";

export { NOON_PROVIDER_ID } from "./config";
export { isNoonConfigured, isNoonEndpointConfigured, getNoonConfig } from "./config";
export { NoonClient } from "./client";
export { noonRawToCatalogItem } from "./normalization";
export type { NoonRawProduct } from "./types";

export type NoonIngestionResult = {
  skipped?: boolean;
  reason?: string;
  configured: boolean;
  endpointConfigured: boolean;
  totalProducts: number;
  productsSaved: number;
  errors: string[];
};

const NOON_IMPORT_KEYWORDS = [
  "mobile phones",
  "electronics",
  "laptops",
  "headphones",
  "smart watches",
  "televisions",
  "home appliances",
  "gaming",
];

function dayOfYear(date: Date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const today = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return Math.floor((today - start) / 86_400_000);
}

function rotatePool(pool: readonly string[], offset: number, count: number): string[] {
  const n = pool.length;
  if (n === 0 || count <= 0) return [];
  const start = ((Math.trunc(offset) % n) + n) % n;
  return Array.from({ length: Math.min(count, n) }, (_, i) => pool[(start + i) % n]);
}

/** Module-level lock: prevents overlapping Noon ingestion runs in one instance. */
let ingestionRunInProgress = false;

/**
 * Noon ingestion runner.
 *
 * Credential-gated by NOON_API_KEY alone is NOT enough — the client also needs
 * a real API endpoint (NOON_API_BASE + NOON_API_ENDPOINT). Until BOTH exist the
 * runner reports an explicit skip reason and never touches the network, so a
 * credential-only environment cannot fabricate or guess inventory. When a real
 * Noon API contract is confirmed, set the endpoint env vars and this runner
 * upserts real products into products/prices/lowest_prices_today (provider =
 * "noon") with zero further code changes.
 */
export async function runNoonIngestion(
  options: {
    maxProducts?: number;
    deadlineMs?: number;
    dryRun?: boolean;
  } = {},
): Promise<NoonIngestionResult> {
  if (ingestionRunInProgress) {
    return {
      skipped: true,
      reason: "already-running",
      configured: isNoonConfigured(),
      endpointConfigured: isNoonEndpointConfigured(),
      totalProducts: 0,
      productsSaved: 0,
      errors: [],
    };
  }
  ingestionRunInProgress = true;
  try {
    return await runNoonIngestionLocked(options);
  } finally {
    ingestionRunInProgress = false;
  }
}

async function runNoonIngestionLocked(
  options: {
    maxProducts?: number;
    deadlineMs?: number;
    dryRun?: boolean;
  } = {},
): Promise<NoonIngestionResult> {
  const { maxProducts = 200, deadlineMs = 30_000, dryRun = false } = options;
  const startedAt = Date.now();

  const result: NoonIngestionResult = {
    configured: isNoonConfigured(),
    endpointConfigured: isNoonEndpointConfigured(),
    totalProducts: 0,
    productsSaved: 0,
    errors: [],
  };

  if (!result.configured) {
    return { ...result, skipped: true, reason: "not-configured" };
  }
  if (!result.endpointConfigured) {
    return { ...result, skipped: true, reason: "no-api-endpoint" };
  }

  const config = getNoonConfig();
  if (!config) {
    return { ...result, skipped: true, reason: "not-configured" };
  }

  const keywords = rotatePool(NOON_IMPORT_KEYWORDS, dayOfYear(), 3);
  const rawProducts = await new NoonClient(config).searchProducts(keywords, {
    maxPages: 1,
    pageSize: 30,
  });

  const items: NormalizedCatalogItem[] = [];
  const seen = new Set<string>();
  for (const raw of rawProducts) {
    if (items.length >= maxProducts) break;
    if (Date.now() - startedAt > deadlineMs) {
      result.errors.push(
        `Deadline ${deadlineMs}ms reached after ${items.length} products`,
      );
      break;
    }
    const key = raw.externalId ?? "";
    if (seen.has(key)) continue;
    const item = noonRawToCatalogItem(raw, config.country);
    if (!item) continue;
    seen.add(key);
    items.push(item);
  }
  result.totalProducts = items.length;

  if (dryRun || items.length === 0) {
    if (dryRun) console.log(`[noon-ingest] DRY RUN — skipping DB save (${items.length} products)`);
    return result;
  }

  try {
    result.productsSaved = await saveCatalogItemsAs(items, {
      providerId: NOON_PROVIDER_ID,
      store: {
        slug: "noon",
        name: "Noon",
        nameAr: "نون",
        website: "https://www.noon.com",
        integrationType: "noon",
        logoUrl: "/stores/noon.svg",
        logoInitial: "NN",
        supportedRegions: ["AE", "SA", "EG"],
        supportedCurrencies: ["AED", "SAR", "EGP"],
      },
    });
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}