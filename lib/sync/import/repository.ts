import type { ImportProviderId } from "@/lib/sync/providers/types";
import type { ExternalProduct } from "@/lib/sync/types";
import {
  toExternalPriceRow,
  toExternalProductRow,
} from "@/lib/sync/import/external-normalizer";
import type { SupabaseDb } from "@/lib/supabase/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

export async function upsertExternalProduct(
  supabase: SupabaseDb,
  provider: ImportProviderId,
  storeId: string,
  product: ExternalProduct
): Promise<{ id: string; created: boolean } | null> {
  const row = toExternalProductRow(product, provider, storeId);

  const { data: existing } = await db(supabase)
    .from("external_products")
    .select("id")
    .eq("provider", provider)
    .eq("store_id", storeId)
    .eq("external_id", product.externalId)
    .eq("country_code", product.countryCode)
    .eq("currency", product.currency)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await db(supabase)
      .from("external_products")
      .update(row)
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, created: false };
  }

  const { data, error } = await db(supabase)
    .from("external_products")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, created: true };
}

export async function upsertExternalPrice(
  supabase: SupabaseDb,
  provider: ImportProviderId,
  storeId: string,
  product: ExternalProduct,
  externalProductId?: string | null,
  canonicalProductId?: string | null
): Promise<void> {
  const row = toExternalPriceRow(
    product,
    provider,
    storeId,
    externalProductId,
    canonicalProductId
  );

  await db(supabase).from("external_prices").upsert(row, {
    onConflict: "provider,store_id,external_id,country_code,currency",
  });
}

export async function linkExternalProductToCanonical(
  supabase: SupabaseDb,
  externalProductId: string,
  canonicalProductId: string
): Promise<void> {
  await db(supabase)
    .from("external_products")
    .update({ canonical_product_id: canonicalProductId })
    .eq("id", externalProductId);

  await db(supabase)
    .from("external_prices")
    .update({ canonical_product_id: canonicalProductId })
    .eq("external_product_id", externalProductId);
}

export async function markExternalPriceMerged(
  supabase: SupabaseDb,
  provider: ImportProviderId,
  storeId: string,
  externalId: string,
  countryCode: string,
  currency: string
): Promise<void> {
  await db(supabase)
    .from("external_prices")
    .update({ merged_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("store_id", storeId)
    .eq("external_id", externalId)
    .eq("country_code", countryCode)
    .eq("currency", currency);
}

export async function getExternalIdsForStore(
  supabase: SupabaseDb,
  provider: ImportProviderId,
  storeId: string
): Promise<string[]> {
  const { data } = await db(supabase)
    .from("external_products")
    .select("external_id")
    .eq("provider", provider)
    .eq("store_id", storeId);

  return (data ?? []).map((row: { external_id: string }) => row.external_id);
}
