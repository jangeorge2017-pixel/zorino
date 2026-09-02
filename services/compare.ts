import { mapProduct, mapStore } from "@/lib/database/mappers";
import type { ProductRow, StoreRow } from "@/lib/database/types";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { computeCompareStats, mergeOffersDedupe } from "@/lib/compare/merge";
import {
  compareProductPrices,
  getCurrentPricesForProduct,
  getLowestPrice,
} from "@/services/prices";
import type { Price, Product, ServiceResult } from "@/lib/types/entities";

export type CompareOffer = Price & {
  provider?: string;
  isLowest?: boolean;
  isHighestDiscount?: boolean;
  discountPercent: number;
};

export type CompareProductResult = {
  product: Product;
  offers: CompareOffer[];
  lowestPrice: number;
  highestPrice: number;
  highestDiscount: number;
  savingsVsHighest: number;
  savingsPercent: number;
  providerCount: number;
  cheapestStoreName: string;
  highestDiscountStoreName: string;
};

type ExternalPriceRow = {
  provider: string;
  store_id: string;
  external_id: string;
  canonical_product_id: string | null;
  price: number;
  original_price: number | null;
  currency: string;
  country_code: string | null;
  in_stock: boolean;
  recorded_at: string;
  stores: StoreRow | null;
  external_products: {
    product_url: string | null;
    affiliate_url: string | null;
  } | null;
};

function emptyCompareResult(product: Product): CompareProductResult {
  return {
    product,
    offers: [],
    lowestPrice: 0,
    highestPrice: 0,
    highestDiscount: 0,
    savingsVsHighest: 0,
    savingsPercent: 0,
    providerCount: 0,
    cheapestStoreName: "",
    highestDiscountStoreName: "",
  };
}

/** Compare prices across all imported sources for a single product. */
export async function compareImportedProductPrices(
  productId: string,
  options?: { countryCode?: string; currency?: string }
): Promise<ServiceResult<CompareProductResult | null>> {
  const [pricesResult, productResult, externalResult] = await Promise.all([
    compareProductPrices(productId, options),
    getProductById(productId),
    getExternalPricesForProduct(productId, options),
  ]);

  if (pricesResult.error) return { data: null, error: pricesResult.error };
  if (!productResult.data) return { data: null, error: productResult.error ?? "Product not found" };

  const providerByStore = new Map(
    (externalResult.data ?? []).map((row) => [row.store_id, row.provider])
  );

  // Internal offers: per-store current price rows from the `prices` table.
  const internalOffers: CompareOffer[] = pricesResult.data.map((price) => {
    const original = price.originalPrice ?? price.price;
    const discountPercent =
      original > price.price
        ? Math.round(((original - price.price) / original) * 10000) / 100
        : 0;
    return {
      ...price,
      provider: price.storeId ? providerByStore.get(price.storeId) : price.store?.integrationType,
      discountPercent,
    };
  });

  // External offers: REAL provider price snapshots from `external_prices`,
  // keyed to the canonical product via canonical_product_id. These were fetched
  // but never merged into the final CompareOffer[] — include them now so Compare
  // Prices shows every valid real store/offer, not just internal price rows.
  const externalOffers: CompareOffer[] = (externalResult.data ?? [])
    .filter((row) => row.price > 0 && Boolean(row.store_id))
    .map((row) => {
      const original =
        row.original_price != null && row.original_price > row.price
          ? row.original_price
          : row.price;
      const discountPercent =
        original > row.price
          ? Math.round(((original - row.price) / original) * 10000) / 100
          : 0;
      const store = row.stores ? mapStore(row.stores) : undefined;
      const externalUrl =
        row.external_products?.affiliate_url?.trim() ||
        row.external_products?.product_url?.trim() ||
        null;
      return {
        id: `ext-${row.provider}-${row.store_id}-${row.external_id}`,
        productId,
        storeId: row.store_id,
        price: row.price,
        originalPrice: original || null,
        currency: row.currency,
        countryCode: row.country_code,
        externalUrl,
        externalProductId: row.external_id,
        inStock: row.in_stock,
        isCurrent: true,
        recordedAt: row.recorded_at,
        store,
        provider: row.provider,
        discountPercent,
      };
    });

  // Merge both real sources, one offer per store (internal rows win).
  const merged = mergeOffersDedupe(
    internalOffers,
    externalOffers,
    (offer) => offer.storeId,
  );

  if (merged.length === 0) {
    return { data: emptyCompareResult(productResult.data), error: null };
  }

  const sorted = [...merged].sort((a, b) => a.price - b.price);
  const stats = computeCompareStats(sorted);

  for (const offer of sorted) {
    offer.isLowest = false;
    offer.isHighestDiscount = false;
  }
  if (stats.cheapestIndex >= 0) sorted[stats.cheapestIndex]!.isLowest = true;
  for (const index of stats.highestDiscountIndexes) {
    sorted[index]!.isHighestDiscount = true;
  }

  const cheapest = sorted[stats.cheapestIndex >= 0 ? stats.cheapestIndex : 0]!;
  const highestDiscountOffer =
    stats.highestDiscountIndexes.length > 0
      ? sorted[stats.highestDiscountIndexes[0]!]!
      : sorted[0]!;

  return {
    data: {
      product: productResult.data,
      offers: sorted,
      lowestPrice: stats.lowestPrice,
      highestPrice: stats.highestPrice,
      highestDiscount: stats.highestDiscount,
      savingsVsHighest: stats.savingsVsHighest,
      savingsPercent: stats.savingsPercent,
      providerCount: new Set(sorted.map((o) => o.storeId)).size,
      cheapestStoreName: cheapest.store?.name ?? "Store",
      highestDiscountStoreName: highestDiscountOffer.store?.name ?? "Store",
    },
    error: null,
  };
}

/** Find products with multi-source price data suitable for the compare page. */
export async function getComparableProducts(
  options?: { limit?: number; countryCode?: string; currency?: string }
): Promise<ServiceResult<CompareProductResult[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  let priceQuery = supabase
    .from("prices")
    .select("product_id")
    .eq("is_current", true);

  if (options?.countryCode) priceQuery = priceQuery.eq("country_code", options.countryCode);
  if (options?.currency) priceQuery = priceQuery.eq("currency", options.currency);

  const { data: priceRows, error } = await priceQuery;
  if (error) return { data: [], error: error.message };

  const counts = new Map<string, number>();
  for (const row of priceRows ?? []) {
    const id = (row as { product_id: string }).product_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const multiSourceIds = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([id]) => id)
    .slice(0, options?.limit ?? 12);

  const results: CompareProductResult[] = [];
  for (const productId of multiSourceIds) {
    const { data } = await compareImportedProductPrices(productId, options);
    if (data && data.offers.length >= 2) results.push(data);
  }

  return { data: results, error: null };
}

/** Compare multiple products by ID (backend for /compare page). */
export async function compareProductsByIds(
  productIds: string[],
  options?: { countryCode?: string; currency?: string }
): Promise<ServiceResult<CompareProductResult[]>> {
  const results: CompareProductResult[] = [];
  for (const id of productIds) {
    const { data, error } = await compareImportedProductPrices(id, options);
    if (error) return { data: [], error };
    if (data) results.push(data);
  }
  return { data: results, error: null };
}

async function getProductById(id: string): Promise<ServiceResult<Product | null>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: null, error: "Supabase not configured" };

  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: mapProduct(data as ProductRow), error: null };
}

async function getExternalPricesForProduct(
  productId: string,
  options?: { countryCode?: string; currency?: string }
): Promise<ServiceResult<ExternalPriceRow[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  let query = supabase
    .from("external_prices")
    .select(
      "provider, store_id, external_id, canonical_product_id, price, original_price, currency, country_code, in_stock, recorded_at, stores (*), external_products (product_url, affiliate_url)"
    )
    .eq("canonical_product_id", productId)
    .eq("is_current", true)
    .order("price", { ascending: true });

  if (options?.countryCode) query = query.eq("country_code", options.countryCode);
  if (options?.currency) query = query.eq("currency", options.currency);

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ExternalPriceRow[], error: null };
}

/** Re-export core price helpers used by product detail. */
export { compareProductPrices, getCurrentPricesForProduct, getLowestPrice };