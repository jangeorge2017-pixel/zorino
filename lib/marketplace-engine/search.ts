import { mapProduct } from "@/lib/database/mappers";
import type { ProductRow } from "@/lib/database/types";
import { IMPORTED_PRODUCT_SYNC_STATUS } from "@/lib/catalog/imported-products";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types/entities";

function sanitizeSearchQuery(query: string): string {
  return query.trim().replace(/[^\w\s-]/g, " ").slice(0, 120);
}

/** Indexed full-text search with ILIKE fallback when RPC/index unavailable. */
export async function searchCatalogProducts(
  query: string,
  limit = 20
): Promise<{ data: Product[]; error: string | null; indexed: boolean }> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: [], error: "Supabase not configured", indexed: false };

  const sanitized = sanitizeSearchQuery(query);
  if (!sanitized) return { data: [], error: null, indexed: false };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: indexedRows, error: rpcError } = await (supabase as any).rpc(
    "search_products_indexed",
    { search_query: sanitized, result_limit: limit }
  );

  if (!rpcError && indexedRows?.length) {
    return {
      data: (indexedRows as ProductRow[]).map(mapProduct),
      error: null,
      indexed: true,
    };
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("sync_status", IMPORTED_PRODUCT_SYNC_STATUS)
    .not("last_synced_at", "is", null)
    .or(
      `name.ilike.%${sanitized}%,name_ar.ilike.%${sanitized}%,brand.ilike.%${sanitized}%,description.ilike.%${sanitized}%`
    )
    .order("lowest_price", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) return { data: [], error: error.message, indexed: false };
  return {
    data: ((data ?? []) as ProductRow[]).map(mapProduct),
    error: null,
    indexed: false,
  };
}
