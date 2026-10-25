import { mapStore } from "@/lib/database/mappers";
import type { StoreRow } from "@/lib/database/types";
import {
  isAdmittedMerchantName,
  isBlendedStoreSlug,
} from "@/lib/integration/admitted-network";
import {
  getRealMerchantStores,
  isRealDataStore,
} from "@/lib/integration/real-stores";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Store, ServiceResult } from "@/lib/types/entities";

async function loadMerchantStores(): Promise<Store[]> {
  try {
    return await getRealMerchantStores();
  } catch {
    return [];
  }
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

  // The directory blends the approved Admitad network with the live
  // Amazon/eBay/AliExpress storefronts. Legacy seed/stub rows are never
  // advertised here.
  const rows = ((data as StoreRow[] | null) ?? []).filter((row) => {
    if (row.admitted_network !== "admitad" && !isBlendedStoreSlug(row.slug)) {
      return false;
    }
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
    // Approved Admitad merchants resolve, plus the blended Amazon/eBay/
    // AliExpress storefronts. Legacy seed/stub stores (walmart, temu, noon,
    // best-buy, jumia, nike, …) must never render a store page.
    const row = data as StoreRow | null;
    if (row && isBlendedStoreSlug(row.slug)) {
      return { data: mapStore(row), error: null };
    }
    if (
      row &&
      row.admitted_network === "admitad" &&
      (await isRealDataStore(row))
    ) {
      return { data: mapStore(row), error: null };
    }
  }

  // Merchant rows (slug "admitad-<merchant>") are derived on the fly from the
  // live DB catalog + Admitad program metadata rather than persisted rows, so
  // look them up here so the store page resolves instead of 404-ing.
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
