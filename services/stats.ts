import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { CatalogStats, ServiceResult } from "@/lib/types/entities";

async function countTable(
  table: string,
  filter?: { column: string; value: boolean }
): Promise<number> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return 0;

  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) {
    query = query.eq(filter.column, filter.value);
  }

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function getCatalogStats(): Promise<ServiceResult<CatalogStats>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return {
      data: { stores: 0, products: 0, coupons: 0, deals: 0, users: 0 },
      error: "Supabase not configured",
    };
  }

  const [stores, products, coupons, deals, users] = await Promise.all([
    countTable("stores", { column: "is_active", value: true }),
    countTable("products", { column: "is_active", value: true }),
    countTable("coupons", { column: "is_active", value: true }),
    countTable("deals", { column: "is_active", value: true }),
    countTable("profiles"),
  ]);

  return {
    data: { stores, products, coupons, deals, users },
    error: null,
  };
}
