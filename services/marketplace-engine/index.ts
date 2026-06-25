export {
  searchCatalogProducts,
  computeProductPricingSummary,
  refreshProductPricingAggregates,
  afterProductMerge,
  findUniversalDuplicateProduct,
  computeSavingsPercent,
  computeDiscountPercent,
  ACTIVE_MARKETPLACE_PROVIDERS,
  FUTURE_MARKETPLACE_PROVIDERS,
} from "@/lib/marketplace-engine";

export type {
  MarketplaceOffer,
  ProductPricingSummary,
  ProductVariant,
  PriceChangeRecord,
} from "@/lib/marketplace-engine";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { refreshProductPricingAggregates } from "@/lib/marketplace-engine";

/** Batch refresh pricing aggregates for all synced products. */
export async function refreshUniversalCatalogAggregates(options?: {
  limit?: number;
}): Promise<{ refreshed: number; error?: string }> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { refreshed: 0, error: "Supabase not configured" };

  const { data: products, error } = await supabase
    .from("products")
    .select("id")
    .eq("sync_status", "synced")
    .eq("is_active", true)
    .limit(options?.limit ?? 500);

  if (error) return { refreshed: 0, error: error.message };

  let refreshed = 0;
  for (const row of products ?? []) {
    await refreshProductPricingAggregates(supabase, (row as { id: string }).id);
    refreshed++;
  }

  return { refreshed };
}
