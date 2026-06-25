import {
  computeSyncHash,
  toDealRow,
  toPriceRow,
  toProductImageRows,
  toProductRow,
  toProductSourceRow,
} from "@/lib/sync/normalizer";
import {
  findExistingCanonicalProduct,
  hasProductChanged,
} from "@/lib/sync/import/deduplication";
import {
  linkExternalProductToCanonical,
  markExternalPriceMerged,
} from "@/lib/sync/import/repository";
import type { ImportProviderId } from "@/lib/sync/providers/types";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import type { SupabaseDb } from "@/lib/supabase/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

async function resolveCategoryId(
  supabase: SupabaseDb,
  slug: string
): Promise<string | null> {
  const { data } = await db(supabase)
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

/** Merge a normalized external product into canonical products + product_sources. */
export async function mergeExternalProductToCatalog(
  supabase: SupabaseDb,
  ctx: SyncContext,
  product: ExternalProduct,
  externalProductRowId?: string | null
): Promise<{ productId: string; created: boolean; skipped?: boolean }> {
  const categoryId = await resolveCategoryId(supabase, product.categorySlug);
  const row = toProductRow(product, categoryId);
  const syncHash = computeSyncHash(product);

  const duplicate = await findExistingCanonicalProduct(supabase, ctx, product);
  let productId = duplicate?.productId;
  let created = false;

  if (
    duplicate &&
    duplicate.matchType === "external_id" &&
    !hasProductChanged(product, duplicate.existingSyncHash)
  ) {
    await db(supabase).from("product_sources").upsert(
      toProductSourceRow(productId!, ctx.storeId, product, syncHash),
      { onConflict: "store_id,external_product_id,country_code,currency" }
    );
    if (externalProductRowId) {
      await linkExternalProductToCanonical(supabase, externalProductRowId, productId!);
    }
    return { productId: productId!, created: false, skipped: true };
  }

  if (productId) {
    await db(supabase).from("products").update(row).eq("id", productId);
  } else {
    const { data: inserted, error } = await db(supabase)
      .from("products")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    productId = inserted.id;
    created = true;
  }

  await db(supabase).from("product_sources").upsert(
    toProductSourceRow(productId!, ctx.storeId, product, syncHash),
    { onConflict: "store_id,external_product_id,country_code,currency" }
  );

  if (externalProductRowId) {
    await linkExternalProductToCanonical(supabase, externalProductRowId, productId!);
  }

  return { productId: productId!, created };
}

/** Merge external price snapshot into canonical prices + append history. */
export async function mergeExternalPriceToCatalog(
  supabase: SupabaseDb,
  ctx: SyncContext,
  provider: ImportProviderId | null,
  product: ExternalProduct,
  canonicalProductId: string
): Promise<void> {
  const { data: previous } = await db(supabase)
    .from("prices")
    .select("price")
    .eq("product_id", canonicalProductId)
    .eq("store_id", ctx.storeId)
    .eq("country_code", product.countryCode)
    .eq("currency", product.currency)
    .maybeSingle();

  await db(supabase).from("prices").upsert(toPriceRow(canonicalProductId, ctx.storeId, product), {
    onConflict: "product_id,store_id,country_code,currency",
  });

  await db(supabase)
    .from("products")
    .update({ in_stock: product.inStock, last_synced_at: new Date().toISOString() })
    .eq("id", canonicalProductId);

  const prevPrice = previous?.price as number | undefined;
  if (prevPrice === undefined || prevPrice !== product.price) {
    await db(supabase).from("price_history").insert({
      product_id: canonicalProductId,
      store_id: ctx.storeId,
      price: product.price,
      currency: product.currency,
    });
  }

  if (provider) {
    await markExternalPriceMerged(
      supabase,
      provider,
      ctx.storeId,
      product.externalId,
      product.countryCode,
      product.currency
    );
  }
}

export async function mergeExternalDealToCatalog(
  supabase: SupabaseDb,
  ctx: SyncContext,
  deal: ExternalDeal,
  canonicalProductId: string
): Promise<void> {
  await db(supabase)
    .from("deals")
    .delete()
    .eq("product_id", canonicalProductId)
    .eq("store_id", ctx.storeId);
  await db(supabase).from("deals").insert(toDealRow(canonicalProductId, ctx.storeId, deal));
}

export async function mergeExternalImagesToCatalog(
  supabase: SupabaseDb,
  product: ExternalProduct,
  canonicalProductId: string
): Promise<void> {
  await db(supabase).from("product_images").delete().eq("product_id", canonicalProductId);
  await db(supabase)
    .from("product_images")
    .insert(toProductImageRows(canonicalProductId, product));
}
