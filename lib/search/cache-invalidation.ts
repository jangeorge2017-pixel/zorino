import { createClient } from "@supabase/supabase-js";
import { refreshSearchCacheVersion } from "@/lib/search/cache-version";

const CACHE_VERSION_KEY = "search_cache_version";

export type SearchCacheInvalidationResult = {
  ok: boolean;
  version: string | null;
  deletedRows: number;
  error: string | null;
};

function failure(error: string): SearchCacheInvalidationResult {
  return { ok: false, version: null, deletedRows: 0, error };
}

export async function invalidateSearchCachesAfterSync(
  reason = "sync",
): Promise<SearchCacheInvalidationResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return failure(`search cache invalidation skipped (${reason}): Supabase credentials unavailable`);
  }

  const version = `v3-${Date.now()}`;
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { error: settingError } = await db.from("integration_settings").upsert(
      {
        key: CACHE_VERSION_KEY,
        value: version,
        provider: "search",
        label: "Search cache epoch",
        is_secret: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (settingError) {
      return failure(`search cache version write failed (${reason}): ${settingError.message}`);
    }

    let deletedRows = 0;
    let deleteError: string | null = null;
    try {
      const { data, error } = await db
        .from("search_result_cache")
        .delete()
        .not("cache_key", "is", null)
        .select("cache_key");
      if (error) {
        deleteError = error.message;
      } else {
        deletedRows = data?.length ?? 0;
      }
    } catch (error) {
      deleteError = error instanceof Error ? error.message : String(error);
    }

    await refreshSearchCacheVersion();

    return {
      ok: !deleteError,
      version,
      deletedRows,
      error: deleteError ? `search cache row delete failed (${reason}): ${deleteError}` : null,
    };
  } catch (error) {
    return failure(
      `search cache invalidation failed (${reason}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
