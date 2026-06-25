import { mapCoupon, mapStore } from "@/lib/database/mappers";
import type { CouponRow, StoreRow } from "@/lib/database/types";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Coupon, ServiceResult } from "@/lib/types/entities";

type CouponWithStore = CouponRow & { stores: StoreRow | null };

export async function getTopCoupons(limit = 4): Promise<ServiceResult<Coupon[]>> {
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
