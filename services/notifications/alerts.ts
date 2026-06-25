import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sendNotificationEmail } from "@/services/notifications/email";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: NonNullable<ReturnType<typeof createSupabaseServiceClient>>): any {
  return client;
}

type PriceDropCandidate = {
  product_id: string;
  product_name: string;
  store_name: string;
  lowest_price: number;
  original_price: number | null;
  currency: string;
};

/** Create in-app notifications (and optional email) for price drops and trending alerts. */
export async function runNotificationAlerts(): Promise<{
  priceAlerts: number;
  trendingAlerts: number;
  emailsSent: number;
}> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { priceAlerts: 0, trendingAlerts: 0, emailsSent: 0 };

  let priceAlerts = 0;
  let trendingAlerts = 0;
  let emailsSent = 0;

  const { data: drops } = await db(supabase)
    .from("lowest_prices_today")
    .select("product_id, product_name, store_name, lowest_price, original_price, currency, is_new_low")
    .eq("is_new_low", true)
    .limit(20);

  for (const row of (drops ?? []) as PriceDropCandidate[]) {
    if (row.original_price == null) continue;
    const savings = Number(row.original_price) - Number(row.lowest_price);
    if (savings <= 0) continue;

    const title = "Price drop alert";
    const message = `${row.product_name} is now $${Number(row.lowest_price).toFixed(2)} at ${row.store_name} (was $${Number(row.original_price).toFixed(2)})`;

    const { data: profiles } = await db(supabase)
      .from("notification_preferences")
      .select("user_id, email_price_drops")
      .eq("email_price_drops", true)
      .limit(100);

    for (const pref of (profiles ?? []) as { user_id: string; email_price_drops: boolean }[]) {
      const link = `/product/${row.product_id}`;
      const { data: existing } = await db(supabase)
        .from("notifications")
        .select("id")
        .eq("user_id", pref.user_id)
        .eq("type", "price_drop")
        .eq("link", link)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
        .limit(1);
      if (existing?.length) continue;

      const { error } = await db(supabase).from("notifications").insert({
        user_id: pref.user_id,
        type: "price_drop",
        title,
        message,
        link,
        read: false,
      });
      if (!error) priceAlerts += 1;

      const sent = await sendNotificationEmail({
        userId: pref.user_id,
        subject: title,
        body: message,
      });
      if (sent) emailsSent += 1;
    }
  }

  const { data: trending } = await db(supabase)
    .from("trending_rankings")
    .select("product_id, products(name)")
    .eq("ranking_type", "trending_today")
    .lte("rank", 5);

  for (const row of (trending ?? []) as {
    product_id: string;
    products: { name?: string } | null;
  }[]) {
    const name = (row.products as { name?: string } | null)?.name ?? "A product";
    const title = "Trending now";
    const message = `${name} is trending today on Zorino`;

    const { data: prefs } = await db(supabase)
      .from("notification_preferences")
      .select("user_id")
      .eq("email_trending", true)
      .limit(50);

    for (const pref of (prefs ?? []) as { user_id: string }[]) {
      const link = `/product/${row.product_id}`;
      const { data: existing } = await db(supabase)
        .from("notifications")
        .select("id")
        .eq("user_id", pref.user_id)
        .eq("type", "trending")
        .eq("link", link)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
        .limit(1);
      if (existing?.length) continue;

      const { error } = await db(supabase).from("notifications").insert({
        user_id: pref.user_id,
        type: "trending",
        title,
        message,
        link,
        read: false,
      });
      if (!error) trendingAlerts += 1;
    }
  }

  return { priceAlerts, trendingAlerts, emailsSent };
}
