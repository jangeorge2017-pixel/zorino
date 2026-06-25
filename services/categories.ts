import type { Database } from "@/lib/database/types";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Category as CategoryEntity, ServiceResult } from "@/lib/types/entities";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export type Category = CategoryEntity;

export async function getCategories(): Promise<ServiceResult<Category[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) return { data: [], error: error.message };

  return {
    data: ((data ?? []) as CategoryRow[]).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      nameAr: row.name_ar,
      icon: row.icon,
      parentId: row.parent_id,
      sortOrder: row.sort_order,
      productCount: row.product_count,
      isActive: row.is_active,
    })),
    error: null,
  };
}

export async function getCategoryBySlug(slug: string): Promise<ServiceResult<Category | null>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  const row = data as CategoryRow;
  return {
    data: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      nameAr: row.name_ar,
      icon: row.icon,
      parentId: row.parent_id,
      sortOrder: row.sort_order,
      productCount: row.product_count,
      isActive: row.is_active,
    },
    error: null,
  };
}
