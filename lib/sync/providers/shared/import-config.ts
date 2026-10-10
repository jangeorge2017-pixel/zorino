/** Per-job import configuration stored on sync_jobs.config */
export type ImportJobConfig = {
  keywords?: string[];
  categorySlug?: string;
  maxPages?: number;
  pageSize?: number;
  productIds?: string[];
};

/**
 * Base keyword pools per provider. These are the generic catalog terms the
 * scheduled import jobs sweep. The pool is intentionally BROAD and, when no
 * explicit `jobConfig.keywords` is supplied, a rotating WINDOW of it is used
 * per run (see `resolveImportConfig`) so successive runs cover the whole pool
 * instead of importing the same handful of terms forever.
 */
export const DEFAULT_IMPORT_KEYWORDS: Record<string, string[]> = {
  aliexpress: [
    "wireless earbuds",
    "smart watch",
    "phone case",
    "bluetooth speaker",
    "power bank",
    "usb c cable",
    "led strip lights",
    "kitchen gadgets",
    "fitness tracker",
    "phone holder",
    "gaming mouse",
    "backpack",
  ],
  ebay: [
    "iphone",
    "macbook",
    "playstation",
    "nike shoes",
    "samsung galaxy",
    "ipad",
    "laptop",
    "airpods",
    "nintendo switch",
    "graphics card",
    "smart watch",
    "headphones",
  ],
  amazon: [
    "electronics",
    "laptop",
    "smartphone",
    "headphones",
    "smart watch",
    "tablet",
    "gaming console",
    "bluetooth speaker",
    "power bank",
    "usb hub",
    "computer monitor",
    "keyboard",
  ],
  walmart: ["electronics", "tv", "laptop", "gaming"],
  temu: ["home gadgets", "phone accessories", "fashion deals"],
  cjdropshipping: ["phone accessories", "home decor", "pet supplies"],
};

/**
 * How many keywords one scheduled run sweeps. Kept small so a run stays inside
 * the scheduler's wall-clock cap; the rotation covers the rest over time.
 */
export const KEYWORDS_PER_RUN = 6;

/** Deterministic day-of-year seed (stable within a day, advances daily). */
function dayOfYear(date: Date = new Date()): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((today - startOfYear) / 86_400_000);
}

/**
 * Pure rotation: return `count` keywords starting at `offset`, wrapping around
 * the pool. Exported for unit-testing the scheduled-import coverage contract.
 */
export function rotateKeywords(
  pool: readonly string[],
  offset: number,
  count: number = KEYWORDS_PER_RUN,
): string[] {
  const n = pool.length;
  if (n === 0 || count <= 0) return [];
  const start = ((Math.trunc(offset) % n) + n) % n;
  const take = Math.min(count, n);
  const out: string[] = new Array(take);
  for (let i = 0; i < take; i++) out[i] = pool[(start + i) % n];
  return out;
}

export function resolveImportConfig(
  provider: string,
  jobConfig?: Record<string, unknown> | null
): ImportJobConfig {
  // An explicit keyword list (from sync_jobs.config or a previous resolve pass)
  // is used verbatim — only the DEFAULT pool rotates.
  const hasExplicitKeywords =
    Array.isArray(jobConfig?.keywords) && (jobConfig!.keywords as unknown[]).length > 0;

  const keywords = hasExplicitKeywords
    ? (jobConfig!.keywords as string[])
    : rotateKeywords(DEFAULT_IMPORT_KEYWORDS[provider] ?? ["electronics"], dayOfYear());

  return {
    keywords,
    categorySlug: typeof jobConfig?.categorySlug === "string" ? jobConfig.categorySlug : undefined,
    maxPages: typeof jobConfig?.maxPages === "number" ? jobConfig.maxPages : 3,
    pageSize: typeof jobConfig?.pageSize === "number" ? jobConfig.pageSize : 30,
    productIds: Array.isArray(jobConfig?.productIds)
      ? (jobConfig.productIds as string[])
      : undefined,
  };
}
