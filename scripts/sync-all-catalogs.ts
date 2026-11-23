import { mkdirSync, writeFileSync } from "node:fs";
import type { ProductionProviderId } from "@/lib/integration/constants";
import { createCronBudget } from "@/lib/cron/budget";
import { runProviderStepsParallel } from "@/lib/cron/provider-steps";
import { runProviderSyncStore } from "@/lib/sync/runner";
import { SCRAPER_SEED_QUERIES } from "@/lib/sync/scraper/stores";

const STORE_IDS = [
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

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const queries = (process.env.SYNC_STORE_QUERIES ?? SCRAPER_SEED_QUERIES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const maxProductsPerStore = positiveInt("SYNC_STORE_MAX_PRODUCTS", 3000);
  const budgetMs = positiveInt("SYNC_BUDGET_MS", 3_000_000);

  const summary: Record<string, unknown> = {
    startedAt,
    queries,
    maxProductsPerStore,
    budgetMs,
    providerSteps: {},
    stores: {},
  };

  const writeSummary = (): void => {
    mkdirSync("logs", { recursive: true });
    writeFileSync("logs/catalog-sync-summary.json", JSON.stringify(summary, null, 2));
  };

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

  const stores: Record<string, unknown> = {};
  for (const providerId of STORE_IDS) {
    try {
      const result = await runProviderSyncStore({
        providerId,
        queries,
        maxProducts: maxProductsPerStore,
        countryCode: providerId === "walmart" || providerId === "bestbuy" ? "US" : "EG",
        currency: providerId === "walmart" || providerId === "bestbuy" ? "USD" : "EGP",
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
  summary.stores = stores;
  summary.finishedAt = new Date().toISOString();

  writeSummary();
  console.log("[sync-all-catalogs] complete");
}

main().catch((error) => {
  console.error("[sync-all-catalogs] fatal:", error);
  process.exitCode = 1;
});
