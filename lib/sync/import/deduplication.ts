import { computeSyncHash } from "@/lib/sync/normalizer";
import type { ExternalProduct, SyncContext } from "@/lib/sync/types";
import type { SupabaseDb } from "@/lib/supabase/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export type DuplicateMatch = {
  productId: string;
  matchType: "external_id" | "slug" | "title";
  existingSyncHash?: string | null;
};

/** Find an existing canonical product to avoid duplicate listings across providers. */
export async function findExistingCanonicalProduct(
  supabase: SupabaseDb,
  ctx: SyncContext,
  product: ExternalProduct
): Promise<DuplicateMatch | null> {
  const { data: byExternal } = await db(supabase)
    .from("product_sources")
    .select("product_id, sync_hash")
    .eq("store_id", ctx.storeId)
    .eq("external_product_id", product.externalId)
    .eq("country_code", product.countryCode)
    .eq("currency", product.currency)
    .maybeSingle();

  if (byExternal?.product_id) {
    return {
      productId: byExternal.product_id,
      matchType: "external_id",
      existingSyncHash: byExternal.sync_hash,
    };
  }

  const { data: bySlug } = await db(supabase)
    .from("products")
    .select("id")
    .eq("slug", product.slug)
    .maybeSingle();

  if (bySlug?.id) {
    return { productId: bySlug.id, matchType: "slug" };
  }

  const titleKey = normalizeTitleKey(product.title);
  if (titleKey.length < 12) return null;

  const { data: candidates } = await db(supabase)
    .from("products")
    .select("id, name, brand")
    .eq("sync_status", "synced")
    .eq("is_active", true)
    .ilike("name", `%${titleKey.slice(0, 40)}%`)
    .limit(30);

  for (const candidate of candidates ?? []) {
    if (normalizeTitleKey(candidate.name) !== titleKey) continue;

    const brandMatch =
      !product.brand ||
      !candidate.brand ||
      product.brand.toLowerCase() === candidate.brand.toLowerCase();

    if (brandMatch) {
      return { productId: candidate.id, matchType: "title" };
    }
  }

  return null;
}

export function hasProductChanged(
  product: ExternalProduct,
  existingSyncHash?: string | null
): boolean {
  if (!existingSyncHash) return true;
  return computeSyncHash(product) !== existingSyncHash;
}
