import { mapFavorite, mapNotification, mapProduct, mapProfile } from "@/lib/database/mappers";
import type { FavoriteRow, ProductRow } from "@/lib/database/types";
import { deleteRows, insertRow, updateRow } from "@/lib/database/writes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Favorite, Notification, ServiceResult, User } from "@/lib/types/entities";

type FavoriteWithProduct = FavoriteRow & { products: ProductRow | null };

export async function getCurrentUser(): Promise<ServiceResult<User | null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return { data: null, error: authError.message };
  if (!user) return { data: null, error: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data ? mapProfile(data) : null, error: null };
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<{
    name: string;
    locale: string;
    countryCode: string;
    currency: string;
    avatarUrl: string;
  }>
): Promise<ServiceResult<User | null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const payload = {
    name: updates.name,
    locale: updates.locale,
    country_code: updates.countryCode,
    currency: updates.currency,
    avatar_url: updates.avatarUrl,
  };

  const { data, error } = await updateRow(supabase, "profiles", payload, { id: userId });

  if (error) return { data: null, error: error.message };
  return { data: data ? mapProfile(data) : null, error: null };
}

export async function getUserFavorites(userId: string): Promise<ServiceResult<Favorite[]>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("favorites")
    .select("*, products (*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  return {
    data: ((data ?? []) as FavoriteWithProduct[]).map((row) => {
      const product = row.products ? mapProduct(row.products) : undefined;
      return mapFavorite(row, product);
    }),
    error: null,
  };
}

export async function addFavorite(
  userId: string,
  productId: string,
  priceAlert?: number,
  currency?: string
): Promise<ServiceResult<Favorite | null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const { data, error } = await insertRow(supabase, "favorites", {
    user_id: userId,
    product_id: productId,
    price_alert: priceAlert ?? null,
    currency: currency ?? null,
  });

  if (error) return { data: null, error: error.message };
  return { data: data ? mapFavorite(data) : null, error: null };
}

export async function removeFavorite(
  userId: string,
  productId: string
): Promise<ServiceResult<boolean>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { data: false, error: "Supabase not configured" };
  }

  const { error } = await deleteRows(supabase, "favorites", {
    user_id: userId,
    product_id: productId,
  });

  if (error) return { data: false, error: error.message };
  return { data: true, error: null };
}

export async function getUserNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<ServiceResult<Notification[]>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq("read", false);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  return { data: (data ?? []).map(mapNotification), error: null };
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<ServiceResult<Notification | null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const payload = { read: true, read_at: new Date().toISOString() };

  const { data, error } = await updateRow(supabase, "notifications", payload, {
    id: notificationId,
    user_id: userId,
  });

  if (error) return { data: null, error: error.message };
  return { data: data ? mapNotification(data) : null, error: null };
}
