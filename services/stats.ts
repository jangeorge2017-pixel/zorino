import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { CatalogStats, ServiceResult } from "@/lib/types/entities";
import { isRealDataStore } from "@/lib/integration/real-stores";

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

/** Products that are real-data-backed: rows in the canonical cache produced by
 *  an active real provider (admitad/aliexpress/ebay/cjdropshipping). Not every
 *  `products` row is real-data-backed, so an exact total is not used here. */
async function countRealProducts(
  supabase: NonNullable<ReturnType<typeof createSupabaseAnonClient>>
): Promise<number> {
  const { count, error } = await supabase
    .from("lowest_prices_today")
    .select("*", { count: "exact", head: true })
    .eq("country_code", "US")
    .eq("currency", "USD")
    .in("provider", ["admitad", "aliexpress", "ebay", "cjdropshipping"]);

  if (error) return 0;
  return count ?? 0;
}

/** Stores that are real, data-backed merchants (not seed/stub/placeholder). */
async function countRealStores(
  supabase: NonNullable<ReturnType<typeof createSupabaseAnonClient>>
): Promise<number> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true);
  if (error) return 0;
  let count = ((data ?? []) as { integration_type: string; slug: string }[])
    .filter((row) => isRealDataStore(row as Parameters<typeof isRealDataStore>[0]))
    .length;
  try {
    const { getRealMerchantStores } = await import("@/lib/integration/real-stores");
    const merchants = await getRealMerchantStores();
    count += merchants.length;
  } catch {
    // merchant enumeration failed — keep the filtered store count
  }
  return count;
}

export async function getCatalogStats(): Promise<ServiceResult<CatalogStats>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return {
      data: { stores: 0, products: 0, coupons: 0, deals: 0, users: 0 },
      error: "Supabase not configured",
    };
  }

  const [products, deals, users] = await Promise.all([
    countRealProducts(supabase),
    countTable("deals", { column: "is_active", value: true }),
    countTable("profiles"),
  ]);

  return {
    // Coupons: no real coupon/offer source is connected, so the real count is 0
    // (mirrors the hasRealCouponSource() gate in services/coupons.ts). Stores:
    // real data-backed merchants only.
    data: {
      stores: await countRealStores(supabase),
      products,
      coupons: 0,
      deals,
      users,
    },
    error: null,
  };
}
