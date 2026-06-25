import {
  importDealsFromProvider,
  importImagesFromProvider,
  importPricesFromProvider,
  importProductsFromProvider,
} from "@/lib/sync/import/pipeline";
import { getConnectorForIntegration } from "@/lib/sync/connectors";
import { resolveImportConfig } from "@/lib/sync/providers/shared/import-config";
import type { SyncJobType, SyncRunResult } from "@/lib/sync/types";
import type { StoreIntegrationType } from "@/lib/types/entities";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";

interface RunJobInput {
  storeId: string;
  storeSlug: string;
  integrationType: StoreIntegrationType;
  countryCode: string;
  currency: string;
  jobType: SyncJobType;
  syncJobId?: string;
  jobConfig?: Record<string, unknown> | null;
}

type SyncContext = import("@/lib/sync/types").SyncContext;
type SyncEngineOptions = import("@/lib/sync/types").SyncEngineOptions;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb | null): any {
  return client;
}

export async function runSyncJob(
  input: RunJobInput,
  options: SyncEngineOptions = {}
): Promise<SyncRunResult> {
  const { persist = true, dryRun = false } = options;
  const supabase = persist && !dryRun ? createSupabaseServiceClient() : null;

  const ctx: SyncContext = {
    storeId: input.storeId,
    storeSlug: input.storeSlug,
    integrationType: input.integrationType,
    countryCode: input.countryCode,
    currency: input.currency,
    connectorId: input.integrationType,
    jobConfig: resolveImportConfig(
      input.integrationType,
      input.jobConfig
    ),
  };

  const result: SyncRunResult = {
    jobType: input.jobType,
    status: "running",
    itemsFetched: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsFailed: 0,
  };

  let runId: string | null = null;

  if (supabase) {
    const { data: run } = await db(supabase)
      .from("sync_runs")
      .insert({
        sync_job_id: input.syncJobId ?? null,
        store_id: input.storeId,
        job_type: input.jobType,
        status: "running",
        country_code: input.countryCode,
        currency: input.currency,
        metadata: { provider: input.integrationType },
      })
      .select("id")
      .single();
    runId = run?.id ?? null;
  }

  try {
    if (!supabase || dryRun) {
      const connector = getConnectorForIntegration(input.integrationType);
      if (input.jobType === "products" || input.jobType === "full") {
        const products = await connector.fetchProducts(ctx);
        result.itemsFetched += products.length;
      }
      if (input.jobType === "prices" || input.jobType === "full") {
        const products = await connector.fetchProducts(ctx);
        result.itemsFetched += products.length;
      }
      if (input.jobType === "deals" || input.jobType === "full") {
        const deals = await connector.fetchDeals(ctx);
        result.itemsFetched += deals.length;
      }
      result.status = "completed";
      return result;
    }

    if (input.jobType === "products" || input.jobType === "full") {
      await importProductsFromProvider(supabase, ctx, result);
    }
    if (input.jobType === "prices" || input.jobType === "full") {
      await importPricesFromProvider(supabase, ctx, result);
    }
    if (input.jobType === "deals" || input.jobType === "full") {
      await importDealsFromProvider(supabase, ctx, result);
    }
    if (input.jobType === "images" || input.jobType === "full") {
      await importImagesFromProvider(supabase, ctx, result);
    }

    result.status = result.itemsFailed > 0 ? "failed" : "completed";

    await db(supabase)
      .from("sync_runs")
      .update({
        status: result.status,
        finished_at: new Date().toISOString(),
        items_fetched: result.itemsFetched,
        items_created: result.itemsCreated,
        items_updated: result.itemsUpdated,
        items_failed: result.itemsFailed,
        error_message: result.errorMessage ?? null,
      })
      .eq("id", runId);

    await db(supabase)
      .from("stores")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", input.storeId);
  } catch (err) {
    result.status = "failed";
    result.errorMessage = err instanceof Error ? err.message : "Sync failed";
    if (supabase && runId) {
      await db(supabase)
        .from("sync_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: result.errorMessage,
        })
        .eq("id", runId);
    }
  }

  return result;
}
