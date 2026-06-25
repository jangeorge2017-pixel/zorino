import type { LowestPriceSort, LowestPriceTodayItem, ServiceResult } from "@/lib/types/entities";
import {
  DEFAULT_LOWEST_COUNTRY,
  DEFAULT_LOWEST_CURRENCY,
  DEFAULT_LOWEST_LIMIT,
} from "@/lib/lowest-prices/config";
import { normalizeProductImageUrl } from "@/lib/images/product-image";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";

type LowestPriceRow = {
  id: string;
  product_id: string;
  country_code: string;
  currency: string;
  product_name: string;
  product_slug: string;
  image_url: string;
  emoji: string | null;
  lowest_price: number;
  original_price: number | null;
  discount_percent: number;
  savings_amount: number;
  store_name: string;
  provider: string | null;
  affiliate_url: string | null;
  external_url: string | null;
  is_new_low: boolean;
  price_recorded_at: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

function mapRow(row: LowestPriceRow): LowestPriceTodayItem {
  const affiliateUrl = row.affiliate_url ?? row.external_url ?? "";
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productSlug: row.product_slug,
    imageUrl: normalizeProductImageUrl(row.image_url),
    emoji: row.emoji ?? "🛍️",
    lowestPrice: Number(row.lowest_price),
    originalPrice: Number(row.original_price ?? row.lowest_price),
    discountPercent: Number(row.discount_percent),
    savingsAmount: Number(row.savings_amount),
    storeName: row.store_name,
    provider: row.provider ?? "partner",
    affiliateUrl,
    externalUrl: row.external_url ?? affiliateUrl,
    isNewLow: row.is_new_low,
    priceRecordedAt: row.price_recorded_at,
    countryCode: row.country_code,
    currency: row.currency,
  };
}

function sortItems(items: LowestPriceTodayItem[], sort: LowestPriceSort): LowestPriceTodayItem[] {
  const sorted = [...items];
  if (sort === "biggest_discount") {
    return sorted.sort((a, b) => b.discountPercent - a.discountPercent);
  }
  if (sort === "new_lowest") {
    return sorted.sort((a, b) => {
      if (a.isNewLow !== b.isNewLow) return a.isNewLow ? -1 : 1;
      const aTime = a.priceRecordedAt ? new Date(a.priceRecordedAt).getTime() : 0;
      const bTime = b.priceRecordedAt ? new Date(b.priceRecordedAt).getTime() : 0;
      return bTime - aTime;
    });
  }
  return sorted.sort((a, b) => a.lowestPrice - b.lowestPrice);
}

/** Read cached lowest prices (fast homepage path). */
export async function getLowestPricesToday(options?: {
  countryCode?: string;
  currency?: string;
  sort?: LowestPriceSort;
  limit?: number;
}): Promise<ServiceResult<LowestPriceTodayItem[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const countryCode = options?.countryCode ?? DEFAULT_LOWEST_COUNTRY;
  const currency = options?.currency ?? DEFAULT_LOWEST_CURRENCY;
  const sort = options?.sort ?? "lowest_price";
  const limit = options?.limit ?? DEFAULT_LOWEST_LIMIT;

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select("*")
    .eq("country_code", countryCode)
    .eq("currency", currency);

  if (error) return { data: [], error: error.message };

  if (!data?.length) {
    return getLowestPricesLiveFallback(countryCode, currency, sort, limit);
  }

  const items = sortItems((data as LowestPriceRow[]).map(mapRow), sort).slice(0, limit);
  return { data: items, error: null };
}

/** Live compute fallback when cache is empty (before first refresh). */
async function getLowestPricesLiveFallback(
  countryCode: string,
  currency: string,
  sort: LowestPriceSort,
  limit: number
): Promise<ServiceResult<LowestPriceTodayItem[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: [], error: null };

  const { data: prices, error } = await db(supabase)
    .from("prices")
    .select(
      "product_id, store_id, price, original_price, currency, country_code, external_url, recorded_at, stores (name, integration_type, website), products (id, name, slug, image_url, emoji, is_active)"
    )
    .eq("is_current", true)
    .eq("country_code", countryCode)
    .eq("currency", currency);

  if (error) return { data: [], error: error.message };

  type LiveRow = {
    product_id: string;
    price: number;
    original_price: number | null;
    external_url: string | null;
    recorded_at: string;
    stores: { name: string; integration_type: string; website: string } | null;
    products: {
      id: string;
      name: string;
      slug: string;
      image_url: string;
      emoji: string | null;
      is_active: boolean;
    } | null;
  };

  const bestByProduct = new Map<string, LiveRow>();
  for (const row of (prices ?? []) as LiveRow[]) {
    if (!row.products?.is_active) continue;
    const existing = bestByProduct.get(row.product_id);
    if (!existing || row.price < existing.price) {
      bestByProduct.set(row.product_id, row);
    }
  }

  const items: LowestPriceTodayItem[] = [];
  for (const row of bestByProduct.values()) {
    const product = row.products!;
    const original = row.original_price ?? row.price;
    const discountPercent =
      original > row.price ? Math.round(((original - row.price) / original) * 10000) / 100 : 0;

    items.push({
      id: product.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      imageUrl: product.image_url,
      emoji: product.emoji ?? "🛍️",
      lowestPrice: row.price,
      originalPrice: original,
      discountPercent,
      savingsAmount: Math.max(0, original - row.price),
      storeName: row.stores?.name ?? "Store",
      provider: row.stores?.integration_type ?? "partner",
      affiliateUrl: row.external_url ?? row.stores?.website ?? "",
      externalUrl: row.external_url ?? row.stores?.website ?? "",
      isNewLow: false,
      priceRecordedAt: row.recorded_at,
      countryCode,
      currency,
    });
  }

  return { data: sortItems(items, sort).slice(0, limit), error: null };
}

export async function getLowestPriceRefreshStatus() {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await db(supabase)
    .from("lowest_price_refresh_jobs")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
