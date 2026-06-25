import {
  AFFILIATE_MARKETPLACES,
  DEFAULT_COMMISSION_RATES,
  type AffiliateMarketplace,
} from "@/lib/affiliate/config";
import { buildAffiliateUrl, getPartnerTagFromEnv } from "@/lib/affiliate/generate";
import { createSupabaseAnonClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

export type AffiliateSetting = {
  marketplace: AffiliateMarketplace;
  displayName: string;
  partnerTag: string | null;
  commissionRate: number;
  isEnabled: boolean;
};

export type AffiliateClickInput = {
  productId?: string | null;
  storeId?: string | null;
  marketplace: string;
  destinationUrl: string;
  affiliateUrl: string;
  sessionId?: string | null;
  userId?: string | null;
  countryCode?: string | null;
  source?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
};

export async function getAffiliateSettings(): Promise<AffiliateSetting[]> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return AFFILIATE_MARKETPLACES.map((marketplace) => ({
      marketplace,
      displayName: marketplace,
      partnerTag: getPartnerTagFromEnv(marketplace),
      commissionRate: DEFAULT_COMMISSION_RATES[marketplace],
      isEnabled: true,
    }));
  }

  const { data } = await db(supabase).from("affiliate_settings").select("*").order("marketplace");

  return AFFILIATE_MARKETPLACES.map((marketplace) => {
    const row = (data ?? []).find(
      (r: { marketplace: string }) => r.marketplace === marketplace
    ) as {
      marketplace: string;
      display_name: string;
      partner_tag: string | null;
      commission_rate: number;
      is_enabled: boolean;
    } | undefined;

    return {
      marketplace,
      displayName: row?.display_name ?? marketplace,
      partnerTag: row?.partner_tag ?? getPartnerTagFromEnv(marketplace),
      commissionRate: Number(row?.commission_rate ?? DEFAULT_COMMISSION_RATES[marketplace]),
      isEnabled: row?.is_enabled ?? true,
    };
  });
}

export async function getAffiliateSetting(
  marketplace: AffiliateMarketplace
): Promise<AffiliateSetting | null> {
  const settings = await getAffiliateSettings();
  return settings.find((s) => s.marketplace === marketplace) ?? null;
}

export async function generateProductAffiliateUrl(input: {
  destinationUrl: string;
  storeSlug?: string | null;
  marketplace?: AffiliateMarketplace | null;
  trackingId?: string;
  promotionLink?: string | null;
}): Promise<string> {
  const marketplace =
    input.marketplace ??
    (input.storeSlug?.toLowerCase() as AffiliateMarketplace | undefined) ??
    null;

  let partnerTag: string | null = null;
  if (marketplace) {
    const setting = await getAffiliateSetting(marketplace);
    if (setting && !setting.isEnabled) return input.destinationUrl;
    partnerTag = setting?.partnerTag ?? getPartnerTagFromEnv(marketplace);
  }

  if (marketplace === "aliexpress") {
    const { generateAliExpressAffiliateLink } = await import(
      "@/services/aliexpress/affiliate-links"
    );
    const { url } = await generateAliExpressAffiliateLink({
      productUrl: input.destinationUrl,
      promotionLink: input.promotionLink,
      trackingId: input.trackingId,
    });
    return url;
  }

  return buildAffiliateUrl({
    destinationUrl: input.destinationUrl,
    marketplace,
    storeSlug: input.storeSlug,
    partnerTag,
    trackingId: input.trackingId,
  });
}

export async function recordAffiliateClick(input: AffiliateClickInput): Promise<void> {
  const supabase = createSupabaseServiceClient() ?? createSupabaseAnonClient();
  if (!supabase) return;

  await db(supabase).from("affiliate_clicks").insert({
    product_id: input.productId ?? null,
    store_id: input.storeId ?? null,
    marketplace: input.marketplace,
    destination_url: input.destinationUrl,
    affiliate_url: input.affiliateUrl,
    session_id: input.sessionId ?? null,
    user_id: input.userId ?? null,
    country_code: input.countryCode ?? null,
    source: input.source ?? null,
    referrer: input.referrer ?? null,
    user_agent: input.userAgent ?? null,
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await db(supabase)
    .from("affiliate_daily_stats")
    .select("clicks")
    .eq("stat_date", today)
    .eq("marketplace", input.marketplace)
    .maybeSingle();

  if (existing) {
    await db(supabase)
      .from("affiliate_daily_stats")
      .update({ clicks: (existing.clicks as number) + 1 })
      .eq("stat_date", today)
      .eq("marketplace", input.marketplace);
  } else {
    await db(supabase).from("affiliate_daily_stats").insert({
      stat_date: today,
      marketplace: input.marketplace,
      clicks: 1,
    });
  }
}

export async function updateAffiliateSettings(
  settings: Array<{
    marketplace: AffiliateMarketplace;
    partnerTag?: string | null;
    commissionRate?: number;
    isEnabled?: boolean;
  }>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase not configured" };

  for (const row of settings) {
    const { error } = await db(supabase)
      .from("affiliate_settings")
      .update({
        partner_tag: row.partnerTag ?? null,
        commission_rate: row.commissionRate,
        is_enabled: row.isEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("marketplace", row.marketplace);

    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
