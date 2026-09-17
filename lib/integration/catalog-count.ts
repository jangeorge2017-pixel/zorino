/**
 * Maintained catalog count behind the homepage hero "Products" stat.
 *
 * The authoritative source is an exact COUNT over the 120K-row
 * `lowest_prices_today` table — expensive (~23s) and intermittently erroring
 * from PostgREST. To keep renders fast and deterministic, the count is
 * maintained in the one-row `catalog_count` table:
 *
 *  - written by the bundled cron refresh when the row is stale (off-path), and
 *    opportunistically by the render path after a successful live count;
 *  - read by the homepage in a single-row query (single-digit milliseconds).
 *
 * Every read/write degrades gracefully: if the `catalog_count` table does not
 * exist yet (migration not applied), the read returns 0 and the caller falls
 * through to its existing fallback chain.
 */

import {
  createSupabaseAnonClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";

/** A row is "fresh" (used as the fast path) for this long after its last write. */
export const CATALOG_COUNT_FRESHNESS_MS = 12 * 60 * 60 * 1000;

/**
 * Test-only seams so regression tests can exercise the fast path and the
 * stale/absent branches without a live Supabase connection.
 */
let readerForTests: (() => Promise<number>) | null = null;
let ageReaderForTests: (() => Promise<number>) | null = null;
let writerForTests: ((count: number) => Promise<void>) | null = null;

export function setCatalogCountPersistenceForTests(source: {
  reader?: (() => Promise<number>) | null;
  ageReader?: (() => Promise<number>) | null;
  writer?: ((count: number) => Promise<void>) | null;
} | null): void {
  readerForTests = source?.reader ?? null;
  ageReaderForTests = source?.ageReader ?? null;
  writerForTests = source?.writer ?? null;
}

export function resetCatalogCountForTests(): void {
  readerForTests = null;
  ageReaderForTests = null;
  writerForTests = null;
}

/** Read the maintained count; 0 when the table is missing/unreadable. */
export async function getCatalogCount(): Promise<number> {
  if (readerForTests) {
    try {
      return await readerForTests();
    } catch {
      return 0;
    }
  }

  if (process.env.NODE_ENV === "test") return 0;

  try {
    const supabase = createSupabaseAnonClient();
    if (!supabase) return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("catalog_count")
      .select("products")
      .eq("singleton", true)
      .maybeSingle();
    const row = data as { products?: number } | null;
    const count = Number(row?.products ?? 0);
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

/**
 * Age of the maintained row in ms since its last write, or a very large value
 * when absent/unreadable so stale rows are always recomputed.
 */
export async function getCatalogCountAgeMs(): Promise<number> {
  if (ageReaderForTests) {
    try {
      return await ageReaderForTests();
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  if (process.env.NODE_ENV === "test") return Number.POSITIVE_INFINITY;

  try {
    const supabase = createSupabaseAnonClient();
    if (!supabase) return Number.POSITIVE_INFINITY;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("catalog_count")
      .select("updated_at")
      .eq("singleton", true)
      .maybeSingle();
    const row = data as { updated_at?: string } | null;
    if (!row?.updated_at) return Number.POSITIVE_INFINITY;
    return Date.now() - new Date(row.updated_at).getTime();
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Write the maintained count (service_role upsert). Best-effort: never throws
 * into the caller — a failed write just leaves the previous row in place.
 */
export async function setCatalogCount(count: number): Promise<void> {
  if (!(count > 0)) return;

  if (writerForTests) {
    try {
      await writerForTests(count);
    } catch {
      // best-effort
    }
    return;
  }

  if (process.env.NODE_ENV === "test") return;

  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("catalog_count").upsert(
      {
        singleton: true,
        products: count,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "singleton" },
    );
  } catch {
    // best-effort — never break the stat on a persistence failure
  }
}