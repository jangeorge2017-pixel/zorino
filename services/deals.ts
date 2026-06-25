import { mapDeal, mapProduct, mapStore } from "@/lib/database/mappers";
import type { DealRow, ProductRow, StoreRow } from "@/lib/database/types";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Deal, ServiceResult } from "@/lib/types/entities";

type DealWithRelations = DealRow & {
  products: ProductRow | null;
  stores: StoreRow | null;
};

function mapDealRows(rows: DealWithRelations[]): Deal[] {
  return rows.map((row) => {
    const product = row.products ? mapProduct(row.products) : undefined;
    const store = row.stores ? mapStore(row.stores) : undefined;
    return mapDeal(row, product, store);
  });
}

export async function getFeaturedDeals(limit = 4): Promise<ServiceResult<Deal[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("deals")
    .select("*, products (*), stores (*)")
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("sort_order")
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: mapDealRows((data ?? []) as DealWithRelations[]), error: null };
}

export async function getActiveDeals(limit = 24): Promise<ServiceResult<Deal[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("deals")
    .select("*, products (*), stores (*)")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: mapDealRows((data ?? []) as DealWithRelations[]), error: null };
}
