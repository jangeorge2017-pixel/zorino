import { NextRequest, NextResponse } from "next/server";
import { searchProductsSurface } from "@/lib/canonical/consumption/search";
import { translateSearchQuery } from "@/lib/search/query-translation";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { ListingCondition } from "@/lib/search/types";

const MAX_SEARCH_LIMIT = 60;
const PRODUCT_SEARCH_SELECT =
  "id, product_name, product_slug, image_url, lowest_price, original_price, store_name, provider, affiliate_url, external_url, currency, country_code";

interface ProductRow {
  id: string;
  product_name: string;
  product_slug: string;
  image_url: string;
  lowest_price: number;
  original_price: number | null;
  store_name: string;
  provider: string | null;
  affiliate_url: string | null;
  external_url: string | null;
  currency: string;
  country_code: string | null;
}

function sanitizeFilterValue(value: string): string {
  if (!value) return "";
  if (value.toLowerCase().includes("issue")) return "";
  if (["", "2", "3", "4"].includes(value)) return value;
  if (/[^0-9]/.test(value)) return "";
  return value;
}

function mapProductRow(p: ProductRow) {
  const affiliateUrl = p.affiliate_url ?? p.external_url ?? "";
  const originalPrice = p.original_price ?? p.lowest_price;
  return {
    id: p.id,
    name: p.product_name,
    price: p.lowest_price,
    originalPrice,
    imageSrc: p.image_url,
    store: p.store_name,
    storeSlug: p.provider ?? p.store_name,
    rating: 0,
    reviewCount: 0,
    category: p.product_slug,
    currency: p.currency,
    countryCode: p.country_code ?? "",
    affiliateUrl,
    emoji: "",
    discount: originalPrice > p.lowest_price ? Math.round((1 - p.lowest_price / originalPrice) * 100) : 0,
    inStock: true,
    salesCount: 0,
    shipping: "",
    condition: "new" as ListingCondition,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawQuery = url.searchParams.get("q")?.trim() || "";
  if (!rawQuery) return NextResponse.json([]);

  // Extract and sanitize any filter params that might leak garbage
  const storeParam = sanitizeFilterValue(url.searchParams.get("store") || "");
  const minPriceParam = sanitizeFilterValue(url.searchParams.get("minPrice") || "");
  const maxPriceParam = sanitizeFilterValue(url.searchParams.get("maxPrice") || "");

  const q = decodeURIComponent(rawQuery);
  const { translatedQuery, isArabic, isFrancoArab } = await translateSearchQuery(q);
  const searchQuery = translatedQuery || q;
  const wasTranslated = isArabic || isFrancoArab;

  try {
    // Primary: full search engine with translated query
    let results = await searchProductsSurface(searchQuery, MAX_SEARCH_LIMIT);

    // Fallback 1: if translated search empty and query was translated, try original query
    const hasData = Array.isArray(results) && results.length > 0;
    if (!hasData && wasTranslated && searchQuery !== q) {
      const fallbackResults = await searchProductsSurface(q, MAX_SEARCH_LIMIT);
      if (fallbackResults.length > 0) {
        results = fallbackResults;
      }
    }

    // Fallback 2: direct Supabase ilike on local catalog with translated query
    if (!hasData) {
      const supabase = createSupabaseAnonClient();
      if (supabase) {
        let query = supabase
          .from("lowest_prices_today")
          .select(PRODUCT_SEARCH_SELECT)
          .ilike("product_name", `%${searchQuery}%`)
          .limit(MAX_SEARCH_LIMIT);

        // Apply sanitized filters if present
        if (storeParam) query = query.or(`provider.ilike.%${storeParam}%,store_name.ilike.%${storeParam}%`);
        if (minPriceParam) query = query.gte("lowest_price", parseFloat(minPriceParam));
        if (maxPriceParam) query = query.lte("lowest_price", parseFloat(maxPriceParam));

        const { data: localResults } = await query;

        if (localResults && localResults.length > 0) {
          results = localResults.map(mapProductRow);
        }
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("[api/products/search] Search failed:", error);
    return NextResponse.json([]);
  }
}
