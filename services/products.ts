import { mapProduct } from "@/lib/database/mappers";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Product, ServiceResult } from "@/lib/types/entities";

export async function getProducts(options?: {
  categorySlug?: string;
  countryCode?: string;
  limit?: number;
  offset?: number;
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
  limit = 20
): Promise<ServiceResult<Product[]>> {
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
