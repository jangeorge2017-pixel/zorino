import { mapStore } from "@/lib/database/mappers";
import type { StoreRow } from "@/lib/database/types";
import { isRealDataStore } from "@/lib/integration/real-stores";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Store, ServiceResult } from "@/lib/types/entities";

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
  const rows = ((data as StoreRow[] | null) ?? []).filter((row) => {
    if (!isRealDataStore(row)) return false;
    if (options?.integrationType && row.integration_type !== options.integrationType) {
      return false;
    }
    if (options?.region && !(row.supported_regions ?? []).includes(options.region)) {
      return false;
    }
    return true;
  });

  const limited = options?.limit ? rows.slice(0, options.limit) : rows;
  return { data: limited.map(mapStore), error: null };
}

export async function getStoreBySlug(slug: string): Promise<ServiceResult<Store | null>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data ? mapStore(data) : null, error: null };
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
