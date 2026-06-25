import { mapProduct } from "@/lib/database/mappers";
import { IMPORTED_PRODUCT_SYNC_STATUS } from "@/lib/catalog/imported-products";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Product, ServiceResult } from "@/lib/types/entities";

export async function getProducts(options?: {
  categorySlug?: string;
  countryCode?: string;
  limit?: number;
  offset?: number;
  /** When true, only return products imported via Phase 1 API sync. */
  importedOnly?: boolean;
}): Promise<ServiceResult<Product[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (options?.importedOnly) {
    query = query
      .eq("sync_status", IMPORTED_PRODUCT_SYNC_STATUS)
      .not("last_synced_at", "is", null)
      .not("image_url", "like", "/products/%");
  }

  if (options?.categorySlug) {
    query = query.eq("category_slug", options.categorySlug);
  }
  if (options?.countryCode) {
    query = query.eq("country_code", options.countryCode);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  return { data: (data ?? []).map(mapProduct), error: null };
}

export async function getProductBySlug(slug: string): Promise<ServiceResult<Product | null>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data ? mapProduct(data) : null, error: null };
}

export async function getProductById(id: string): Promise<ServiceResult<Product | null>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data ? mapProduct(data) : null, error: null };
}

export async function searchProducts(
  query: string,
  limit = 20,
  options?: { importedOnly?: boolean }
): Promise<ServiceResult<Product[]>> {
  if (options?.importedOnly !== false) {
    const { searchCatalogProducts } = await import("@/lib/marketplace-engine/search");
    const result = await searchCatalogProducts(query, limit);
    return { data: result.data, error: result.error };
  }

  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .or(`name.ilike.%${query}%,name_ar.ilike.%${query}%,brand.ilike.%${query}%`)
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(mapProduct), error: null };
}
