import {
  getJumiaConfig,
  isJumiaConfigured,
  isJumiaEndpointConfigured,
  JUMIA_PROVIDER_ID,
} from "./config";
import { JumiaClient } from "./client";
import { jumiaRawToCatalogItem } from "./normalization";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import { saveCatalogItemsAs } from "@/lib/integration/catalog-saver";

export { JUMIA_PROVIDER_ID } from "./config";
export { isJumiaConfigured, isJumiaEndpointConfigured, getJumiaConfig } from "./config";
export { JumiaClient } from "./client";
export { jumiaRawToCatalogItem } from "./normalization";
export type { JumiaRawProduct } from "./types";

export type JumiaIngestionResult = {
  skipped?: boolean;
  reason?: string;
  configured: boolean;
  endpointConfigured: boolean;
  totalProducts: number;
  productsSaved: number;
  errors: string[];
};

const JUMIA_IMPORT_KEYWORDS = [
  "smartphones",
  "electronics",
  "laptops",
  "headphones",
  "smart watches",
  "home appliances",
  "fashion",
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

/** Module-level lock: prevents overlapping Jumia ingestion runs in one instance. */
let ingestionRunInProgress = false;

/**
 * Jumia ingestion runner.
 *
 * Credential-gated by JUMIA_API_KEY + JUMIA_AFFILIATE_ID alone is NOT enough —
 * the client also needs a real API endpoint (JUMIA_API_BASE + JUMIA_API_ENDPOINT).
 * Until BOTH exist the runner reports an explicit skip reason and never touches
 * the network, so a credential-only environment cannot fabricate or guess
 * inventory. When a real Jumia API contract is confirmed, set the endpoint env
 * vars and this runner upserts real products into
 * products/prices/lowest_prices_today (provider = "jumia") with zero further
 * code changes.
 */
export async function runJumiaIngestion(
  options: {
    maxProducts?: number;
    deadlineMs?: number;
    dryRun?: boolean;
  } = {},
): Promise<JumiaIngestionResult> {
  if (ingestionRunInProgress) {
    return {
      skipped: true,
      reason: "already-running",
      configured: isJumiaConfigured(),
      endpointConfigured: isJumiaEndpointConfigured(),
      totalProducts: 0,
      productsSaved: 0,
      errors: [],
    };
  }
  ingestionRunInProgress = true;
  try {
    return await runJumiaIngestionLocked(options);
  } finally {
    ingestionRunInProgress = false;
  }
}

async function runJumiaIngestionLocked(
  options: {
    maxProducts?: number;
    deadlineMs?: number;
    dryRun?: boolean;
  } = {},
): Promise<JumiaIngestionResult> {
  const { maxProducts = 200, deadlineMs = 30_000, dryRun = false } = options;
  const startedAt = Date.now();

  const result: JumiaIngestionResult = {
    configured: isJumiaConfigured(),
    endpointConfigured: isJumiaEndpointConfigured(),
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

  const config = getJumiaConfig();
  if (!config) {
    return { ...result, skipped: true, reason: "not-configured" };
  }

  const keywords = rotatePool(JUMIA_IMPORT_KEYWORDS, dayOfYear(), 3);
  const rawProducts = await new JumiaClient(config).searchProducts(keywords, {
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
    const item = jumiaRawToCatalogItem(raw, config.country);
    if (!item) continue;
    seen.add(key);
    items.push(item);
  }
  result.totalProducts = items.length;

  if (dryRun || items.length === 0) {
    if (dryRun) console.log(`[jumia-ingest] DRY RUN — skipping DB save (${items.length} products)`);
    return result;
  }

  try {
    result.productsSaved = await saveCatalogItemsAs(items, {
      providerId: JUMIA_PROVIDER_ID,
      store: {
        slug: "jumia",
        name: "Jumia",
        nameAr: "جوميا",
        website: "https://www.jumia.com",
        integrationType: "partner",
        supportedRegions: ["NG", "KE", "GH", "EG", "MA"],
        supportedCurrencies: ["USD", "NGN", "KES", "GHS"],
      },
    });
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}