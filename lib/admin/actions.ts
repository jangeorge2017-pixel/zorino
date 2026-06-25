"use server";

import { redirect } from "next/navigation";
import { revalidateCatalog, revalidateLowestPrices, revalidateTrending } from "@/lib/revalidate";
import { deleteRows, insertRow, updateRow } from "@/lib/database/writes";
import { getAdminSupabaseClient, getAdminUser } from "@/lib/admin/auth";
import { slugify } from "@/lib/admin/slug";
import { mapCoupon, mapDeal, mapProduct, mapStore } from "@/lib/database/mappers";
import type { CouponRow, DealRow, ProductRow, StoreRow } from "@/lib/database/types";

function revalidateAdmin() {
  revalidateCatalog();
}

async function assertAdmin() {
  const user = await getAdminUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function verifyAdminSession() {
  const user = await getAdminUser();
  return { isAdmin: !!user, email: user?.email ?? null, name: user?.name ?? null };
}

export async function adminSignOut() {
  const supabase = await getAdminSupabaseClient();
  await supabase.auth.signOut();
  revalidateAdmin();
  redirect("/admin/login");
}

export async function uploadCatalogImage(formData: FormData) {
  await assertAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { url: null, error: "No file provided" };
  }

  const supabase = await getAdminSupabaseClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from("catalog-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from("catalog-images").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// ─── Products ───
export async function adminListProducts() {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const { data, error } = await supabase.from("products").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapProduct);
}

export async function adminSaveProduct(input: {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  imageUrl: string;
  emoji?: string;
  categorySlug?: string;
  brand?: string;
  rating?: number;
  reviewCount?: number;
  currency?: string;
  inStock?: boolean;
  isActive?: boolean;
}) {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const slug = input.slug?.trim() || slugify(input.name);

  const payload = {
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || null,
    image_url: input.imageUrl.trim(),
    emoji: input.emoji?.trim() || null,
    category_slug: input.categorySlug || null,
    brand: input.brand?.trim() || null,
    rating: input.rating ?? null,
    review_count: input.reviewCount ?? 0,
    currency: input.currency ?? "USD",
    in_stock: input.inStock ?? true,
    is_active: input.isActive ?? true,
  };

  if (input.id) {
    const { data, error } = await updateRow(supabase, "products", payload, { id: input.id });
    if (error) return { data: null, error: error.message };
    revalidateAdmin();
    return { data: data ? mapProduct(data as ProductRow) : null, error: null };
  }

  const { data, error } = await insertRow(supabase, "products", payload);
  if (error) return { data: null, error: error.message };
  revalidateAdmin();
  return { data: data ? mapProduct(data) : null, error: null };
}

export async function adminDeleteProduct(id: string) {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const { error } = await deleteRows(supabase, "products", { id });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  return { ok: true, error: null };
}

// ─── Stores ───
export async function adminListStores() {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const { data, error } = await supabase.from("stores").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapStore);
}

export async function adminSaveStore(input: {
  id?: string;
  name: string;
  slug?: string;
  logoUrl?: string;
  logoInitial?: string;
  website: string;
  integrationType?: StoreRow["integration_type"];
  isActive?: boolean;
}) {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const slug = input.slug?.trim() || slugify(input.name);

  const payload = {
    name: input.name.trim(),
    slug,
    logo_url: input.logoUrl?.trim() || null,
    logo_initial: input.logoInitial?.trim() || input.name.slice(0, 2),
    website: input.website.trim(),
    integration_type: input.integrationType ?? "custom",
    is_active: input.isActive ?? true,
  };

  if (input.id) {
    const { data, error } = await updateRow(supabase, "stores", payload, { id: input.id });
    if (error) return { data: null, error: error.message };
    revalidateAdmin();
    return { data: data ? mapStore(data as StoreRow) : null, error: null };
  }

  const { data, error } = await insertRow(supabase, "stores", payload);
  if (error) return { data: null, error: error.message };
  revalidateAdmin();
  return { data: data ? mapStore(data) : null, error: null };
}

export async function adminDeleteStore(id: string) {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const { error } = await deleteRows(supabase, "stores", { id });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  return { ok: true, error: null };
}

// ─── Coupons ───
export async function adminListCoupons() {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("coupons")
    .select("*, stores (*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as (CouponRow & { stores: StoreRow | null })[]).map((row) => {
    const store = row.stores ? mapStore(row.stores) : undefined;
    return mapCoupon(row, store);
  });
}

export async function adminSaveCoupon(input: {
  id?: string;
  storeId: string;
  code: string;
  title: string;
  offer: string;
  minSpend?: string;
  discount: number;
  discountType?: "percentage" | "fixed";
  usedTimes?: number;
  verified?: boolean;
  isActive?: boolean;
}) {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();

  const payload = {
    store_id: input.storeId,
    code: input.code.trim().toUpperCase(),
    title: input.title.trim(),
    offer: input.offer.trim(),
    min_spend: input.minSpend?.trim() || null,
    discount: input.discount,
    discount_type: input.discountType ?? "percentage",
    used_times: input.usedTimes ?? 0,
    verified: input.verified ?? true,
    is_active: input.isActive ?? true,
  };

  if (input.id) {
    const { data, error } = await updateRow(supabase, "coupons", payload, { id: input.id });
    if (error) return { data: null, error: error.message };
    revalidateAdmin();
    return { data: data ? mapCoupon(data as CouponRow) : null, error: null };
  }

  const { data, error } = await insertRow(supabase, "coupons", payload);
  if (error) return { data: null, error: error.message };
  revalidateAdmin();
  return { data: data ? mapCoupon(data) : null, error: null };
}

export async function adminDeleteCoupon(id: string) {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const { error } = await deleteRows(supabase, "coupons", { id });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  return { ok: true, error: null };
}

// ─── Deals ───
export async function adminListDeals() {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*, products (*), stores (*)")
    .order("sort_order");
  if (error) throw new Error(error.message);

  return ((data ?? []) as (DealRow & { products: ProductRow | null; stores: StoreRow | null })[]).map(
    (row) => {
      const product = row.products ? mapProduct(row.products) : undefined;
      const store = row.stores ? mapStore(row.stores) : undefined;
      return mapDeal(row, product, store);
    }
  );
}

export async function adminSaveDeal(input: {
  id?: string;
  productId?: string;
  storeId?: string;
  title: string;
  discount: number;
  price: number;
  originalPrice: number;
  isFeatured?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}) {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();

  const payload = {
    product_id: input.productId || null,
    store_id: input.storeId || null,
    title: input.title.trim(),
    discount: input.discount,
    price: input.price,
    original_price: input.originalPrice,
    is_featured: input.isFeatured ?? false,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  };

  if (input.id) {
    const { data, error } = await updateRow(supabase, "deals", payload, { id: input.id });
    if (error) return { data: null, error: error.message };
    revalidateAdmin();
    return { data: data ? mapDeal(data as DealRow) : null, error: null };
  }

  const { data, error } = await insertRow(supabase, "deals", payload);
  if (error) return { data: null, error: error.message };
  revalidateAdmin();
  return { data: data ? mapDeal(data) : null, error: null };
}

export async function adminDeleteDeal(id: string) {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const { error } = await deleteRows(supabase, "deals", { id });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin();
  return { ok: true, error: null };
}

export async function adminListCategories() {
  await assertAdmin();
  const supabase = await getAdminSupabaseClient();
  const { data, error } = await supabase.from("categories").select("slug, name").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminRefreshLowestPrices() {
  await assertAdmin();
  const { executeLowestPriceRefresh } = await import("@/services/lowest-prices");
  const result = await executeLowestPriceRefresh({ force: true, triggeredBy: "admin" });
  revalidateLowestPrices();
  return {
    itemsComputed: result.itemsComputed ?? 0,
    skipped: "skipped" in result ? result.skipped : false,
    error: "error" in result ? (result.error ?? null) : null,
  };
}

export async function adminRefreshTrending() {
  await assertAdmin();
  const { executeTrendingRefresh } = await import("@/services/trending");
  const result = await executeTrendingRefresh();
  revalidateTrending();
  return {
    itemsRanked: result.ranked ?? 0,
    error: result.error ?? null,
  };
}

export async function adminRefreshPrices() {
  await assertAdmin();
  const { executeScheduledSync } = await import("@/services/sync");
  const { executeLowestPriceRefresh } = await import("@/services/lowest-prices");
  const [syncResult, lowestResult] = await Promise.all([
    executeScheduledSync(),
    executeLowestPriceRefresh({ force: true, triggeredBy: "admin" }),
  ]);
  revalidateLowestPrices();
  revalidateCatalog();
  return {
    storesSynced: syncResult.data?.length ?? 0,
    lowestPricesComputed: lowestResult.itemsComputed ?? 0,
    error: syncResult.error ?? ("error" in lowestResult ? lowestResult.error : null) ?? null,
  };
}

export async function adminRunPhase1Import() {
  await assertAdmin();
  const { triggerPhase1Imports } = await import("@/services/sync");
  const result = await triggerPhase1Imports();
  revalidateCatalog();

  const totals = (result.data ?? []).reduce(
    (acc, r) => ({
      itemsFetched: acc.itemsFetched + r.itemsFetched,
      itemsCreated: acc.itemsCreated + r.itemsCreated,
      itemsUpdated: acc.itemsUpdated + r.itemsUpdated,
    }),
    { itemsFetched: 0, itemsCreated: 0, itemsUpdated: 0 }
  );

  return {
    providersRun: result.data?.length ?? 0,
    ...totals,
    error: result.error ?? null,
  };
}

export async function adminSaveAffiliateSettings(
  settings: Array<{
    marketplace: import("@/lib/affiliate/config").AffiliateMarketplace;
    partnerTag?: string | null;
    commissionRate?: number;
    isEnabled?: boolean;
  }>
) {
  await assertAdmin();
  const { updateAffiliateSettings } = await import("@/services/affiliate");
  const result = await updateAffiliateSettings(settings);
  revalidateAdmin();
  return { ok: result.ok, error: result.error ?? null };
}
