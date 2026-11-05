import { NextRequest, NextResponse } from "next/server";
import { searchProductsSurface } from "@/lib/canonical/consumption/search";
import { translateSearchQuery } from "@/lib/search/query-translation";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

interface ProductRow { id: string; name: string; price: number; original_price: number; image_url: string; store: string; store_slug: string; rating: number; review_count: number; category: string; currency: string; country_code: string; affiliate_url: string; }

export async function GET(req: NextRequest) {
  const rawQuery = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (!rawQuery) return NextResponse.json([]);

  const q = decodeURIComponent(rawQuery);
  const { translatedQuery, isArabic, isFrancoArab } = await translateSearchQuery(q);
  const searchQuery = translatedQuery || q;
  const wasTranslated = isArabic || isFrancoArab;

  try {
    // Use the full search engine (fans out to all providers + local catalog)
    let results = await searchProductsSurface(searchQuery, 20);

    // Fallback: if translated search returns no results and query was translated,
    // search with original query
    const hasData = Array.isArray(results) && results.length > 0;
    if (!hasData && wasTranslated && searchQuery !== q) {
      const fallbackResults = await searchProductsSurface(q, 20);
      if (fallbackResults.length > 0) {
        results = fallbackResults;
      }
    }

    // Additional fallback: direct Supabase ilike query for local catalog
    // Ensures local products matching "iphone" or "ايفون" are found even if
    // the search engine pipeline misses them
    if (!hasData) {
      const supabase = createSupabaseAnonClient();
      if (supabase) {
        const { data: localResults } = await supabase
          .from("products")
          .select("*")
          .ilike("title", `%${searchQuery}%`)
          .limit(20);
        
        if (localResults && localResults.length > 0) {
          results = localResults.map((p: ProductRow) => ({
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
            condition: "new",
          }));
        }
      }
    }

    return NextResponse.json(results.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
      imageSrc: p.imageSrc,
      store: p.store,
      storeSlug: p.storeSlug,
      rating: p.rating ?? 0,
      reviewCount: p.reviewCount ?? 0,
      category: p.category,
      currency: p.currency,
      countryCode: p.countryCode,
      affiliateUrl: p.affiliateUrl,
      emoji: p.emoji ?? "",
      discount: p.discount ?? 0,
      inStock: p.inStock ?? true,
      salesCount: p.salesCount ?? 0,
      shipping: p.shipping ?? "",
      condition: p.condition ?? "new",
    })));
  } catch (error) {
    console.error("[api/products/search] Search failed:", error);
    return NextResponse.json([]);
  }
}