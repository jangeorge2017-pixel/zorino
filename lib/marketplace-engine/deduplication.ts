import type { ExternalProduct } from "@/lib/sync/types";
import type { SupabaseDb } from "@/lib/supabase/config";
import type { DuplicateMatchResult } from "@/lib/marketplace-engine/types";
import {
  DUPLICATE_MATCH_CONFIDENCE,
  FUZZY_TITLE_THRESHOLD,
} from "@/lib/marketplace-engine/config";
import {
  extractProductIdentifiers,
  normalizeTitleKey,
  titleSimilarity,
} from "@/lib/marketplace-engine/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

/** Universal duplicate detection across AliExpress, eBay, CJ and future marketplaces. */
export async function findUniversalDuplicateProduct(
  supabase: SupabaseDb,
  input: {
    storeId: string;
    product: ExternalProduct;
    provider?: string | null;
  }
): Promise<DuplicateMatchResult | null> {
  const { storeId, product, provider } = input;

  const { data: byExternal } = await db(supabase)
    .from("product_sources")
    .select("product_id, sync_hash")
    .eq("store_id", storeId)
    .eq("external_product_id", product.externalId)
    .eq("country_code", product.countryCode)
    .eq("currency", product.currency)
    .maybeSingle();

  if (byExternal?.product_id) {
    return {
      productId: byExternal.product_id,
      matchType: "external_id",
      confidence: DUPLICATE_MATCH_CONFIDENCE.external_id,
      existingSyncHash: byExternal.sync_hash,
    };
  }

  const identifiers = extractProductIdentifiers(product);
  for (const identifier of identifiers) {
    const { data: match } = await db(supabase)
      .from("product_identifiers")
      .select("product_id")
      .eq("identifier_type", identifier.type)
      .eq("identifier_value", identifier.value)
      .maybeSingle();

    if (match?.product_id) {
      return {
        productId: match.product_id,
        matchType: "identifier",
        confidence: DUPLICATE_MATCH_CONFIDENCE.identifier,
      };
    }
  }

  const { data: bySlug } = await db(supabase)
    .from("products")
    .select("id")
    .eq("slug", product.slug)
    .maybeSingle();

  if (bySlug?.id) {
    return {
      productId: bySlug.id,
      matchType: "slug",
      confidence: DUPLICATE_MATCH_CONFIDENCE.slug,
    };
  }

  const titleKey = normalizeTitleKey(product.title);
  if (titleKey.length < 12) return null;

  const { data: candidates } = await db(supabase)
    .from("products")
    .select("id, name, brand")
    .eq("sync_status", "synced")
    .eq("is_active", true)
    .ilike("name", `%${titleKey.slice(0, 40)}%`)
    .limit(40);

  for (const candidate of candidates ?? []) {
    const exactTitle = normalizeTitleKey(candidate.name) === titleKey;
    const brandMatch =
      !product.brand ||
      !candidate.brand ||
      product.brand.toLowerCase() === candidate.brand.toLowerCase();

    if (exactTitle && brandMatch) {
      return {
        productId: candidate.id,
        matchType: "title",
        confidence: DUPLICATE_MATCH_CONFIDENCE.title,
      };
    }

    const similarity = titleSimilarity(product.title, candidate.name);
    if (similarity >= FUZZY_TITLE_THRESHOLD && brandMatch) {
      return {
        productId: candidate.id,
        matchType: "fuzzy_title",
        confidence: similarity,
      };
    }
  }

  void provider;
  return null;
}

export async function logProductMatch(
  supabase: SupabaseDb,
  input: {
    canonicalProductId: string;
    externalProductId?: string | null;
    provider?: string | null;
    match: DuplicateMatchResult;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await db(supabase).from("product_match_log").insert({
    canonical_product_id: input.canonicalProductId,
    external_product_id: input.externalProductId ?? null,
    provider: input.provider ?? null,
    match_type: input.match.matchType,
    confidence: input.match.confidence,
    metadata: input.metadata ?? {},
  });
}
