import { runSyncJob } from "@/lib/sync/engine";
import { isAmazonConfigured } from "@/lib/integrations/amazon";
import type { SyncJobType, SyncRunResult } from "@/lib/sync/types";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadAmazonCredentials } from "@/services/amazon/credentials";

type AmazonStore = {
  id: string;
  slug: string;
};

async function getAmazonStore(): Promise<AmazonStore | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("stores")
    .select("id, slug")
    .eq("integration_type", "amazon")
    .eq("is_active", true)
    .maybeSingle();

  return data as AmazonStore | null;
}

export async function runAmazonSync(
  kind: SyncJobType
): Promise<{ ok: boolean; result?: SyncRunResult; error?: string }> {
  await loadAmazonCredentials();

  if (!isAmazonConfigured()) {
    return { ok: false, error: "Amazon credentials not configured." };
  }

  const store = await getAmazonStore();
  if (!store) {
    return { ok: false, error: "Amazon store record not found." };
  }

  try {
    const result = await runSyncJob({
      storeId: store.id,
      storeSlug: store.slug,
      integrationType: "amazon",
      countryCode: "US",
      currency: "USD",
      jobType: kind,
    });

    return { ok: result.status !== "failed", result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Amazon sync failed" };
  }
}

export async function runAmazonScheduledSync(): Promise<{
  skipped: boolean;
  results: SyncRunResult[];
  error?: string;
}> {
  await loadAmazonCredentials();

  if (!isAmazonConfigured()) {
    return { skipped: true, results: [] };
  }

  const kinds: SyncJobType[] = ["products", "prices"];
  const results: SyncRunResult[] = [];

  for (const kind of kinds) {
    const { ok, result, error } = await runAmazonSync(kind);
    if (result) results.push(result);
    if (!ok && error) {
      return { skipped: false, results, error };
    }
  }

  return { skipped: false, results };
}
