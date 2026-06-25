import { runDueSyncJobs, getDueSyncJobs } from "@/lib/sync/scheduler";
import { runSyncJob } from "@/lib/sync/engine";
import { deactivatePlaceholderProducts } from "@/lib/sync/import/cleanup";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress";
import { isEbayConfigured } from "@/lib/integrations/ebay";
import type { SyncJobType, SyncRunResult } from "@/lib/sync/types";
import type { ServiceResult } from "@/lib/types/entities";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function executeScheduledSync(): Promise<ServiceResult<SyncRunResult[]>> {
  try {
    const results = await runDueSyncJobs();
    return { data: results, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : "Sync scheduler failed",
    };
  }
}

export async function getPendingJobs() {
  const jobs = await getDueSyncJobs();
  return { data: jobs, error: null };
}

export async function triggerStoreSync(input: {
  storeId: string;
  storeSlug: string;
  integrationType: string;
  countryCode?: string;
  currency?: string;
  jobType?: SyncJobType;
  jobConfig?: Record<string, unknown> | null;
}): Promise<ServiceResult<SyncRunResult>> {
  try {
    const result = await runSyncJob({
      storeId: input.storeId,
      storeSlug: input.storeSlug,
      integrationType: input.integrationType as never,
      countryCode: input.countryCode ?? "US",
      currency: input.currency ?? "USD",
      jobType: input.jobType ?? "full",
      jobConfig: input.jobConfig,
    });
    return { data: result, error: null };
  } catch (err) {
    return {
      data: {
        jobType: input.jobType ?? "full",
        status: "failed",
        itemsFetched: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsFailed: 0,
        errorMessage: err instanceof Error ? err.message : "Sync failed",
      },
      error: err instanceof Error ? err.message : "Sync failed",
    };
  }
}

export async function triggerProviderSync(input: {
  storeId: string;
  storeSlug: string;
  integrationType: string;
  countryCode?: string;
  currency?: string;
  jobType?: SyncJobType;
  jobConfig?: Record<string, unknown> | null;
}): Promise<ServiceResult<SyncRunResult>> {
  return triggerStoreSync(input);
}

/** Trigger import for all Phase 1 providers (AliExpress, eBay, CJdropshipping). */
export async function triggerPhase1Imports(): Promise<ServiceResult<SyncRunResult[]>> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const phase1 = ["aliexpress", "ebay", "cjdropshipping"];
  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, slug, integration_type")
    .in("integration_type", phase1)
    .eq("sync_enabled", true);

  if (error) return { data: [], error: error.message };

  const results: SyncRunResult[] = [];
  type ImportStore = { id: string; slug: string; integration_type: string };
  for (const store of (stores ?? []) as ImportStore[]) {
    if (store.integration_type === "aliexpress" && !isAliExpressConfigured()) {
      continue;
    }
    if (store.integration_type === "ebay" && !isEbayConfigured()) {
      continue;
    }
    const { data: result, error: syncError } = await triggerStoreSync({
      storeId: store.id,
      storeSlug: store.slug,
      integrationType: store.integration_type,
      jobType: "full",
    });
    if (result) results.push(result);
    if (syncError) {
      results.push({
        jobType: "full",
        status: "failed",
        itemsFetched: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsFailed: 0,
        errorMessage: syncError,
      });
    }
  }

  await deactivatePlaceholderProducts(supabase);

  return { data: results, error: null };
}

export async function getImportProviders() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("import_providers")
    .select("*")
    .eq("is_enabled", true)
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function getRecentSyncRuns(limit = 20) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}
