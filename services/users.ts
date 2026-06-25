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

export async function markAllNotificationsRead(
  userId: string
): Promise<ServiceResult<number>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { data: 0, error: "Supabase not configured" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("read", false)
    .select("id");

  if (error) return { data: 0, error: error.message };
  return { data: data?.length ?? 0, error: null };
}

export async function deleteUserNotification(
  notificationId: string,
  userId: string
): Promise<ServiceResult<boolean>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { data: false, error: "Supabase not configured" };
  }

  const { error } = await deleteRows(supabase, "notifications", {
    id: notificationId,
    user_id: userId,
  });

  if (error) return { data: false, error: error.message };
  return { data: true, error: null };
}

export type NotificationPreferences = {
  emailPriceDrops: boolean;
  emailTrending: boolean;
  inAppEnabled: boolean;
};

export async function getNotificationPreferences(
  userId: string
): Promise<ServiceResult<NotificationPreferences>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      data: { emailPriceDrops: true, emailTrending: true, inAppEnabled: true },
      error: "Supabase not configured",
    };
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      data: { emailPriceDrops: true, emailTrending: true, inAppEnabled: true },
      error: error.message,
    };
  }

  if (!data) {
    return {
      data: { emailPriceDrops: true, emailTrending: true, inAppEnabled: true },
      error: null,
    };
  }

  const row = data as {
    email_price_drops: boolean;
    email_trending: boolean;
    in_app_enabled: boolean;
  };

  return {
    data: {
      emailPriceDrops: row.email_price_drops,
      emailTrending: row.email_trending,
      inAppEnabled: row.in_app_enabled,
    },
    error: null,
  };
}

export async function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences
): Promise<ServiceResult<boolean>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { data: false, error: "Supabase not configured" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("notification_preferences").upsert(
    {
      user_id: userId,
      email_price_drops: prefs.emailPriceDrops,
      email_trending: prefs.emailTrending,
      in_app_enabled: prefs.inAppEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { data: false, error: error.message };
  return { data: true, error: null };
}
