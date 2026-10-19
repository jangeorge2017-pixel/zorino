import type { ExternalProduct } from "@/lib/sync/types";
import type { SupabaseDb } from "@/lib/supabase/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

/** Store identity written into `product_offers.store_name` for AliExpress. */
export const ALIEXPRESS_GLOBAL_STORE_NAME = "AliExpress";
/** Network identity written into `product_offers.network_name`. */
export const DIRECT_NETWORK_NAME = "Direct";
/** Country scope of the global multi-store offer rows. */
export const GLOBAL_OFFER_COUNTRY_CODE = "GLOBAL";

export type GlobalOfferIdentity = {
  storeName: string;
  networkName: string;
  countryCode: string;
};

/**
 * Step 1+2 of the global-schema write: upsert the canonical product row keyed
 * by `global_sku` (the provider's external product id) and return its `id`.
 * The upsert returns the row whether it was inserted or updated, so the id is
 * always available without a second read.
 *
 * NOTE: column names match the LIVE `products` schema (`title`, `main_image`,
 * `barcode`) — verified against the deployed database. The migration-001
 * `name`/`image_url`/`slug` columns do not exist on the live table.
 */
export async function upsertGlobalProduct(
  supabase: SupabaseDb,
  product: ExternalProduct,
): Promise<string> {
  const row = {
    global_sku: product.externalId,
    title: product.title,
    description: product.description ?? product.title,
    brand: product.brand ?? null,
    main_image: product.imageUrl || null,
    category_path: product.categorySlug || null,
    barcode: product.barcode || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db(supabase)
    .from("products")
    .upsert(row, { onConflict: "global_sku" })
    .select("id")
    .single();
  if (error) throw error;
  if (!data?.id) throw new Error("global product upsert returned no id");

  return data.id as string;
}

/**
 * Step 3 of the global-schema write: upsert the store offer keyed by the
 * composite unique (product_id, store_name, country_code) so repeated syncs
 * never create duplicate rows for the same store/country.
 *
 * NOTE: column names match the LIVE `product_offers` schema — `last_updated`
 * (not `updated_at`), and `affiliate_url` is NOT NULL, so a destination URL is
 * mandatory for every offer.
 */
export async function upsertProductOffer(
  supabase: SupabaseDb,
  productId: string,
  product: ExternalProduct,
  identity: GlobalOfferIdentity,
): Promise<void> {
  const affiliateUrl = product.affiliateUrl ?? product.productUrl ?? null;
  if (!affiliateUrl) {
    throw new Error(
      `product_offers.affiliate_url is required (product ${product.externalId})`,
    );
  }

  const row = {
    product_id: productId,
    store_name: identity.storeName,
    network_name: identity.networkName,
    country_code: identity.countryCode,
    price: product.price,
    currency: product.currency,
    affiliate_url: affiliateUrl,
    // Only record a merchant product page distinct from the affiliate link.
    product_store_url:
      product.productUrl && product.productUrl !== affiliateUrl
        ? product.productUrl
        : null,
    in_stock: product.inStock,
    last_updated: new Date().toISOString(),
  };

  const { error } = await db(supabase)
    .from("product_offers")
    .upsert(row, {
      onConflict: "product_id,store_name,country_code",
      ignoreDuplicates: false,
    });
  if (error) throw error;
}

/**
 * Full global-schema write for one imported product: canonical product upsert
 * (global_sku) followed by the per-store offer upsert.
 */
export async function syncGlobalProductOffer(
  supabase: SupabaseDb,
  product: ExternalProduct,
  identity: GlobalOfferIdentity,
): Promise<string> {
  const productId = await upsertGlobalProduct(supabase, product);
  await upsertProductOffer(supabase, productId, product, identity);
  return productId;
}

/** AliExpress offer identity in the global multi-store schema. */
export const ALIEXPRESS_GLOBAL_OFFER_IDENTITY: GlobalOfferIdentity = {
  storeName: ALIEXPRESS_GLOBAL_STORE_NAME,
  networkName: DIRECT_NETWORK_NAME,
  countryCode: GLOBAL_OFFER_COUNTRY_CODE,
};
