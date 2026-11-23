import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase/config";

const FALLBACK_VERSION = "v3";
const FALLBACK_CATALOG_FINGERPRINT = "catalog:0:none:none";
const CHECK_INTERVAL_MS = 60_000;

type CacheIdentity = {
  version: string;
  catalogFingerprint: string;
};

let currentVersion = FALLBACK_VERSION;
let currentCatalogFingerprint = FALLBACK_CATALOG_FINGERPRINT;
let lastCheckedAt = 0;
let pendingRefresh: Promise<void> | null = null;

async function readIdentity(): Promise<CacheIdentity> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return {
      version: FALLBACK_VERSION,
      catalogFingerprint: FALLBACK_CATALOG_FINGERPRINT,
    };
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [setting, catalogCount, productLatest, lowestLatest] = await Promise.all([
    db
      .from("integration_settings")
      .select("value")
      .eq("key", "search_cache_version")
      .maybeSingle(),
    db
      .from("catalog_count")
      .select("products")
      .eq("singleton", true)
      .maybeSingle(),
    db
      .from("products")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1),
    db
      .from("lowest_prices_today")
      .select("computed_at")
      .order("computed_at", { ascending: false })
      .limit(1),
  ]);

  const configuredVersion = setting.error || !setting.data?.value
    ? FALLBACK_VERSION
    : String(setting.data.value).trim() || FALLBACK_VERSION;
  const products = Number(catalogCount.data?.products ?? 0);
  const productUpdatedAt = String(productLatest.data?.[0]?.updated_at ?? "none");
  const lowestComputedAt = String(lowestLatest.data?.[0]?.computed_at ?? "none");

  return {
    version: configuredVersion,
    catalogFingerprint: `catalog:${
      Number.isFinite(products) && products > 0 ? products : 0
    }:${productUpdatedAt}:${lowestComputedAt}`,
  };
}

async function refreshVersion(): Promise<void> {
  try {
    const identity = await readIdentity();
    currentVersion = identity.version;
    currentCatalogFingerprint = identity.catalogFingerprint;
  } catch {
    currentVersion = FALLBACK_VERSION;
    currentCatalogFingerprint = FALLBACK_CATALOG_FINGERPRINT;
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
  return `${currentVersion}|${currentCatalogFingerprint}`;
}
