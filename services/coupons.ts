import { mapCoupon, mapStore } from "@/lib/database/mappers";
import type { CouponRow, StoreRow } from "@/lib/database/types";
import {
  BLENDED_STORE_SLUGS,
  getAdmittedMerchantRegistry,
  isBlendedStoreSlug,
  normalizeMerchantName,
} from "@/lib/integration/admitted-network";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Coupon, ServiceResult } from "@/lib/types/entities";

type CouponWithStore = CouponRow & { stores: StoreRow };

/**
 * Coupon store allowlist: the approved Admitad master plus the blended
 * Amazon/eBay/AliExpress storefronts. Both the SQL join and this in-process
 * allowlist are applied, so a stale/rogue row can never leak onto a coupon
 * surface.
 */
async function allowedCouponStoreSlugs(): Promise<string[]> {
  const { programs } = await getAdmittedMerchantRegistry();
  const slugs = new Set(programs.map((program) => program.slug));
  for (const slug of BLENDED_STORE_SLUGS) slugs.add(slug);
  return [...slugs];
}

async function allowedCouponRows(
  rows: CouponWithStore[] | null,
): Promise<CouponWithStore[]> {
  const { names } = await getAdmittedMerchantRegistry();
  return (rows ?? []).filter((row) => {
    if (isBlendedStoreSlug(row.stores?.slug)) return true;
    return (
      row.stores?.admitted_network === "admitad" &&
      names.has(normalizeMerchantName(row.stores.name))
    );
  });
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
    .in("stores.slug", await allowedCouponStoreSlugs())
    .eq("stores.is_active", true)
    .order("discount_type", { ascending: false })
    .order("discount", { ascending: false })
    .order("ends_at", { ascending: true })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  return {
    data: toCoupons(await allowedCouponRows(data as CouponWithStore[] | null)),
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
    .in("stores.slug", await allowedCouponStoreSlugs())
    .eq("stores.is_active", true)
    .order("discount_type", { ascending: false })
    .order("discount", { ascending: false })
    .order("ends_at", { ascending: true })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  return {
    data: toCoupons(await allowedCouponRows(data as CouponWithStore[] | null)),
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
    .in("stores.slug", await allowedCouponStoreSlugs())
    .eq("stores.is_active", true)
    .order("discount_type", { ascending: false })
    .order("discount", { ascending: false });

  if (error) return { data: [], error: error.message };

  return {
    data: toCoupons(await allowedCouponRows(data as CouponWithStore[] | null)),
    error: null,
  };
}

/** Real count of currently active blended-network coupons. */
export async function getActiveCouponCount(): Promise<number> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("coupons")
    .select("id, stores!inner(slug)", { count: "exact", head: true })
    .eq("is_active", true)
    .in("stores.slug", await allowedCouponStoreSlugs());

  if (error) return 0;
  return count ?? 0;
}
