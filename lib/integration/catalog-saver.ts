import type { NormalizedCatalogItem, ProviderOffer } from "@/lib/integration/catalog-types";
import { isUsableRemoteProductImageUrl } from "@/lib/images/product-image";
import { buildProviderGlobalSku } from "@/lib/sync/import/global-catalog";
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
  providerId: string;
  store: CatalogTargetStore;
};

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

type SaveEntry = {
  item: NormalizedCatalogItem;
  offer: ProviderOffer;
  globalSku: string;
};

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
  let rejectedImages = 0;
  const BATCH = 200;

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const now = new Date().toISOString();
    const deduped = new Map<string, SaveEntry>();

    for (const item of batch) {
      if (!isUsableRemoteProductImageUrl(item.imageUrl)) {
        rejectedImages += 1;
        continue;
      }

      const offer =
        item.offers.find((entry) => entry.providerId === opts.providerId) ?? item.offers[0];
      if (!offer) continue;

      const globalSku = buildProviderGlobalSku(opts.providerId, {
        externalId: offer.externalId || item.id,
      });
      if (!globalSku || deduped.has(globalSku)) continue;
      deduped.set(globalSku, { item, offer, globalSku });
    }

    const entries = [...deduped.values()];
    if (entries.length === 0) continue;

    const productRows = entries.map(({ item, globalSku }) => ({
      global_sku: globalSku,
      title: item.title,
      description: null,
      brand: null,
      main_image: item.imageUrl || null,
      category_path: item.categorySlug || null,
      barcode: null,
      updated_at: now,
    }));

    const { data: upsertedProducts, error: prodErr } = await db
      .from("products")
      .upsert(productRows, { onConflict: "global_sku", ignoreDuplicates: false })
      .select("id, global_sku");

    if (prodErr) {
      console.error(`[catalog-saver] product upsert error (batch ${i}): ${prodErr.message}`);
      continue;
    }
    if (!upsertedProducts?.length) continue;

    const productIdBySku = new Map<string, string>();
    for (const row of upsertedProducts) {
      if (row.global_sku) productIdBySku.set(row.global_sku, row.id);
    }

    const priceRows: unknown[] = [];
    const lowestRows: unknown[] = [];

    for (const { item, offer, globalSku } of entries) {
      const productId = productIdBySku.get(globalSku);
      if (!productId) continue;

      const countryCode = (offer.countryCode || item.countryCode || "US").slice(0, 2).toUpperCase();
      const currency = (offer.currency || item.currency || "USD").slice(0, 3).toUpperCase();
      const originalPrice =
        Number.isFinite(offer.originalPrice) && offer.originalPrice > offer.price
          ? offer.originalPrice
          : offer.price;

      priceRows.push({
        product_id: productId,
        store_id: storeId,
        price: offer.price,
        original_price: originalPrice,
        currency,
        country_code: countryCode,
        external_url: offer.affiliateUrl || offer.productUrl,
        external_product_id: offer.externalId,
        in_stock: offer.inStock,
        is_current: true,
      });

      lowestRows.push({
        product_id: productId,
        country_code: countryCode,
        currency,
        product_name: item.title,
        product_slug: item.slug,
        image_url: item.imageUrl,
        emoji: item.emoji,
        lowest_price: offer.price,
        original_price: originalPrice,
        discount_percent: item.discount,
        savings_amount: Math.max(0, originalPrice - offer.price),
        store_id: storeId,
        store_name: offer.storeName || opts.store.name,
        provider: opts.providerId,
        affiliate_url: offer.affiliateUrl || offer.productUrl,
        external_url: offer.productUrl,
        is_new_low: false,
        price_recorded_at: now,
        computed_at: now,
      });
    }

    if (priceRows.length > 0) {
      const { error: priceErr } = await db
        .from("prices")
        .upsert(priceRows, {
          onConflict: "product_id,store_id,country_code,currency",
          ignoreDuplicates: false,
        });
      if (priceErr) console.error(`[catalog-saver] price upsert error: ${priceErr.message}`);
    }

    if (lowestRows.length === 0) continue;

    const { error: lowestErr } = await db
      .from("lowest_prices_today")
      .upsert(lowestRows, {
        onConflict: "product_id,country_code,currency",
        ignoreDuplicates: false,
      });
    if (lowestErr) {
      console.error(`[catalog-saver] lowest_prices_today upsert error: ${lowestErr.message}`);
      continue;
    }

    saved += lowestRows.length;
  }

  if (rejectedImages > 0) {
    console.warn(
      `[catalog-saver] rejected ${rejectedImages} ${opts.providerId} product(s) without a valid https image`,
    );
  }

  return saved;
}
