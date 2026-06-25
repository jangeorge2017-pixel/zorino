import type { ExternalProduct } from "@/lib/sync/types";
import type { SupabaseDb } from "@/lib/supabase/config";
import type { MarketplaceOffer, ProductPricingSummary } from "@/lib/marketplace-engine/types";
import {
  computeDiscountPercent,
  computeSavingsPercent,
  extractProductIdentifiers,
} from "@/lib/marketplace-engine/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

export async function syncProductIdentifiers(
  supabase: SupabaseDb,
  productId: string,
  product: ExternalProduct,
  provider?: string | null
): Promise<void> {
  const identifiers = extractProductIdentifiers(product);
  if (identifiers.length === 0) return;

  const rows = identifiers.map((id) => ({
    product_id: productId,
    identifier_type: id.type,
    identifier_value: id.value,
    source_provider: provider ?? null,
  }));

  await db(supabase).from("product_identifiers").upsert(rows, {
    onConflict: "identifier_type,identifier_value",
    ignoreDuplicates: false,
  });
}

export async function syncProductVariants(
  supabase: SupabaseDb,
  productId: string,
  storeId: string,
  product: ExternalProduct
): Promise<void> {
  const specs = product.specifications ?? {};
  const variantKeys = ["color", "size", "storage", "capacity", "variant"];
  const attributes: Record<string, string> = {};

  for (const key of variantKeys) {
    const val = specs[key] ?? specs[key.toUpperCase()];
    if (val?.trim()) attributes[key] = val.trim();
  }

  if (Object.keys(attributes).length === 0 && !specs.variant_name) return;

  const name =
    specs.variant_name?.trim() ||
    Object.entries(attributes)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ") ||
    product.title;

  await db(supabase).from("product_variants").upsert(
    {
      product_id: productId,
      store_id: storeId,
      external_id: product.externalId,
      sku: specs.sku ?? specs.SKU ?? product.externalId,
      name,
      attributes,
      price: product.price,
      original_price: product.originalPrice ?? product.price,
      currency: product.currency,
      in_stock: product.inStock,
      image_url: product.imageUrl,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "product_id,store_id,external_id" }
  );
}

type PriceRow = {
  id: string;
  product_id: string;
  store_id: string;
  price: number;
  original_price: number | null;
  currency: string;
  country_code: string | null;
  in_stock: boolean;
  external_url: string | null;
  stores: { name: string; integration_type: string } | null;
};

/** Compute cross-marketplace best offer and savings for a canonical product. */
export async function computeProductPricingSummary(
  supabase: SupabaseDb,
  productId: string,
  options?: { countryCode?: string; currency?: string }
): Promise<ProductPricingSummary | null> {
  let query = db(supabase)
    .from("prices")
    .select("*, stores(name, integration_type)")
    .eq("product_id", productId)
    .eq("is_current", true)
    .order("price");

  if (options?.countryCode) query = query.eq("country_code", options.countryCode);
  if (options?.currency) query = query.eq("currency", options.currency);

  const { data } = await query;
  const rows = (data ?? []) as PriceRow[];
  if (rows.length === 0) return null;

  const offers: MarketplaceOffer[] = rows.map((row) => {
    const original = Number(row.original_price ?? row.price);
    const price = Number(row.price);
    return {
      productId,
      storeId: row.store_id,
      storeName: row.stores?.name ?? "Store",
      provider: row.stores?.integration_type ?? "custom",
      price,
      originalPrice: original,
      currency: row.currency,
      countryCode: row.country_code ?? "US",
      inStock: row.in_stock,
      externalUrl: row.external_url,
      discountPercent: computeDiscountPercent(price, original),
      isLowest: false,
    };
  });

  const sorted = [...offers].sort((a, b) => a.price - b.price);
  sorted[0].isLowest = true;

  const lowest = sorted[0].price;
  const highest = sorted[sorted.length - 1].price;

  return {
    productId,
    lowestPrice: lowest,
    highestPrice: highest,
    savingsPercent: computeSavingsPercent(lowest, highest),
    savingsAmount: Math.max(0, highest - lowest),
    offerCount: sorted.length,
    cheapestProvider: String(sorted[0].provider),
    offers: sorted,
  };
}

/** Refresh cached lowest_price / savings_percent on products table. */
export async function refreshProductPricingAggregates(
  supabase: SupabaseDb,
  productId: string,
  options?: { countryCode?: string; currency?: string }
): Promise<ProductPricingSummary | null> {
  const summary = await computeProductPricingSummary(supabase, productId, options);
  if (!summary) {
    await db(supabase)
      .from("products")
      .update({ offer_count: 0, lowest_price: null, highest_price: null, savings_percent: 0 })
      .eq("id", productId);
    return null;
  }

  await db(supabase)
    .from("products")
    .update({
      lowest_price: summary.lowestPrice,
      highest_price: summary.highestPrice,
      savings_percent: summary.savingsPercent,
      offer_count: summary.offerCount,
      in_stock: summary.offers.some((o) => o.inStock),
    })
    .eq("id", productId);

  return summary;
}

/** Post-merge hook: identifiers, variants, pricing aggregates. */
export async function afterProductMerge(
  supabase: SupabaseDb,
  input: {
    productId: string;
    storeId: string;
    product: ExternalProduct;
    provider?: string | null;
    countryCode?: string;
    currency?: string;
  }
): Promise<void> {
  await syncProductIdentifiers(supabase, input.productId, input.product, input.provider);
  await syncProductVariants(supabase, input.productId, input.storeId, input.product);
  await refreshProductPricingAggregates(supabase, input.productId, {
    countryCode: input.countryCode ?? input.product.countryCode,
    currency: input.currency ?? input.product.currency,
  });
}
