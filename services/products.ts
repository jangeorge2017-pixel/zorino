import { mapProduct } from "@/lib/database/mappers";
import { IMPORTED_PRODUCT_SYNC_STATUS } from "@/lib/catalog/imported-products";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { ProductRow } from "@/lib/database/types";
import type { Product, ServiceResult } from "@/lib/types/entities";

const PRODUCT_COLUMNS =
  "id, name, name_ar, slug, description, image_url, emoji, category_slug, brand, rating, review_count, currency, country_code, in_stock, tags, is_active, last_synced_at";
const PAGE_SIZE = 100;

type ProductQueryResult = {
  rows: ProductRow[];
  count: number | null;
  error: string | null;
};

async function fetchProductRows(
  build: (from: number, to: number) => PromiseLike<unknown>,
  from: number,
  limit: number
): Promise<ProductQueryResult> {
  const rows: ProductRow[] = [];
  let count: number | null = null;

  for (let cursor = from; rows.length < limit; cursor += PAGE_SIZE) {
    const size = Math.min(PAGE_SIZE, limit - rows.length);
    const result = (await build(cursor, cursor + size - 1)) as {
      data: ProductRow[] | null;
      count: number | null;
      error: { message: string } | null;
    };

    if (result.error) return { rows: [], count: null, error: result.error.message };
    if (result.count != null) count = result.count;

    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < size) break;
  }

  return { rows, count, error: null };
}

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

  const requestedLimit = options?.limit ?? (options?.offset !== undefined ? 20 : PAGE_SIZE);
  const limit = Math.min(PAGE_SIZE, Math.max(1, Math.trunc(requestedLimit) || PAGE_SIZE));
  const offset = Math.max(0, Math.trunc(options?.offset ?? 0) || 0);

  const { rows, error } = await fetchProductRows(
    (from, to) => {
      let query = supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
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

      return query.range(from, to);
    },
    offset,
    limit
  );

  if (error) return { data: [], error };
  return { data: rows.map(mapProduct), error: null };
}

export async function getProductBySlug(slug: string): Promise<ServiceResult<Product | null>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data ? mapProduct(data as ProductRow) : null, error: null };
}

export async function getProductById(id: string): Promise<ServiceResult<Product | null>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data ? mapProduct(data as ProductRow) : null, error: null };
}

export async function searchProducts(
  query: string,
  limitOrOptions?: number | { page?: number; limit?: number; importedOnly?: boolean; forceIlike?: boolean },
  maybeOptions?: { importedOnly?: boolean; forceIlike?: boolean }
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
  const requestedLimit =
    typeof limitOrOptions === "number"
      ? limitOrOptions
      : isPaginatedOptions
        ? limitOrOptions.limit ?? 20
        : 20;
  const limit = Math.min(PAGE_SIZE, Math.max(1, Math.trunc(requestedLimit) || 20));
  const page =
    isPaginatedOptions && limitOrOptions.page ? Math.max(1, limitOrOptions.page) : 1;
  const importedOnly =
    isPaginatedOptions && limitOrOptions.importedOnly !== undefined
      ? limitOrOptions.importedOnly
      : maybeOptions?.importedOnly;
  const forceIlike =
    isPaginatedOptions && "forceIlike" in limitOrOptions && limitOrOptions.forceIlike !== undefined
      ? limitOrOptions.forceIlike
      : maybeOptions?.forceIlike === true;

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
    const isArabic = /[\u0600-\u06FF]/.test(query);

    if (forceIlike || isArabic) {
      const { rows, count, error } = await fetchProductRows(
        (chunkFrom, chunkTo) => {
          let ilikeQuery = supabase
            .from("products")
            .select(PRODUCT_COLUMNS, { count: "exact" })
            .eq("is_active", true);

          if (query.trim()) {
            ilikeQuery = ilikeQuery.ilike("name", `%${query.trim()}%`);
          }

          return ilikeQuery.order("name").range(chunkFrom, chunkTo);
        },
        from,
        limit
      );

      if (error) {
        return {
          data: { data: [], total: 0, page, limit, total_pages: 0 },
          error,
        };
      }

      const total = count ?? 0;
      const total_pages = Math.max(1, Math.ceil(total / limit));

      return {
        data: {
          data: rows.map(mapProduct),
          total,
          page,
          limit,
          total_pages,
        },
        error: null,
      };
    }

    if (sanitized) {
      const { rows: ftsData, count: ftsCount, error: ftsError } = await fetchProductRows(
        (chunkFrom, chunkTo) =>
          supabase
            .from("products")
            .select(PRODUCT_COLUMNS, { count: "exact" })
            .eq("is_active", true)
            .textSearch("name", sanitized, {
              type: "websearch",
              config: "english",
            })
            .order("name")
            .range(chunkFrom, chunkTo),
        from,
        limit
      );

      if (!ftsError && (ftsCount ?? 0) > 0 && ftsData.length > 0) {
        const total = ftsCount ?? 0;
        const total_pages = Math.max(1, Math.ceil(total / limit));

        return {
          data: {
            data: ftsData.map(mapProduct),
            total,
            page,
            limit,
            total_pages,
          },
          error: null,
        };
      }
    }

    const { rows, count, error } = await fetchProductRows(
      (chunkFrom, chunkTo) => {
        let fallbackQuery = supabase
          .from("products")
          .select(PRODUCT_COLUMNS, { count: "exact" })
          .eq("is_active", true);

        if (query.trim()) {
          fallbackQuery = fallbackQuery.ilike("name", `%${query.trim()}%`);
        }

        return fallbackQuery.order("name").range(chunkFrom, chunkTo);
      },
      from,
      limit
    );

    if (error) {
      return {
        data: { data: [], total: 0, page, limit, total_pages: 0 },
        error,
      };
    }

    const total = count ?? 0;
    const total_pages = Math.max(1, Math.ceil(total / limit));

    return {
      data: {
        data: rows.map(mapProduct),
        total,
        page,
        limit,
        total_pages,
      },
      error: null,
    };
  }

  const isArabicNonPaginated = /[\u0600-\u06FF]/.test(query);

  if (forceIlike || isArabicNonPaginated) {
    const { rows, error } = await fetchProductRows(
      (chunkFrom, chunkTo) => {
        let ilikeQuery = supabase
          .from("products")
          .select(PRODUCT_COLUMNS)
          .eq("is_active", true);

        if (query.trim()) {
          ilikeQuery = ilikeQuery.ilike("name", `%${query.trim()}%`);
        }

        return ilikeQuery.range(chunkFrom, chunkTo);
      },
      0,
      limit
    );

    if (error) return { data: [], error };
    return { data: rows.map(mapProduct), error: null };
  }

  if (sanitized) {
    const { rows: ftsData, error: ftsError } = await fetchProductRows(
      (chunkFrom, chunkTo) =>
        supabase
          .from("products")
          .select(PRODUCT_COLUMNS)
          .eq("is_active", true)
          .textSearch("name", sanitized, {
            type: "websearch",
            config: "english",
          })
          .range(chunkFrom, chunkTo),
      0,
      limit
    );

    if (!ftsError && ftsData.length > 0) {
      return { data: ftsData.map(mapProduct), error: null };
    }
  }

  const { rows, error } = await fetchProductRows(
    (chunkFrom, chunkTo) => {
      let fallbackQuery = supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("is_active", true);

      if (query.trim()) {
        fallbackQuery = fallbackQuery.ilike("name", `%${query.trim()}%`);
      }

      return fallbackQuery.range(chunkFrom, chunkTo);
    },
    0,
    limit
  );

  if (error) return { data: [], error };
  return { data: rows.map(mapProduct), error: null };
}
