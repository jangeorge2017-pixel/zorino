import type { SearchResultItem } from "@/lib/data/homepage";
import type { Json } from "@/lib/database/types";
import type { CurrencyCode } from "@/lib/international/config";
import { resolveProviderId } from "@/lib/providers/registry";
import type { SearchSortMode } from "@/lib/search/types";
import { supabaseUrl } from "@/lib/supabase/config";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/** How long a cached search pool stays "fresh" before a background refresh. */
export const PERSISTENT_SEARCH_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * A pool missing one of these was built while that provider was unreachable
 * (blocked storefront / API timeout), not because it had no matching items.
 * Such entries get a short grace TTL so a 6-hour cache can never hide the
 * provider after a transient low-RAM timeout.
 */
export const CRITICAL_SEARCH_PROVIDER_IDS = [
  "amazon-eg",
  "aliexpress",
  "jumia",
] as const;

/** Grace window before an incomplete pool is bypassed and rebuilt live. */
export const PERSISTENT_SEARCH_INCOMPLETE_TTL_MS = 10 * 60 * 1000;

/** Max products returned from the persistent cache (and stored per query). */
export const PERSISTENT_SEARCH_MAX_ITEMS = 60;

/** Critical providers absent from a cached pool (empty when complete). */
export function getMissingCriticalSearchProviders(
  items: readonly SearchResultItem[],
): string[] {
  const present = new Set<string>();
  for (const item of items) {
    const raw = item.storeSlug || item.store;
    if (!raw) continue;
    present.add(resolveProviderId(raw));
  }
  return CRITICAL_SEARCH_PROVIDER_IDS.filter((id) => !present.has(id));
}

const READ_TIMEOUT_MS = 900;

export type PersistentSearchOptions = {
  sortBy?: SearchSortMode;
  activeCurrency?: CurrencyCode;
  useFuzzyMatch?: boolean;
};

export type PersistentSearchEntry = {
  items: SearchResultItem[];
  fetchedAt: string;
};

/** True only when the server can actually read/write the cache table. */
export function isPersistentSearchCacheEnabled(): boolean {
  return Boolean(supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Stable cache identity: normalized query + the options that shape the pool. */
export function buildPersistentSearchKey(
  query: string,
  options: PersistentSearchOptions = {},
): string {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  const currency = options.activeCurrency ?? "USD";
  const sort = options.sortBy ?? "relevance";
  const fuzzy = options.useFuzzyMatch === true ? "1" : "0";
  return `${normalized}|sort:${sort}|cur:${currency}|fuzzy:${fuzzy}`;
}

export function isPersistentSearchEntryStale(fetchedAt: string): boolean {
  const parsed = Date.parse(fetchedAt);
  if (!Number.isFinite(parsed)) return true;
  return Date.now() - parsed > PERSISTENT_SEARCH_TTL_MS;
}

function withTimeout<T>(promise: PromiseLike<T>, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), READ_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export async function readPersistentSearchCache(
  key: string,
): Promise<PersistentSearchEntry | null> {
  if (!isPersistentSearchCacheEnabled()) return null;
  const client = createSupabaseServiceClient();
  if (!client) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = client as any;
  const read = sb
    .from("search_result_cache")
    .select("items, fetched_at")
    .eq("cache_key", key)
    .maybeSingle();

  const result = await withTimeout<{
    data: { items: Json | null; fetched_at: string } | null;
    error: unknown;
  }>(read, { data: null, error: null });
  if (result.error || !result.data) return null;

  const items = Array.isArray(result.data.items)
    ? (result.data.items as unknown as SearchResultItem[])
    : [];
  if (items.length === 0) return null;

  return {
    items,
    fetchedAt: result.data.fetched_at,
  };
}

function countProviders(items: readonly SearchResultItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = item.storeSlug || item.store;
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function writePersistentSearchCache(
  key: string,
  query: string,
  items: readonly SearchResultItem[],
  options: PersistentSearchOptions = {},
): Promise<void> {
  if (items.length === 0 || !isPersistentSearchCacheEnabled()) return;
  // A pool with NONE of the critical providers is a failed fan-out, not real
  // "no inventory" — never persist it (an all-empty pool is already blocked).
  if (
    getMissingCriticalSearchProviders(items).length ===
    CRITICAL_SEARCH_PROVIDER_IDS.length
  ) {
    return;
  }
  const client = createSupabaseServiceClient();
  if (!client) return;

  const trimmed = items.slice(0, PERSISTENT_SEARCH_MAX_ITEMS);
  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = client as any;
  const write = sb.from("search_result_cache").upsert(
    {
      cache_key: key,
      query: query.trim(),
      locale: null,
      currency: options.activeCurrency ?? "USD",
      sort_mode: options.sortBy ?? "relevance",
      items: trimmed as unknown as Json,
      item_count: trimmed.length,
      provider_counts: countProviders(trimmed) as unknown as Json,
      fetched_at: now,
      updated_at: now,
    },
    { onConflict: "cache_key" },
  );

  await withTimeout<{ error: unknown }>(write, { error: null });
}
