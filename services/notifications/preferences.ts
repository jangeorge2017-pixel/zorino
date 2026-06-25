import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export type NotificationPreferences = {
  emailPriceDrops: boolean;
  emailTrending: boolean;
  inAppEnabled: boolean;
};

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const defaults: NotificationPreferences = {
    emailPriceDrops: true,
    emailTrending: true,
    inAppEnabled: true,
  };

  const supabase = createSupabaseServiceClient() ?? (await createSupabaseServerClient());
  if (!supabase) return defaults;

  const { data } = await supabase
    .from("notification_preferences")
    .select("email_price_drops, email_trending, in_app_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return defaults;

  const row = data as {
    email_price_drops: boolean;
    email_trending: boolean;
    in_app_enabled: boolean;
  };

  return {
    emailPriceDrops: row.email_price_drops,
    emailTrending: row.email_trending,
    inAppEnabled: row.in_app_enabled,
  };
}

export async function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };

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

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
