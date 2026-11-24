import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { ProductionProviderId } from "@/lib/integration/constants";
import { createCronBudget } from "@/lib/cron/budget";
import { runProviderStepsParallel } from "@/lib/cron/provider-steps";
import { runProviderSyncStore } from "@/lib/sync/runner";
import { SCRAPER_SEED_QUERIES } from "@/lib/sync/scraper/stores";
import { GLOBAL_TIMEOUT_MS } from "@/lib/sync/timeout";

const US_STORE_IDS = new Set<string>(["amazon", "walmart", "bestbuy"]);

const STORE_IDS = [
  "amazon",
  "amazon-eg",
  "noon",
  "jumia",
  "carrefour",
  "btech",
  "temu",
  "aliexpress",
  "ebay",
  "admitad",
  "twob",
  "dubaiphone",
  "raneen",
  "eldokan",
  "walmart",
  "bestbuy",
] as const satisfies readonly ProductionProviderId[];

function positiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

async function bumpSearchCacheVersion(): Promise<string | null> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[sync-all-catalogs] cache bump skipped: Supabase credentials unavailable");
    return null;
  }

  const version = `v3-${Date.now()}`;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: settingError } = await db.from("integration_settings").upsert(
    {
      key: "search_cache_version",
      value: version,
      provider: "search",
      label: "Search cache epoch",
      is_secret: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (settingError) {
    console.error(`[sync-all-catalogs] cache version write failed: ${settingError.message}`);
    return null;
  }

  const { error: cacheError } = await db
    .from("search_result_cache")
    .delete()
    .not("cache_key", "is", null);
  if (cacheError) {
    console.warn(`[sync-all-catalogs] cache row delete failed: ${cacheError.message}`);
  }

  console.log(`[sync-all-catalogs] search cache bumped to ${version}`);
  return version;
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const configuredQueries = process.env.SYNC_STORE_QUERIES?.trim();
  const queryLimit = positiveInt("SYNC_SCRAPER_QUERIES", SCRAPER_SEED_QUERIES.length);
  const queries = (configuredQueries || SCRAPER_SEED_QUERIES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, queryLimit);
  const maxProductsPerStore = positiveInt("SYNC_STORE_MAX_PRODUCTS", 3000);
  const budgetMs = positiveInt("SYNC_BUDGET_MS", 3_000_000);
  const abortController = new AbortController();
  const stores: Record<string, unknown> = {};
  let cacheBumpStarted = false;

  const summary: Record<string, unknown> = {
    startedAt,
    queries,
    maxProductsPerStore,
    budgetMs,
    globalTimeoutMs: GLOBAL_TIMEOUT_MS,
    providerSteps: {},
    stores,
  };

  const writeSummary = (): void => {
    mkdirSync("logs", { recursive: true });
    writeFileSync("logs/catalog-sync-summary.json", JSON.stringify(summary, null, 2));
  };

  const bumpCache = async (): Promise<void> => {
    if (cacheBumpStarted) return;
    cacheBumpStarted = true;
    try {
      summary.searchCacheVersion = await bumpSearchCacheVersion();
    } catch (error) {
      summary.searchCacheVersion = { error: error instanceof Error ? error.message : String(error) };
      console.error("[sync-all-catalogs] cache bump failed:", error);
    }
  };

  const flushAndExit = async (): Promise<void> => {
    summary.timedOut = true;
    summary.finishedAt = new Date().toISOString();
    writeSummary();
    const forceExitTimer = setTimeout(() => {
      console.warn("[sync-all-catalogs] cache bump exceeded hard limit; exiting");
      process.exit(0);
    }, 10_000);
    forceExitTimer.unref?.();
    await bumpCache();
    clearTimeout(forceExitTimer);
    writeSummary();
    console.warn(
      `[sync-all-catalogs] global ${GLOBAL_TIMEOUT_MS}ms safety timeout reached; flushed and exiting`,
    );
    process.exit(0);
  };

  const emergencyExit = (label: string, error?: unknown): void => {
    if (error) console.error(`[sync-all-catalogs] ${label} flush failed:`, error);
    process.exit(0);
  };

  const safetyTimer = setTimeout(() => {
    abortController.abort();
    void flushAndExit().catch((error) => emergencyExit("global timeout", error));
  }, GLOBAL_TIMEOUT_MS);

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      abortController.abort();
      void flushAndExit().catch((error) => emergencyExit(signal, error));
    });
  }

  writeSummary();

  try {
    const providerResults = await runProviderStepsParallel(createCronBudget(budgetMs));
    summary.providerSteps = providerResults;
    console.log("[sync-all-catalogs] provider steps:", JSON.stringify(providerResults));
  } catch (error) {
    summary.providerSteps = { error: error instanceof Error ? error.message : String(error) };
    console.error("[sync-all-catalogs] provider steps failed:", error);
  }
  writeSummary();

  const storeConcurrency = positiveInt("SYNC_STORE_CONCURRENCY", 6);
  let nextStoreIndex = 0;
  const runNextStore = async (): Promise<void> => {
    while (!abortController.signal.aborted && nextStoreIndex < STORE_IDS.length) {
      const providerId = STORE_IDS[nextStoreIndex];
      nextStoreIndex += 1;
      try {
        const result = await runProviderSyncStore({
          providerId,
          queries,
          maxProducts: maxProductsPerStore,
          countryCode: US_STORE_IDS.has(providerId) ? "US" : "EG",
          currency: US_STORE_IDS.has(providerId) ? "USD" : "EGP",
          abortSignal: abortController.signal,
        });
        stores[providerId] = result;
        console.log(`[sync-all-catalogs] ${providerId}:`, JSON.stringify(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stores[providerId] = { listings: 0, saved: 0, source: "unknown", error: message };
        console.error(`[sync-all-catalogs] ${providerId} failed:`, message);
      }
      writeSummary();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(storeConcurrency, STORE_IDS.length) }, () => runNextStore()),
  );
  summary.finishedAt = new Date().toISOString();

  clearTimeout(safetyTimer);
  await bumpCache();
  writeSummary();
  console.log("[sync-all-catalogs] complete");
}

main().catch((error) => {
  console.error("[sync-all-catalogs] fatal:", error);
  process.exitCode = 1;
});
