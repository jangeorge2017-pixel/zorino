/**
 * Shared Supabase catalog saver used by every provider ingestion pipeline
 * (Admitad today; Noon/Jumia when their credential-gated clients go live).
 *
 * Writes the standard spine for a provider's normalized items:
 *   stores (get-or-create the provider store row)
 *   → products (upsert by slug)
 *   → prices (upsert by product_id,store_id,country_code,currency)
 *   → lowest_prices_today (upsert by product_id,country_code,currency,
 *     tagged with the real provider id + store name)
 *
 * Extracted from the Admitad ingestion's file-private saveCatalogItems so a
 * second provider does not duplicate a ~160-line DB routine. Behavior is
 * byte-identical to the original for the Admitad call site.
 */

import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { StoreIntegrationType } from "@/lib/types/entities";

type CatalogTargetStore = {
  slug: string;
  name: string;
  nameAr?: string;
  website: string;
  integrationType: StoreIntegrationType;
  logoUrl?: string;
  logoInitial?: string;
  supportedRegions: string[];
  supportedCurrencies: string[];
};

export type CatalogSaveOptions = {
  /** DB `provider` value written on lowest_prices_today rows. */
  providerId: string;
  /** Store metadata used to get-or-create the `stores` row. */
  store: CatalogTargetStore;
};

/** Resolve (or create) the provider store row and return its DB id. */
async function resolveStoreId(
  db: { from: (table: string) => unknown },
  store: CatalogTargetStore,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = db as any;
  const { data: existingStore } = await client
    .from("stores")
    .select("id")
    .eq("slug", store.slug)
    .single();

  if (existingStore) return existingStore.id;

  const { data: newStore } = await client
    .from("stores")
    .insert({
      name: store.name,
      name_ar: store.nameAr,
      slug: store.slug,
      website: store.website,
      integration_type: store.integrationType,
      logo_url: store.logoUrl,
      logo_initial: store.logoInitial,
      supported_regions: store.supportedRegions,
      supported_currencies: store.supportedCurrencies,
      is_active: true,
    })
    .select("id")
    .single();

  return newStore?.id ?? null;
}

export async function saveCatalogItemsAs(
  items: NormalizedCatalogItem[],
  opts: CatalogSaveOptions,
): Promise<number> {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.warn("[catalog-saver] Supabase not configured, skipping DB save");
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const storeId = await resolveStoreId(db, opts.store);
  if (!storeId) {
    console.error(`[catalog-saver] failed to resolve/create "${opts.store.slug}" store`);
    return 0;
  }

  let saved = 0;

  // Process in batches of 200 for Supabase upsert limits
  const BATCH = 200;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);

    // Upsert products
    const productRows = batch.map((item) => ({
      name: item.title,
      slug: item.slug,
      description: "",
      image_url: item.imageUrl,
      emoji: item.emoji,
      category_slug: item.categorySlug,
      brand: null,
      rating: item.rating || null,
      review_count: item.reviewCount,
      currency: item.currency,
      country_code: item.countryCode,
      in_stock: true,
      is_active: true,
    }));

    const { data: upsertedProducts, error: prodErr } = await db
      .from("products")
      .upsert(productRows, { onConflict: "slug", ignoreDuplicates: false })
      .select("id, slug");

    if (prodErr) {
      console.error(
        `[catalog-saver] product upsert error (batch ${i}):`,
        prodErr.message,
      );
      continue;
    }

    if (!upsertedProducts?.length) continue;

    // Build price rows
    const slugToId = new Map<string, string>();
    for (const p of upsertedProducts) slugToId.set(p.slug, p.id);

    const priceRows: unknown[] = [];
    for (const item of batch) {
      const productId = slugToId.get(item.slug);
      if (!productId) continue;
      const offer = item.offers[0];
      if (!offer) continue;

      priceRows.push({
        product_id: productId,
        store_id: storeId,
        price: offer.price,
        original_price: offer.originalPrice,
        currency: offer.currency,
        country_code: offer.countryCode,
        external_url: offer.affiliateUrl || offer.productUrl,
        external_product_id: offer.externalId,
        in_stock: offer.inStock,
        is_current: true,
      });
    }

    if (priceRows.length > 0) {
      await db
        .from("prices")
        .upsert(priceRows, {
          onConflict: "product_id,store_id,country_code,currency",
          ignoreDuplicates: false,
        });
    }

    // Upsert lowest_prices_today
    const lowestRows: unknown[] = [];
    for (const item of batch) {
      const productId = slugToId.get(item.slug);
      if (!productId) continue;
      const offer = item.offers[0];
      if (!offer) continue;

      lowestRows.push({
        product_id: productId,
        country_code: item.countryCode,
        currency: item.currency,
        product_name: item.title,
        product_slug: item.slug,
        image_url: item.imageUrl,
        emoji: item.emoji,
        lowest_price: offer.price,
        original_price: offer.originalPrice,
        discount_percent: item.discount,
        savings_amount: Math.max(0, offer.originalPrice - offer.price),
        store_id: storeId,
        store_name: offer.storeName,
        provider: opts.providerId,
        affiliate_url: offer.affiliateUrl,
        external_url: offer.productUrl,
        is_new_low: false,
        price_recorded_at: new Date().toISOString(),
        computed_at: new Date().toISOString(),
      });
    }

    if (lowestRows.length > 0) {
      await db
        .from("lowest_prices_today")
        .upsert(lowestRows, {
          onConflict: "product_id,country_code,currency",
          ignoreDuplicates: false,
        });
    }

    saved += batch.length;
  }

  return saved;
}