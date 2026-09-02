import { mapStore } from "@/lib/database/mappers";
import type { StoreRow } from "@/lib/database/types";
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

  // Directory shows only stores that actually have (or produce) real product
  // data. Seed/static/stub rows (walmart, temu, noon, best-buy, jumia, nike,
  // foot-locker, …) and credential-less Amazon rows are never advertised.
  const allRows = (data as StoreRow[] | null) ?? [];
  const realFlags = await Promise.all(allRows.map((row) => isRealDataStore(row)));
  const rows = allRows.filter((row, index) => {
    if (!realFlags[index]) return false;
    if (options?.integrationType && row.integration_type !== options.integrationType) {
      return false;
    }
    if (options?.region && !(row.supported_regions ?? []).includes(options.region)) {
      return false;
    }
    return true;
  });

  // Append the real Admitad merchants derived from the live DB catalog so the
  // directory lists every real merchant that has products. Only merchants with
  // a real program record (site URL) are included — nothing is fabricated.
  const merchantStores = await loadMerchantStores();
  const it = options?.integrationType;
  const combined: Store[] = [
    ...rows.map(mapStore),
    ...merchantStores.filter((m) => !it || m.integrationType === it),
  ];
  const region = options?.region;
  const filtered = region
    ? combined.filter(
        (s) => !s.supportedRegions.length || s.supportedRegions.includes(region),
      )
    : combined;
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
    // A store page is only real if it maps to a real data-backed merchant.
    // Stub/seed rows (walmart, temu, noon, best-buy, jumia, nike, foot-locker)
    // and credential-less Amazon rows must not resolve to a store page.
    if (data && (await isRealDataStore(data))) {
      return { data: mapStore(data), error: null };
    }
  }

  // Merchant rows (slug "admitad-<merchant>") are derived on the fly from the
  // live DB catalog + Admitad program metadata rather than persisted rows, so
  // look them up here so the store page resolves instead of 404-ing.
  if (slug.startsWith("admitad-")) {
    const merchants = await loadMerchantStores();
    const found = merchants.find((m) => m.slug === slug) ?? null;
    return { data: found, error: null };
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
