import { mapPrice, mapPriceHistory, mapStore } from "@/lib/database/mappers";
import type { PriceRow, StoreRow } from "@/lib/database/types";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Price, PriceHistoryPoint, ServiceResult } from "@/lib/types/entities";

type PriceWithStore = PriceRow & { stores: StoreRow | null };

export async function getCurrentPricesForProduct(
  productId: string,
  options?: { countryCode?: string; currency?: string }
): Promise<ServiceResult<Price[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  let query = supabase
    .from("prices")
    .select("*, stores (*)")
    .eq("product_id", productId)
    .eq("is_current", true)
    .order("price");

  if (options?.countryCode) {
    query = query.eq("country_code", options.countryCode);
  }
  if (options?.currency) {
    query = query.eq("currency", options.currency);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  return {
    data: ((data ?? []) as PriceWithStore[]).map((row) => {
      const store = row.stores ? mapStore(row.stores) : undefined;
      return mapPrice(row, store);
    }),
    error: null,
  };
}

/** Compare prices across stores for a product (core Compare Prices feature). */
export async function compareProductPrices(
  productId: string,
  options?: { countryCode?: string; currency?: string }
): Promise<ServiceResult<Price[]>> {
  return getCurrentPricesForProduct(productId, options);
}

export async function getPriceHistory(
  productId: string,
  options?: { storeId?: string; limit?: number }
): Promise<ServiceResult<PriceHistoryPoint[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  let query = supabase
    .from("price_history")
    .select("*")
    .eq("product_id", productId)
    .order("recorded_at", { ascending: true });

  if (options?.storeId) {
    query = query.eq("store_id", options.storeId);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  return { data: (data ?? []).map(mapPriceHistory), error: null };
}

export async function getLowestPrice(
  productId: string,
  options?: { countryCode?: string; currency?: string }
): Promise<ServiceResult<Price | null>> {
  const result = await getCurrentPricesForProduct(productId, options);
  if (result.error) return { data: null, error: result.error };
  if (result.data.length === 0) return { data: null, error: null };

  const lowest = result.data.reduce((min, p) => (p.price < min.price ? p : min));
  return { data: lowest, error: null };
}
