import { runSyncJob } from "@/lib/sync/engine";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress";
import type { AliExpressSyncJobKind } from "@/lib/integrations/aliexpress/types";
import type { SyncJobType, SyncRunResult } from "@/lib/sync/types";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { logImportEvent } from "@/services/aliexpress/monitoring";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";
import {
  importImagesChunked,
  importPricesChunked,
  importProductsChunked,
  type ChunkedImportOutcome,
} from "@/lib/sync/import/pipeline";
import {
  ALIEXPRESS_CHUNK_RESULT_COUNT,
  readAliExpressImportCursor,
  startIdsCursor,
  startSweepCursor,
  type AliExpressCursorKind,
  type AliExpressImportCursor,
  writeAliExpressImportCursor,
} from "@/lib/integrations/aliexpress/import-cursor";

type AliExpressStore = {
  id: string;
  slug: string;
};

/** Same scale as a single cron /api/cron/refresh AliExpress step. */
const DEFAULT_SCHEDULED_DEADLINE_MS = 25_000;

async function getAliExpressStore(): Promise<AliExpressStore | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("stores")
    .select("id, slug")
    .eq("integration_type", "aliexpress")
    .eq("is_active", true)
    .maybeSingle();

  return data as AliExpressStore | null;
}

function mapJobKind(kind: AliExpressSyncJobKind): SyncJobType {
  if (kind === "stock") return "prices";
  return kind;
}

export async function runAliExpressSync(
  kind: AliExpressSyncJobKind
): Promise<{ ok: boolean; result?: SyncRunResult; error?: string }> {
  await loadAliExpressCredentials();

  if (!isAliExpressConfigured()) {
    const message = "AliExpress credentials not configured. Add API keys in Marketplace Settings.";
    await logImportEvent({ jobType: kind, level: "warn", message });
    return { ok: false, error: message };
  }

  const store = await getAliExpressStore();
  if (!store) {
    const message = "AliExpress store record not found.";
    await logImportEvent({ jobType: kind, level: "error", message });
    return { ok: false, error: message };
  }

  await logImportEvent({
    jobType: kind,
    level: "info",
    message: `Starting AliExpress ${kind} sync`,
    metadata: { storeId: store.id },
  });

  try {
    const result = await runSyncJob({
      storeId: store.id,
      storeSlug: store.slug,
      integrationType: "aliexpress",
      countryCode: "US",
      currency: "USD",
      jobType: mapJobKind(kind),
    });

    await logImportEvent({
      jobType: kind,
      level: result.status === "failed" ? "error" : "info",
      message:
        result.status === "failed"
          ? result.errorMessage ?? "AliExpress sync failed"
          : `AliExpress ${kind} sync completed`,
      metadata: {
        itemsFetched: result.itemsFetched,
        itemsCreated: result.itemsCreated,
        itemsUpdated: result.itemsUpdated,
        itemsFailed: result.itemsFailed,
      },
    });

    return { ok: result.status !== "failed", result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AliExpress sync failed";
    await logImportEvent({ jobType: kind, level: "error", message });
    return { ok: false, error: message };
  }
}

type ChunkedKindOutcome = {
  result: SyncRunResult;
  pending: boolean;
  error?: string;
};

/**
 * Run ONE AliExpress kind as a resumable micro-batch within the shared
 * deadline. Reads the persisted cursor, processes up to the deadline, persists
 * the next cursor, and reports whether the kind still has pending work.
 */
async function runAliExpressChunkedKind(
  store: AliExpressStore,
  kind: AliExpressCursorKind,
  deadlineAt: number,
): Promise<ChunkedKindOutcome> {
  const supabase = createSupabaseServiceClient();
  const jobType = kind === "prices" ? "prices" : kind;
  const result: SyncRunResult = {
    jobType,
    status: "running",
    itemsFetched: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsFailed: 0,
  };

  const ctx = {
    storeId: store.id,
    storeSlug: store.slug,
    integrationType: "aliexpress" as const,
    countryCode: "US",
    currency: "USD",
    connectorId: "aliexpress" as const,
  };

  const nextStart =
    kind === "prices" ? (): AliExpressImportCursor => startIdsCursor() : startSweepCursor;

  try {
    if (!supabase) {
      result.status = "failed";
      result.errorMessage = "Supabase not configured";
      return { result, pending: false, error: "Supabase not configured" };
    }

    const cursor = await readAliExpressImportCursor(kind);
    const startedAt = Date.now();

    // Durable progress: persist the resume pointer AFTER EVERY chunk so a hard
    // cap mid-loop (or a hung chunk) never loses more than the in-flight chunk.
    // Idempotent upserts make a re-fetched page safe to replay.
    const persist = (nextCursor: AliExpressImportCursor | null) =>
      writeAliExpressImportCursor(kind, nextCursor ?? nextStart());

    let outcome: ChunkedImportOutcome | undefined;
    if (kind === "products") {
      outcome = await importProductsChunked(supabase, ctx, result, { cursor, deadlineAt, persist });
    } else if (kind === "prices") {
      outcome = await importPricesChunked(supabase, ctx, result, {
        cursor,
        deadlineAt,
        batchSize: ALIEXPRESS_CHUNK_RESULT_COUNT,
        persist,
      });
    } else {
      outcome = await importImagesChunked(supabase, ctx, result, { cursor, deadlineAt, persist });
    }

    // Persist the resume pointer: the next chunk when time ran out, or the
    // start of a fresh sweep when the kind fully completed this run.
    const nextCursor = outcome.done ? nextStart() : outcome.nextCursor;
    if (nextCursor) {
      await writeAliExpressImportCursor(kind, nextCursor);
    }

    result.status = result.itemsFailed > 0 ? "failed" : "completed";
    result.metadata = {
      done: outcome.done,
      processed: outcome.processed,
      cursor: nextCursor,
      chunkTookMs: Date.now() - startedAt,
    };

    return { result, pending: !outcome.done };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AliExpress chunked sync failed";
    result.status = "failed";
    result.errorMessage = message;
    await logImportEvent({ jobType: kind, level: "error", message });
    return { result, pending: true, error: message };
  }
}

export async function runAliExpressScheduledSync(options?: {
  deadlineMs?: number;
}): Promise<{
  skipped: boolean;
  results: SyncRunResult[];
  error?: string;
  done?: boolean;
  resumedKind?: string;
}> {
  await loadAliExpressCredentials();

  if (!isAliExpressConfigured()) {
    await logImportEvent({
      jobType: "scheduled",
      level: "info",
      message: "AliExpress scheduled sync skipped — credentials not configured",
    });
    return { skipped: true, results: [], done: true };
  }

  const store = await getAliExpressStore();
  if (!store) {
    const message = "AliExpress store record not found.";
    await logImportEvent({ jobType: "scheduled", level: "error", message });
    return { skipped: true, results: [], error: message, done: true };
  }

  const deadlineMs = Number(options?.deadlineMs) > 0
    ? Number(options?.deadlineMs)
    : DEFAULT_SCHEDULED_DEADLINE_MS;
  const deadlineAt = Date.now() + deadlineMs;

  const kinds: AliExpressCursorKind[] = ["products", "prices", "images"];
  const results: SyncRunResult[] = [];
  let pendingKind: string | undefined;
  let allDone = true;

  for (const kind of kinds) {
    if (Date.now() >= deadlineAt) {
      pendingKind = kind;
      allDone = false;
      break;
    }

    const outcome = await runAliExpressChunkedKind(store, kind, deadlineAt);
    results.push(outcome.result);

    if (outcome.error) {
      await logImportEvent({
        jobType: kind,
        level: "error",
        message: outcome.error,
      });
      // A hard failure stops the run so the error surfaces; the persisted
      // cursor still lets the next invocation resume this kind.
      pendingKind = kind;
      allDone = false;
      break;
    }

    if (outcome.pending) {
      pendingKind = kind;
      allDone = false;
      break;
    }
  }

  return {
    skipped: false,
    results,
    done: allDone,
    resumedKind: pendingKind,
    error: results.some((r) => r.status === "failed") ? "AliExpress scheduled sync had failures" : undefined,
  };
}