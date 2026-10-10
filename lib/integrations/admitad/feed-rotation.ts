/**
 * Admitad multi-merchant feed rotation.
 *
 * The daily ingestion cron used to fetch the same first N discovered merchant
 * feeds on every run (`candidateFeeds.slice(0, maxFeeds)`), so merchants beyond
 * that window were never ingested and the canonical catalog stopped growing.
 *
 * This module supplies a persisted rotation offset (table
 * `admitad_feed_cursor`, migration 028) so successive runs start at a different
 * feed and sweep the WHOLE discovered catalog over time. When the table is
 * absent the offset falls back to a deterministic day-of-year seed, so rotation
 * still happens with zero schema dependency.
 *
 * Pure + total: the DB read/write is best-effort and never throws into the
 * ingestion run.
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";

/** Deterministic date-based seed (day-of-year) used when no persisted cursor exists. */
export function dayOfYearSeed(date: Date = new Date()): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((today - startOfYear) / 86_400_000);
}

/**
 * Pure rotation: return `count` items starting at `offset`, wrapping around the
 * list. A `count` >= list length returns the whole list rotated. An empty list
 * or non-positive count returns [].
 */
export function rotateFeeds<T>(feeds: readonly T[], offset: number, count: number): T[] {
  const n = feeds.length;
  if (n === 0 || count <= 0) return [];
  const start = ((Math.trunc(offset) % n) + n) % n;
  const take = Math.min(count, n);
  const out: T[] = new Array(take);
  for (let i = 0; i < take; i++) out[i] = feeds[(start + i) % n];
  return out;
}

/** Read the persisted rotation offset; falls back to the day-of-year seed. */
export async function readAdmitadFeedCursor(): Promise<number> {
  try {
    const supabase = createSupabaseServiceClient();
    if (supabase) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("admitad_feed_cursor")
        .select("offset")
        .maybeSingle();
      if (data && Number.isFinite(data.offset)) return Number(data.offset);
    }
  } catch {
    // Table not applied yet — fall through to the deterministic seed.
  }
  return dayOfYearSeed();
}

/** Advance the persisted cursor by `delta` feeds (best-effort, never throws). */
export async function advanceAdmitadFeedCursor(delta: number): Promise<void> {
  if (!Number.isFinite(delta) || delta <= 0) return;
  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return;
    const current = await readAdmitadFeedCursor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("admitad_feed_cursor")
      .upsert(
        { singleton: true, offset: current + delta, updated_at: new Date().toISOString() },
        { onConflict: "singleton" },
      );
  } catch {
    // Best-effort: a write failure must never break ingestion.
  }
}
