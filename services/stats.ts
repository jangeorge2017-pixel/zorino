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

/** Real cached products: rows in the canonical cache. Read straight from
 *  Supabase and deliberately NOT filtered by the provider active-state gates —
 *  every row was written by a real provider sync, so the count stays correct
 *  on a deployment that has no affiliate credentials configured yet. */
async function countRealProducts(
  supabase: NonNullable<ReturnType<typeof createSupabaseAnonClient>>
): Promise<number> {
  const { count, error } = await supabase
    .from("lowest_prices_today")
    .select("*", { count: "exact", head: true })
    .eq("country_code", "US")
    .eq("currency", "USD");

  if (error) return 0;
  return count ?? 0;
}

/** Stores that actually carry cached products: distinct merchants present in
 *  the catalog. Derived from the database rather than from the configured-
 *  provider list, so it is non-zero without any affiliate credentials. */
async function countRealStores(): Promise<number> {
  try {
    const { getRealMerchantNames } = await import(
      "@/lib/integration/database-catalog"
    );
    const merchantNames = await getRealMerchantNames();
    if (merchantNames.length > 0) return merchantNames.length;
  } catch {
    // catalog enumeration failed — fall through to the configured-provider count
  }

  try {
    const { getConfiguredProductionProviders } = await import(
      "@/lib/integration/provider-config"
    );
    return getConfiguredProductionProviders().length;
  } catch {
    return 0;
  }
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
      stores: await countRealStores(),
      products,
      coupons: 0,
      deals,
      users,
    },
    error: null,
  };
}
