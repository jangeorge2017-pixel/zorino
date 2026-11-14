import { NextRequest, NextResponse } from "next/server";
import { searchProductsSurface } from "@/lib/canonical/consumption/search";
import { translateSearchQuery } from "@/lib/search/query-translation";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { ListingCondition } from "@/lib/search/types";

interface ProductRow {
  id: string;
  name: string;
  price: number;
  original_price: number;
  image_url: string;
  store: string;
  store_slug: string;
  rating: number;
  review_count: number;
  category: string;
  currency: string;
  country_code: string;
  affiliate_url: string;
}

function sanitizeFilterValue(value: string): string {
  if (!value) return "";
  if (value.toLowerCase().includes("issue")) return "";
  if (["", "2", "3", "4"].includes(value)) return value;
  if (/[^0-9]/.test(value)) return "";
  return value;
}

function mapProductRow(p: ProductRow) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    originalPrice: p.original_price,
    imageSrc: p.image_url,
    store: p.store,
    storeSlug: p.store_slug,
    rating: p.rating ?? 0,
    reviewCount: p.review_count ?? 0,
    category: p.category,
    currency: p.currency,
    countryCode: p.country_code,
    affiliateUrl: p.affiliate_url,
    emoji: "",
    discount: p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0,
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
  const ratingParam = sanitizeFilterValue(url.searchParams.get("rating") || "");
  const storeParam = sanitizeFilterValue(url.searchParams.get("store") || "");
  const categoryParam = sanitizeFilterValue(url.searchParams.get("category") || "");
  const minPriceParam = sanitizeFilterValue(url.searchParams.get("minPrice") || "");
  const maxPriceParam = sanitizeFilterValue(url.searchParams.get("maxPrice") || "");

  const q = decodeURIComponent(rawQuery);
  const { translatedQuery, isArabic, isFrancoArab } = await translateSearchQuery(q);
  const searchQuery = translatedQuery || q;
  const wasTranslated = isArabic || isFrancoArab;

  try {
    // Primary: full search engine with translated query
    let results = await searchProductsSurface(searchQuery, 20);

    // Fallback 1: if translated search empty and query was translated, try original query
    const hasData = Array.isArray(results) && results.length > 0;
    if (!hasData && wasTranslated && searchQuery !== q) {
      const fallbackResults = await searchProductsSurface(q, 20);
      if (fallbackResults.length > 0) {
        results = fallbackResults;
      }
    }

    // Fallback 2: direct Supabase ilike on local catalog with translated query
    if (!hasData) {
      const supabase = createSupabaseAnonClient();
      if (supabase) {
        let query = supabase
          .from("products")
          .select("*")
          .ilike("title", `%${searchQuery}%`)
          .limit(20);

        // Apply sanitized filters if present
        if (categoryParam) query = query.eq("category_slug", categoryParam);
        if (storeParam) query = query.eq("store_slug", storeParam);
        if (ratingParam) query = query.gte("rating", parseInt(ratingParam, 10));
        if (minPriceParam) query = query.gte("price", parseFloat(minPriceParam));
        if (maxPriceParam) query = query.lte("price", parseFloat(maxPriceParam));

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
