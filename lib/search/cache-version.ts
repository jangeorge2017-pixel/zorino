import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase/config";

const FALLBACK_VERSION = "v3";
const CHECK_INTERVAL_MS = 60_000;

let currentVersion = FALLBACK_VERSION;
let lastCheckedAt = 0;
let pendingRefresh: Promise<void> | null = null;

async function readVersion(): Promise<string> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return FALLBACK_VERSION;

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from("integration_settings")
    .select("value")
    .eq("key", "search_cache_version")
    .maybeSingle();

  if (error || !data?.value) return FALLBACK_VERSION;
  const value = String(data.value).trim();
  return value || FALLBACK_VERSION;
}

async function refreshVersion(): Promise<void> {
  try {
    currentVersion = await readVersion();
  } catch {
    currentVersion = FALLBACK_VERSION;
  }
  lastCheckedAt = Date.now();
}

await refreshVersion();

export function getSearchCacheVersion(): string {
  if (!pendingRefresh && Date.now() - lastCheckedAt > CHECK_INTERVAL_MS) {
    pendingRefresh = refreshVersion().finally(() => {
      pendingRefresh = null;
    });
  }
  return currentVersion;
}
