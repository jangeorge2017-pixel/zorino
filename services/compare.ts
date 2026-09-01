import { computeSavingsPercent } from "@/lib/marketplace-engine/utils";
import { mapProduct } from "@/lib/database/mappers";
import type { ProductRow } from "@/lib/database/types";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import {
  compareProductPrices,
  getCurrentPricesForProduct,
  getLowestPrice,
} from "@/services/prices";
import type { Price, Product, ServiceResult } from "@/lib/types/entities";
import { isValidProductDestinationUrl } from "@/lib/affiliate/product-url";

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
};

/**
 * Convert external_prices row to CompareOffer shape.
 * Only includes offers with valid product-destination URLs.
 */
function externalPriceToOffer(
  external: ExternalPriceRow & { product_url?: string | null }
): CompareOffer | null {
  // Validate the product URL: must be a real product destination, not a homepage/landing page
  if (!external.product_url || !isValidProductDestinationUrl(external.product_url)) {
    return null;
  }

  const original = external.original_price ?? external.price;
  const discountPercent =
    original > external.price
      ? Math.round(((original - external.price) / original) * 10000) / 100
      : 0;

  return {
    id: `external-${external.external_id}`,
    productId: "",
    storeId: external.store_id,
    price: external.price,
    originalPrice: external.original_price ?? external.price,
    currency: external.currency,
    countryCode: external.country_code ?? undefined,
    externalUrl: external.product_url,
    externalProductId: external.external_id,
    inStock: external.in_stock,
    isCurrent: true,
    recordedAt: new Date().toISOString(),
    provider: external.provider,
    discountPercent,
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

  // Build offers from internal prices
  const offers: CompareOffer[] = pricesResult.data.map((price) => {
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

  // Add external provider offers (real, live data from multiple sources)
  // Only include offers with validated product URLs
  const externalOffers = (externalResult.data ?? [])
    .map((ext) => externalPriceToOffer(ext as ExternalPriceRow & { product_url?: string | null }))
    .filter((offer): offer is CompareOffer => offer !== null);

  // Combine: external offers first (live, priority), then internal prices
  // Deduplicate by external_id to avoid duplicate store listings
  const offerMap = new Map<string, CompareOffer>();
  for (const offer of externalOffers) {
    if (offer.externalProductId) {
      offerMap.set(`external-${offer.externalProductId}`, offer);
    }
  }
  for (const offer of offers) {
    // Only add internal prices if we don't already have an external offer from the same store
    const storeKey = `store-${offer.storeId}`;
    if (!offerMap.has(storeKey)) {
      offerMap.set(storeKey, offer);
    }
  }

  const mergedOffers = Array.from(offerMap.values());

  if (mergedOffers.length === 0) {
    return {
      data: {
        product: productResult.data,
        offers: [],
        lowestPrice: 0,
        highestPrice: 0,
        highestDiscount: 0,
        savingsVsHighest: 0,
        savingsPercent: 0,
        providerCount: 0,
        cheapestStoreName: "",
        highestDiscountStoreName: "",
      },
      error: null,
    };
  }

  const sorted = [...mergedOffers].sort((a, b) => a.price - b.price);
  const lowest = sorted[0].price;
  const highest = sorted[sorted.length - 1].price;
  const maxDiscount = Math.max(...sorted.map((o) => o.discountPercent));
  const highestDiscountOffer = sorted.reduce((best, o) =>
    o.discountPercent > best.discountPercent ? o : best
  );

  sorted[0].isLowest = true;
  for (const offer of sorted) {
    if (offer.discountPercent === maxDiscount && maxDiscount > 0) {
      offer.isHighestDiscount = true;
    }
  }

  return {
    data: {
      product: productResult.data,
      offers: sorted,
      lowestPrice: lowest,
      highestPrice: highest,
      highestDiscount: maxDiscount,
      savingsVsHighest: Math.max(0, highest - lowest),
      savingsPercent: computeSavingsPercent(lowest, highest),
      providerCount: new Set(sorted.map((o) => o.storeId)).size,
      cheapestStoreName: sorted[0].store?.name ?? "Store",
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
): Promise<ServiceResult<(ExternalPriceRow & { product_url?: string | null })[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  let query = supabase
    .from("external_prices")
    .select("provider, store_id, external_id, canonical_product_id, price, original_price, currency, country_code, in_stock, raw_payload")
    .eq("canonical_product_id", productId)
    .eq("is_current", true);

  if (options?.countryCode) query = query.eq("country_code", options.countryCode);
  if (options?.currency) query = query.eq("currency", options.currency);

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  // Extract product_url from raw_payload if available
  const result = (data ?? []).map((row: any) => {
    let product_url: string | null = null;
    if (row.raw_payload && typeof row.raw_payload === 'object') {
      product_url = row.raw_payload.product_url || row.raw_payload.productUrl || null;
    }
    return {
      ...row,
      product_url,
    };
  });

  return { data: result as (ExternalPriceRow & { product_url?: string | null })[], error: null };
}

/** Re-export core price helpers used by product detail. */
export { compareProductPrices, getCurrentPricesForProduct, getLowestPrice };
