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
  limitOrOptions?: number | { page?: number; limit?: number; importedOnly?: boolean },
  maybeOptions?: { importedOnly?: boolean }
): Promise<
  | ServiceResult<Product[]>
  | ServiceResult<{
      data: Product[];
      total: number;
      page: number;
      limit: number;
      total_pages: number;
    }>
> {
  const isPaginatedOptions =
    typeof limitOrOptions === "object" && limitOrOptions !== null;
  const limit =
    typeof limitOrOptions === "number"
      ? limitOrOptions
      : isPaginatedOptions
        ? limitOrOptions.limit ?? 20
        : 20;
  const page =
    isPaginatedOptions && limitOrOptions.page ? Math.max(1, limitOrOptions.page) : 1;
  const importedOnly =
    isPaginatedOptions && limitOrOptions.importedOnly !== undefined
      ? limitOrOptions.importedOnly
      : maybeOptions?.importedOnly;

  if (importedOnly !== false && !isPaginatedOptions) {
    const { searchCatalogProducts } = await import("@/lib/marketplace-engine/search");
    const result = await searchCatalogProducts(query, limit);
    return { data: result.data, error: result.error };
  }

  if (importedOnly !== false && isPaginatedOptions) {
    const { searchCatalogProducts } = await import("@/lib/marketplace-engine/search");
    const result = await searchCatalogProducts(query, limit);
    const total = result.data?.length ?? 0;
    const total_pages = Math.max(1, Math.ceil(total / limit));
    return {
      data: {
        data: result.data ?? [],
        total,
        page,
        limit,
        total_pages,
      },
      error: result.error,
    };
  }

  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    if (isPaginatedOptions) {
      return {
        data: { data: [], total: 0, page, limit, total_pages: 0 },
        error: "Supabase not configured",
      };
    }
    return { data: [], error: "Supabase not configured" };
  }

  const { sanitizeSearchQuery } = await import("@/lib/marketplace-engine/search");
  const sanitized = sanitizeSearchQuery(query);
  if (!sanitized) {
    if (isPaginatedOptions) {
      return {
        data: { data: [], total: 0, page, limit, total_pages: 0 },
        error: null,
      };
    }
    return { data: [], error: null };
  }

  if (isPaginatedOptions) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(query);

    if (sanitized && !hasArabic) {
      let queryFTS = supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .textSearch("name", sanitized, {
          type: "websearch",
          config: "english",
        });

      const { data: ftsData, error: ftsError, count: ftsCount } = await queryFTS.order("name").range(from, to);

      if (!ftsError && (ftsCount ?? 0) > 0 && (ftsData?.length ?? 0) > 0) {
        const total = ftsCount ?? 0;
        const total_pages = Math.max(1, Math.ceil(total / limit));
        const mapped = (ftsData ?? []).map(mapProduct);

        return {
          data: {
            data: mapped,
            total,
            page,
            limit,
            total_pages,
          },
          error: null,
        };
      }
    }

    let fallbackQuery = supabase
      .from("products")
      .select("*", { count: "exact" })
      .eq("is_active", true);

    if (sanitized || query.trim()) {
      const searchTerm = sanitized || query.trim();
      fallbackQuery = fallbackQuery.ilike("name", `%${searchTerm}%`);
    }

    const { data, error, count } = await fallbackQuery.order("name").range(from, to);

    if (error) {
      return {
        data: { data: [], total: 0, page, limit, total_pages: 0 },
        error: error.message,
      };
    }

    const total = count ?? 0;
    const total_pages = Math.max(1, Math.ceil(total / limit));
    const mapped = (data ?? []).map(mapProduct);

    return {
      data: {
        data: mapped,
        total,
        page,
        limit,
        total_pages,
      },
      error: null,
    };
  }

  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(query);

  if (sanitized && !hasArabic) {
    let ftsQuery = supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .textSearch("name", sanitized, {
        type: "websearch",
        config: "english",
      });

    const { data: ftsData, error: ftsError } = await ftsQuery.limit(limit);

    if (!ftsError && (ftsData?.length ?? 0) > 0) {
      return { data: (ftsData ?? []).map(mapProduct), error: null };
    }
  }

  let fallbackQuery = supabase
    .from("products")
    .select("*")
    .eq("is_active", true);

  if (sanitized || query.trim()) {
    const searchTerm = sanitized || query.trim();
    fallbackQuery = fallbackQuery.ilike("name", `%${searchTerm}%`);
  }

  const { data, error } = await fallbackQuery.limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(mapProduct), error: null };
}
