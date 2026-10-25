import { mapCoupon, mapStore } from "@/lib/database/mappers";
import type { CouponRow, StoreRow } from "@/lib/database/types";
import {
  getAdmittedMerchantRegistry,
  normalizeMerchantName,
} from "@/lib/integration/admitted-network";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Coupon, ServiceResult } from "@/lib/types/entities";

type CouponWithStore = CouponRow & { stores: StoreRow };

/**
 * Admitted-network coupon filter.
 *
 * Coupons are only served when they come from the approved Admitad master and
 * resolve to one of its stores. Both the SQL join and this in-process allowlist
 * are applied, so a stale/rogue row can never leak onto a coupon surface.
 */
async function admittedCouponRows(
  rows: CouponWithStore[] | null,
): Promise<CouponWithStore[]> {
  const { names } = await getAdmittedMerchantRegistry();
  return (rows ?? []).filter(
    (row) =>
      row.stores?.admitted_network === "admitad" &&
      names.has(normalizeMerchantName(row.stores.name)),
  );
}

function toCoupons(rows: CouponWithStore[]): Coupon[] {
  return rows.map((row) => mapCoupon(row, mapStore(row.stores)));
}

export async function getTopCoupons(limit = 4): Promise<ServiceResult<Coupon[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("coupons")
    .select("*, stores!inner(*)")
    .eq("is_active", true)
    .eq("verified", true)
    .eq("source", "admitad")
    .eq("stores.admitted_network", "admitad")
    .eq("stores.is_active", true)
    .order("discount_type", { ascending: false })
    .order("discount", { ascending: false })
    .order("ends_at", { ascending: true })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  return {
    data: toCoupons(await admittedCouponRows(data as CouponWithStore[] | null)),
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
    .select("*, stores!inner(*)")
    .eq("is_active", true)
    .eq("source", "admitad")
    .eq("stores.admitted_network", "admitad")
    .eq("stores.is_active", true)
    .order("discount_type", { ascending: false })
    .order("discount", { ascending: false })
    .order("ends_at", { ascending: true })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  return {
    data: toCoupons(await admittedCouponRows(data as CouponWithStore[] | null)),
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
    .select("*, stores!inner(*)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .eq("source", "admitad")
    .eq("stores.admitted_network", "admitad")
    .eq("stores.is_active", true)
    .order("discount_type", { ascending: false })
    .order("discount", { ascending: false });

  if (error) return { data: [], error: error.message };

  return {
    data: toCoupons(await admittedCouponRows(data as CouponWithStore[] | null)),
    error: null,
  };
}

/** Real count of currently active approved-network coupons. */
export async function getActiveCouponCount(): Promise<number> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("coupons")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("source", "admitad");

  if (error) return 0;
  return count ?? 0;
}

