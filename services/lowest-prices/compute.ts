import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";
import { LOWEST_PRICE_REFRESH_INTERVAL_MINUTES } from "@/lib/lowest-prices/config";

const DEFAULT_COUNTRIES = ["US", "GB", "AE", "SA", "DE"] as const;

type PriceCandidate = {
  product_id: string;
  store_id: string;
  price: number;
  original_price: number | null;
  currency: string;
  country_code: string | null;
  external_url: string | null;
  recorded_at: string;
  stores: {
    name: string;
    slug: string;
    integration_type: string;
    website: string;
  } | null;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  emoji: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

export async function computeLowestPricesToday(options?: {
  countryCodes?: string[];
  triggeredBy?: string;
}): Promise<{ itemsComputed: number; error?: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { itemsComputed: 0, error: "Supabase not configured" };

  const countries = options?.countryCodes ?? [...DEFAULT_COUNTRIES];
  let totalComputed = 0;

  await db(supabase)
    .from("lowest_price_refresh_jobs")
    .update({ last_status: "running", last_error: null })
    .not("id", "is", null);

  try {
    for (const countryCode of countries) {
      totalComputed += await computeForCountry(supabase, countryCode);
    }

    await db(supabase)
      .from("lowest_price_refresh_jobs")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: new Date(
          Date.now() + LOWEST_PRICE_REFRESH_INTERVAL_MINUTES * 60_000
        ).toISOString(),
        last_status: "completed",
        last_error: null,
        items_computed: totalComputed,
        triggered_by: options?.triggeredBy ?? "cron",
      })
      .not("id", "is", null);

    return { itemsComputed: totalComputed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compute failed";
    await db(supabase)
      .from("lowest_price_refresh_jobs")
      .update({ last_status: "failed", last_error: message })
      .not("id", "is", null);
    return { itemsComputed: totalComputed, error: message };
  }
}

async function computeForCountry(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  countryCode: string
): Promise<number> {
  const { data: priceRows, error } = await db(supabase)
    .from("prices")
    .select(
      "product_id, store_id, price, original_price, currency, country_code, external_url, recorded_at, stores (name, slug, integration_type, website)"
    )
    .eq("is_current", true)
    .eq("country_code", countryCode);

  if (error) throw new Error(error.message);

  const byProduct = new Map<string, PriceCandidate[]>();
  for (const row of (priceRows ?? []) as PriceCandidate[]) {
    const list = byProduct.get(row.product_id) ?? [];
    list.push(row);
    byProduct.set(row.product_id, list);
  }

  if (byProduct.size === 0) return 0;

  const productIds = [...byProduct.keys()];
  const { data: products } = await db(supabase)
    .from("products")
    .select("id, name, slug, image_url, emoji")
    .in("id", productIds)
    .eq("is_active", true);

  const productMap = new Map(
    ((products ?? []) as ProductRow[]).map((p) => [p.id, p])
  );

  const affiliateMap = await loadAffiliateUrls(supabase, productIds, countryCode);

  const cacheRows: Record<string, unknown>[] = [];
  let computed = 0;

  for (const [productId, candidates] of byProduct) {
    const product = productMap.get(productId);
    if (!product) continue;

    const best = candidates.reduce((min, row) => (row.price < min.price ? row : min));
    const store = best.stores;
    const original = best.original_price ?? best.price;
    const discountPercent =
      original > best.price
        ? Math.round(((original - best.price) / original) * 10000) / 100
        : 0;
    const savings = Math.max(0, original - best.price);
    const provider = store?.integration_type ?? "partner";
    const affiliateKey = `${productId}:${best.store_id}:${countryCode}:${best.currency}`;
    const affiliateUrl =
      affiliateMap.get(affiliateKey) ??
      best.external_url ??
      store?.website ??
      "";

    const previousLow = await getPreviousLowest(supabase, productId, countryCode, best.currency);
    const isNewLow = previousLow === null || best.price < previousLow;

    if (isNewLow) {
      await db(supabase).from("lowest_price_history").insert({
        product_id: productId,
        store_id: best.store_id,
        provider,
        price: best.price,
        previous_lowest: previousLow,
        country_code: countryCode,
        currency: best.currency,
        recorded_at: new Date().toISOString(),
      });
    }

    cacheRows.push({
      product_id: productId,
      country_code: countryCode,
      currency: best.currency,
      product_name: product.name,
      product_slug: product.slug,
      image_url: product.image_url,
      emoji: product.emoji,
      lowest_price: best.price,
      original_price: original,
      discount_percent: discountPercent,
      savings_amount: savings,
      store_id: best.store_id,
      store_name: store?.name ?? "Store",
      provider,
      affiliate_url: affiliateUrl,
      external_url: best.external_url ?? store?.website ?? null,
      is_new_low: isNewLow,
      price_recorded_at: best.recorded_at,
      computed_at: new Date().toISOString(),
    });
    computed += 1;
  }

  if (cacheRows.length > 0) {
    await db(supabase)
      .from("lowest_prices_today")
      .upsert(cacheRows, { onConflict: "product_id,country_code,currency" });
  }

  return computed;
}

async function loadAffiliateUrls(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  productIds: string[],
  countryCode: string
) {
  const map = new Map<string, string>();
  const { data } = await db(supabase)
    .from("product_sources")
    .select("product_id, store_id, country_code, currency, affiliate_url, external_url")
    .in("product_id", productIds)
    .eq("is_active", true);

  for (const row of data ?? []) {
    const r = row as {
      product_id: string;
      store_id: string;
      country_code: string | null;
      currency: string;
      affiliate_url: string | null;
      external_url: string | null;
    };
    if (r.country_code && r.country_code !== countryCode) continue;
    const url = r.affiliate_url ?? r.external_url;
    if (!url) continue;
    map.set(`${r.product_id}:${r.store_id}:${countryCode}:${r.currency}`, url);
  }

  return map;
}

async function getPreviousLowest(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  productId: string,
  countryCode: string,
  currency: string
): Promise<number | null> {
  const { data: cached } = await db(supabase)
    .from("lowest_prices_today")
    .select("lowest_price")
    .eq("product_id", productId)
    .eq("country_code", countryCode)
    .eq("currency", currency)
    .maybeSingle();

  if (cached?.lowest_price != null) return Number(cached.lowest_price);

  const { data: history } = await db(supabase)
    .from("lowest_price_history")
    .select("price")
    .eq("product_id", productId)
    .eq("country_code", countryCode)
    .eq("currency", currency)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return history?.price != null ? Number(history.price) : null;
}

export async function isLowestPriceRefreshDue(): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return false;

  const { data } = await db(supabase)
    .from("lowest_price_refresh_jobs")
    .select("next_run_at, is_enabled")
    .limit(1)
    .maybeSingle();

  if (!data?.is_enabled) return false;
  if (!data.next_run_at) return true;
  return new Date(data.next_run_at).getTime() <= Date.now();
}

export async function executeLowestPriceRefresh(options?: {
  force?: boolean;
  triggeredBy?: string;
}) {
  if (!options?.force) {
    const due = await isLowestPriceRefreshDue();
    if (!due) return { itemsComputed: 0, skipped: true as const };
  }
  const result = await computeLowestPricesToday({ triggeredBy: options?.triggeredBy ?? "cron" });
  return { ...result, skipped: false as const };
}
