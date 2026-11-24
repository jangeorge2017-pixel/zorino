import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";
import { LOWEST_PRICE_REFRESH_INTERVAL_MINUTES } from "@/lib/lowest-prices/config";

const DEFAULT_COUNTRIES = ["US", "GB", "AE", "SA", "DE"] as const;
const PAGE_SIZE = 100;
const PRICE_COLUMNS =
  "product_id, store_id, price, original_price, currency, country_code, external_url, recorded_at, stores (name, slug, integration_type, website)";

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
  let offset = 0;
  let currentProductId: string | null = null;
  let bestForCurrent: PriceCandidate | null = null;
  let pending = new Map<string, PriceCandidate>();
  let computed = 0;

  const flush = async () => {
    if (pending.size === 0) return;
    computed += await processProductBatch(supabase, countryCode, pending);
    pending = new Map<string, PriceCandidate>();
  };

  for (;;) {
    const { data, error } = await db(supabase)
      .from("prices")
      .select(PRICE_COLUMNS)
      .eq("is_current", true)
      .eq("country_code", countryCode)
      .order("product_id", { ascending: true })
      .order("store_id", { ascending: true })
      .order("recorded_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as PriceCandidate[];
    for (const row of rows) {
      if (currentProductId !== null && row.product_id !== currentProductId) {
        if (bestForCurrent) pending.set(currentProductId, bestForCurrent);
        bestForCurrent = null;
        if (pending.size >= PAGE_SIZE) await flush();
      }
      currentProductId = row.product_id;
      if (!bestForCurrent || row.price < bestForCurrent.price) bestForCurrent = row;
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (currentProductId !== null && bestForCurrent) {
    pending.set(currentProductId, bestForCurrent);
  }
  await flush();

  return computed;
}

async function processProductBatch(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  countryCode: string,
  bestByProduct: Map<string, PriceCandidate>
): Promise<number> {
  const productIds = [...bestByProduct.keys()];
  const { data: products } = await db(supabase)
    .from("products")
    .select("id, name, slug, image_url, emoji")
    .in("id", productIds)
    .eq("is_active", true);

  const productMap = new Map(
    ((products ?? []) as ProductRow[]).map((p) => [p.id, p])
  );

  const affiliateMap = await loadAffiliateUrls(supabase, productIds, countryCode);
  const previousLows = await loadPreviousLows(supabase, productIds, countryCode);

  const cacheRows: Record<string, unknown>[] = [];
  const historyRows: Record<string, unknown>[] = [];
  let computed = 0;

  for (const [productId, best] of bestByProduct) {
    const product = productMap.get(productId);
    if (!product) continue;

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

    const previousLow = previousLows.get(productId) ?? null;
    const isNewLow = previousLow === null || best.price < previousLow;

    if (isNewLow) {
      historyRows.push({
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

  for (let i = 0; i < historyRows.length; i += PAGE_SIZE) {
    await db(supabase)
      .from("lowest_price_history")
      .insert(historyRows.slice(i, i + PAGE_SIZE));
  }

  for (let i = 0; i < cacheRows.length; i += PAGE_SIZE) {
    await db(supabase)
      .from("lowest_prices_today")
      .upsert(cacheRows.slice(i, i + PAGE_SIZE), {
        onConflict: "product_id,country_code,currency",
      });
  }

  return computed;
}

async function loadAffiliateUrls(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  productIds: string[],
  countryCode: string
) {
  const map = new Map<string, string>();
  let offset = 0;

  for (;;) {
    const { data } = await db(supabase)
      .from("product_sources")
      .select("product_id, store_id, country_code, currency, affiliate_url, external_url")
      .in("product_id", productIds)
      .eq("is_active", true)
      .order("product_id", { ascending: true })
      .order("store_id", { ascending: true })
      .order("currency", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    const rows = data ?? [];
    for (const row of rows) {
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

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return map;
}

async function loadPreviousLows(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  productIds: string[],
  countryCode: string
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  for (const id of productIds) map.set(id, null);

  let offset = 0;
  for (;;) {
    const { data } = await db(supabase)
      .from("lowest_prices_today")
      .select("product_id, lowest_price")
      .eq("country_code", countryCode)
      .in("product_id", productIds)
      .order("product_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    const rows = data ?? [];
    for (const row of rows) {
      const r = row as { product_id: string; lowest_price: number | string | null };
      if (r.lowest_price == null) continue;
      if (map.get(r.product_id) == null) map.set(r.product_id, Number(r.lowest_price));
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const missing = productIds.filter((id) => map.get(id) == null);
  for (let i = 0; i < missing.length; i += PAGE_SIZE) {
    const chunk = missing.slice(i, i + PAGE_SIZE);
    let historyOffset = 0;

    for (;;) {
      const { data } = await db(supabase)
        .from("lowest_price_history")
        .select("product_id, price")
        .eq("country_code", countryCode)
        .in("product_id", chunk)
        .order("recorded_at", { ascending: false })
        .range(historyOffset, historyOffset + PAGE_SIZE - 1);

      const rows = data ?? [];
      for (const row of rows) {
        const r = row as { product_id: string; price: number | string | null };
        if (r.price == null) continue;
        if (map.get(r.product_id) == null) map.set(r.product_id, Number(r.price));
      }

      if (rows.length < PAGE_SIZE) break;
      historyOffset += PAGE_SIZE;
    }
  }

  return map;
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
