import { mapStore } from "@/lib/database/mappers";
import type { StoreRow } from "@/lib/database/types";
import {
  isAdmittedMerchantName,
  isBlendedStoreSlug,
} from "@/lib/integration/admitted-network";
import { PRODUCTION_PROVIDER_IDS } from "@/lib/integration/constants";
import { isProductionProviderActive } from "@/lib/integration/provider-config";
import {
  getRealMerchantStores,
  isRealDataStore,
} from "@/lib/integration/real-stores";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Store, ServiceResult } from "@/lib/types/entities";

const PROVIDER_STORE_SLUGS = new Set<string>(PRODUCTION_PROVIDER_IDS);

async function loadMerchantStores(): Promise<Store[]> {
  try {
    return await getRealMerchantStores();
  } catch {
    return [];
  }
}

function isProviderStoreSlug(slug: string): boolean {
  return PROVIDER_STORE_SLUGS.has(slug);
}

export async function getStores(options?: {
  integrationType?: StoreRow["integration_type"];
  region?: string;
  limit?: number;
}): Promise<ServiceResult<Store[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) return { data: [], error: error.message };

  const rows = ((data as StoreRow[] | null) ?? []).filter((row) => {
    const isProvider = isProviderStoreSlug(row.slug);
    const isAdmitad = row.admitted_network === "admitad" || row.slug.startsWith("admitad-");
    const allowed = isProvider || isAdmitad || isBlendedStoreSlug(row.slug);
    if (!allowed) return false;
    if (options?.integrationType && row.integration_type !== options.integrationType) {
      return false;
    }
    if (options?.region && !(row.supported_regions ?? []).includes(options.region)) {
      return false;
    }
    return true;
  });

  const stores = rows.map(mapStore);
  const region = options?.region;
  const filtered = region
    ? stores.filter(
        (store) =>
          !store.supportedRegions.length || store.supportedRegions.includes(region),
      )
    : stores;
  const result = options?.limit ? filtered.slice(0, options.limit) : filtered;
  return { data: result, error: null };
}

export async function getStoreBySlug(slug: string): Promise<ServiceResult<Store | null>> {
  const supabase = createSupabaseAnonClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    const row = data as StoreRow | null;
    if (row) {
      if (isBlendedStoreSlug(row.slug) || isProviderStoreSlug(row.slug)) {
        return { data: mapStore(row), error: null };
      }
      if (row.admitted_network === "admitad" || row.slug.startsWith("admitad-")) {
        if (await isRealDataStore(row)) {
          return { data: mapStore(row), error: null };
        }
      } else if (await isRealDataStore(row)) {
        return { data: mapStore(row), error: null };
      }
    }
  }

  if (slug.startsWith("admitad-")) {
    const merchants = await loadMerchantStores();
    const found = merchants.find((m) => m.slug === slug) ?? null;
    if (!found) return { data: null, error: "Store not found" };
    const admitted = await isAdmittedMerchantName(found.name);
    return {
      data: admitted ? found : null,
      error: admitted ? null : "Store not found",
    };
  }

  if (PROVIDER_STORE_SLUGS.has(slug)) {
    return { data: null, error: "Store not found" };
  }

  return { data: null, error: "Store not found" };
}

export async function getStoreById(id: string): Promise<ServiceResult<Store | null>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data ? mapStore(data) : null, error: null };
}