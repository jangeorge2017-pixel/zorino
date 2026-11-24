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
    .select("id, product_id, store_id, price, original_price, currency, country_code, external_url, external_product_id, in_stock, is_current, recorded_at, created_at, stores (id, name, name_ar, slug, logo_url, logo_initial, website, integration_type, affiliate_program, commission_rate, supported_regions, supported_currencies, external_store_id, is_active)")
    .eq("product_id", productId)
    .eq("is_current", true)
    .order("price")
    .limit(100);

  if (options?.countryCode) {
    query = query.eq("country_code", options.countryCode);
  }
  if (options?.currency) {
    query = query.eq("currency", options.currency);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  const rows = ((data ?? []) as PriceWithStore[]).map((row) => {
    const store = row.stores ? mapStore(row.stores) : undefined;
    return mapPrice(row, store);
  });

  // Cross-border fallback: a regional/currency scope that matches NO local
  // rows must not hide the product's real source offers. Offer rows live in
  // the store's own market (AliExpress/Admitad/eBay rows are USD/US), so a
  // caller scoping by the VISITOR's country/currency (e.g. a GB session reading
  // US-catalog offers) would otherwise empty the offer list. When the scoped
  // query returns nothing, retry unscoped so cross-border listings still
  // render in the same comparison. Display conversion is the render layer's
  // job (fromCurrency), never a silent drop here.
  if (rows.length === 0 && (options?.countryCode !== undefined || options?.currency !== undefined)) {
    const fallback = await supabase
      .from("prices")
      .select("id, product_id, store_id, price, original_price, currency, country_code, external_url, external_product_id, in_stock, is_current, recorded_at, created_at, stores (id, name, name_ar, slug, logo_url, logo_initial, website, integration_type, affiliate_program, commission_rate, supported_regions, supported_currencies, external_store_id, is_active)")
      .eq("product_id", productId)
      .eq("is_current", true)
      .order("price")
      .limit(100);
    const { data: fallbackData, error: fallbackError } = await fallback;
    if (!fallbackError && fallbackData && (fallbackData as PriceWithStore[]).length > 0) {
      return {
        data: (fallbackData as PriceWithStore[]).map((row) => {
          const store = row.stores ? mapStore(row.stores) : undefined;
          return mapPrice(row, store);
        }),
        error: null,
      };
    }
  }

  return { data: rows, error: null };
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
    .select("id, product_id, store_id, price, currency, recorded_at")
    .eq("product_id", productId)
    .order("recorded_at", { ascending: true });

  if (options?.storeId) {
    query = query.eq("store_id", options.storeId);
  }
  query = query.limit(Math.min(options?.limit ?? 100, 100));

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
