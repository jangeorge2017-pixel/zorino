/**
 * Resumable import cursors for chunked provider ingestion.
 *
 * Vercel Hobby caps serverless functions at 60s and Cloudflare ends long cron
 * requests with HTTP 504/524. Instead of fetching the WHOLE AliExpress sweep
 * and writing every row in one invocation, the scheduled sync now runs in
 * micro-batches and persists a small cursor (keyword index + page, or an
 * external-id offset) at the end of each fast cycle. The next cron invocation
 * reads the cursor and resumes exactly where the last one stopped.
 *
 * Cursor shapes (stored as JSON in `provider_import_cursors`, migration 029):
 *   { type: "sweep", keywordIndex: n, page: n }   keyword × page sweep
 *   { type: "ids", offset: n }                     external-id offset
 *
 * Pure + total: the DB read/write is best-effort and never throws into the
 * import run; when the table is absent it degrades to a deterministic start
 * cursor (keyword 0 / page 1, offset 0) so chunking still works.
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type AliExpressImportCursor =
  | { type: "sweep"; keywordIndex: number; page: number }
  | { type: "ids"; offset: number };

/** Cursor "kind" column values (provider-scoped rows). */
export type AliExpressCursorKind = "products" | "prices" | "images";

const PROVIDER = "aliexpress";

/** Target products per micro-batch / per API request. Keeps each request ~15s. */
export const ALIEXPRESS_CHUNK_RESULT_COUNT = 20;

/** Start-of-sweep cursor: first keyword, first page. */
export function startSweepCursor(): AliExpressImportCursor {
  return { type: "sweep", keywordIndex: 0, page: 1 };
}

/** Start-of-ids cursor. */
export function startIdsCursor(): AliExpressImportCursor {
  return { type: "ids", offset: 0 };
}

/**
 * Advance a keyword×page sweep cursor after fetching one page.
 *
 * Pure cursor math — the fetch layer calls this with how many items the last
 * page actually returned. A short page (fewer than `pageSize`) means that
 * keyword is exhausted; a page at `maxPages` also advances keywords. When the
 * last keyword is exhausted the sweep is done.
 */
export function advanceSweepCursor(
  cursor: AliExpressImportCursor,
  keywordsCount: number,
  maxPages: number,
  pageSize: number,
  itemsFetched: number,
): { next: AliExpressImportCursor | null; done: boolean } {
  if (keywordsCount <= 0) return { next: null, done: true };
  if (cursor.type !== "sweep") return { next: null, done: true };

  const keywordIndex = Math.max(0, Math.trunc(cursor.keywordIndex) || 0);
  const page = Math.max(1, Math.trunc(cursor.page) || 1);

  const keywordHasMorePages = page < maxPages && itemsFetched >= pageSize;
  if (keywordHasMorePages) {
    return { next: { type: "sweep", keywordIndex, page: page + 1 }, done: false };
  }

  const nextKeyword = keywordIndex + 1;
  if (nextKeyword >= keywordsCount) {
    return { next: null, done: true };
  }
  return { next: { type: "sweep", keywordIndex: nextKeyword, page: 1 }, done: false };
}

/**
 * Advance an external-id offset cursor by one batch.
 * Returns `done: true` (and a null cursor) when the whole id list is consumed.
 */
export function advanceIdsCursor(
  offset: number,
  totalIds: number,
  batchSize: number,
): { next: AliExpressImportCursor | null; done: boolean } {
  const safeBatch = Math.max(1, Math.trunc(batchSize) || 1);
  const start = Math.max(0, Math.trunc(offset) || 0);
  const next = start + safeBatch;
  if (next >= totalIds) return { next: null, done: true };
  return { next: { type: "ids", offset: next }, done: false };
}

/** Read the persisted cursor for a kind; null when none stored yet. */
export async function readAliExpressImportCursor(
  kind: AliExpressCursorKind,
): Promise<AliExpressImportCursor | null> {
  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("provider_import_cursors")
      .select("state")
      .eq("provider", PROVIDER)
      .eq("kind", kind)
      .maybeSingle();
    if (!data?.state) return null;
    return normalizeCursorState(data.state);
  } catch {
    // Table not applied yet / no row — caller falls back to the start cursor.
    return null;
  }
}

/** Persist the cursor for a kind (best-effort, never throws). */
export async function writeAliExpressImportCursor(
  kind: AliExpressCursorKind,
  state: AliExpressImportCursor,
): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("provider_import_cursors")
      .upsert(
        {
          provider: PROVIDER,
          kind,
          state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,kind" },
      );
  } catch {
    // Best-effort: a cursor write failure must never break the import chunk.
  }
}

function normalizeCursorState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
): AliExpressImportCursor | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "sweep") {
    const keywordIndex = Number(raw.keywordIndex);
    const page = Number(raw.page);
    if (!Number.isFinite(keywordIndex) || !Number.isFinite(page)) return null;
    return { type: "sweep", keywordIndex, page };
  }
  if (raw.type === "ids") {
    const offset = Number(raw.offset);
    if (!Number.isFinite(offset)) return null;
    return { type: "ids", offset };
  }
  return null;
}