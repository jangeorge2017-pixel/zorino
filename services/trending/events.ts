import type { ProductEngagementEventType } from "@/lib/types/entities";
import { createSupabaseAnonClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import type { ServiceResult } from "@/lib/types/entities";
import type { SupabaseDb } from "@/lib/supabase/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

export type TrackEventInput = {
  productId: string;
  eventType: ProductEngagementEventType;
  countryCode?: string;
  userId?: string;
  sessionId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

const EVENT_WEIGHTS = {
  view: 1,
  click: 3,
  favorite: 5,
  purchase: 10,
} as const;

/** Record a product engagement event (view, click, favorite, purchase). */
export async function trackProductEvent(
  input: TrackEventInput
): Promise<ServiceResult<{ ok: true }>> {
  const supabase = createSupabaseServiceClient() ?? createSupabaseAnonClient();
  if (!supabase) {
    return { data: { ok: true }, error: null };
  }

  const { error } = await db(supabase).from("product_engagement_events").insert({
    product_id: input.productId,
    event_type: input.eventType,
    country_code: input.countryCode ?? "US",
    user_id: input.userId ?? null,
    session_id: input.sessionId ?? null,
    source: input.source ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) return { data: { ok: true }, error: error.message };

  await upsertDailyStat(supabase, input);
  return { data: { ok: true }, error: null };
}

async function upsertDailyStat(
  supabase: SupabaseDb,
  input: TrackEventInput
) {
  const today = new Date().toISOString().slice(0, 10);
  const country = input.countryCode ?? "US";
  const column = statColumnForEvent(input.eventType);
  if (!column) return;

  const { data: existing } = await db(supabase)
    .from("product_engagement_daily")
    .select("views, clicks, favorites, purchases")
    .eq("product_id", input.productId)
    .eq("stat_date", today)
    .eq("country_code", country)
    .maybeSingle();

  if (existing) {
    await db(supabase)
      .from("product_engagement_daily")
      .update({
        [column]: (existing[column as keyof typeof existing] as number) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", input.productId)
      .eq("stat_date", today)
      .eq("country_code", country);
  } else {
    await db(supabase).from("product_engagement_daily").insert({
      product_id: input.productId,
      stat_date: today,
      country_code: country,
      views: input.eventType === "view" ? 1 : 0,
      clicks: input.eventType === "click" ? 1 : 0,
      favorites: input.eventType === "favorite" ? 1 : 0,
      purchases: input.eventType === "purchase" ? 1 : 0,
    });
  }
}

function statColumnForEvent(type: ProductEngagementEventType) {
  const map = {
    view: "views",
    click: "clicks",
    favorite: "favorites",
    purchase: "purchases",
  } as const;
  return map[type];
}

export function engagementScore(stats: {
  views: number;
  clicks: number;
  favorites: number;
  purchases: number;
}): number {
  return (
    stats.views * EVENT_WEIGHTS.view +
    stats.clicks * EVENT_WEIGHTS.click +
    stats.favorites * EVENT_WEIGHTS.favorite +
    stats.purchases * EVENT_WEIGHTS.purchase
  );
}

export { EVENT_WEIGHTS };
