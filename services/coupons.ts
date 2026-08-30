import { mapCoupon, mapStore } from "@/lib/database/mappers";
import type { CouponRow, StoreRow } from "@/lib/database/types";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Coupon, ServiceResult } from "@/lib/types/entities";

type CouponWithStore = CouponRow & { stores: StoreRow | null };

/**
 * Coupon integrity gate.
 *
 * Zorino only presents a coupon to users when it comes from a real, verified
 * coupon/offer source. Today NO connected integration supplies coupon/offer
 * data (Admitad/eBay/AliExpress/CJ deliver products, not coupons), so the only
 * `coupons` rows are legacy seed rows. Surfacing them would label seed data as
 * real — which is forbidden. Until a real coupon source is wired up, coupon
 * readers return empty and every coupon surface (homepage Top Coupons, featured
 * brands, /coupons) renders nothing rather than fabricated offers.
 */
function hasRealCouponSource(): boolean {
  return false;
}

export async function getTopCoupons(limit = 4): Promise<ServiceResult<Coupon[]>> {
  if (!hasRealCouponSource()) {
    return { data: [], error: null };
  }
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("coupons")
    .select("*, stores (*)")
    .eq("is_active", true)
    .eq("verified", true)
    .order("used_times", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  return {
    data: ((data ?? []) as CouponWithStore[]).map((row) => {
      const store = row.stores ? mapStore(row.stores) : undefined;
      return mapCoupon(row, store);
    }),
    error: null,
  };
}

export async function getAllCoupons(limit = 48): Promise<ServiceResult<Coupon[]>> {
  if (!hasRealCouponSource()) {
    return { data: [], error: null };
  }
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("coupons")
    .select("*, stores (*)")
    .eq("is_active", true)
    .order("used_times", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  return {
    data: ((data ?? []) as CouponWithStore[]).map((row) => {
      const store = row.stores ? mapStore(row.stores) : undefined;
      return mapCoupon(row, store);
    }),
    error: null,
  };
}

export async function getCouponsByStore(storeId: string): Promise<ServiceResult<Coupon[]>> {
  if (!hasRealCouponSource()) {
    return { data: [], error: null };
  }
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("coupons")
    .select("*, stores (*)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("discount", { ascending: false });

  if (error) return { data: [], error: error.message };

  return {
    data: ((data ?? []) as CouponWithStore[]).map((row) => {
      const store = row.stores ? mapStore(row.stores) : undefined;
      return mapCoupon(row, store);
    }),
    error: null,
  };
}
