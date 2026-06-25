import { computeSyncHash } from "@/lib/sync/normalizer";
import type { ExternalProduct, SyncContext } from "@/lib/sync/types";
import type { SupabaseDb } from "@/lib/supabase/config";
import {
  findUniversalDuplicateProduct,
  logProductMatch,
} from "@/lib/marketplace-engine/deduplication";

export { normalizeTitleKey } from "@/lib/marketplace-engine/utils";

export type DuplicateMatch = {
  productId: string;
  matchType: "external_id" | "identifier" | "slug" | "title" | "fuzzy_title";
  existingSyncHash?: string | null;
  confidence?: number;
};

/** Find an existing canonical product to avoid duplicate listings across providers. */
export async function findExistingCanonicalProduct(
  supabase: SupabaseDb,
  ctx: SyncContext,
  product: ExternalProduct,
  options?: { externalProductRowId?: string | null }
): Promise<DuplicateMatch | null> {
  const match = await findUniversalDuplicateProduct(supabase, {
    storeId: ctx.storeId,
    product,
    provider: ctx.integrationType,
  });

  if (!match) return null;

  if (match.matchType !== "external_id") {
    await logProductMatch(supabase, {
      canonicalProductId: match.productId,
      externalProductId: options?.externalProductRowId ?? null,
      provider: ctx.integrationType,
      match,
      metadata: { title: product.title, externalId: product.externalId },
    });
  }

  return {
    productId: match.productId,
    matchType: match.matchType,
    existingSyncHash: match.existingSyncHash,
    confidence: match.confidence,
  };
}

export function hasProductChanged(
  product: ExternalProduct,
  existingSyncHash?: string | null
): boolean {
  if (!existingSyncHash) return true;
  return computeSyncHash(product) !== existingSyncHash;
}
