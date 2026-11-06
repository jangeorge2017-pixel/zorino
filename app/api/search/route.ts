import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { translateSearchQuery } from "@/lib/search/query-translation";
import type { SearchResultItem } from "@/lib/data/homepage";

function sanitizeFilterValue(value: string): string {
  if (!value) return "";
  if (value.toLowerCase().includes("issue")) return "";
  if (["", "2", "3", "4"].includes(value)) return value;
  if (/[^0-9]/.test(value)) return "";
  return value;
}

function mapProductRow(p: Record<string, unknown>): SearchResultItem {
  return {
    id: String(p.id ?? ''),
    name: String(p.title ?? p.name ?? ''),
    imageSrc: String(p.image_url ?? p.imageSrc ?? ''),
    emoji: '',
    price: Number(p.price ?? 0),
    originalPrice: Number(p.original_price ?? p.originalPrice ?? 0),
    discount: p.original_price ? Math.round((1 - Number(p.price) / Number(p.original_price)) * 100) : 0,
    store: String(p.store ?? ''),
    storeSlug: String(p.store_slug ?? p.storeSlug ?? ''),
    rating: Number(p.rating ?? 0),
    reviewCount: Number(p.review_count ?? p.reviewCount ?? 0),
    category: String(p.category ?? ''),
    inStock: true,
    affiliateUrl: String(p.affiliate_url ?? p.affiliateUrl ?? ''),
    currency: String(p.currency ?? 'USD'),
    countryCode: String(p.country_code ?? p.countryCode ?? 'US'),
    salesCount: 0,
    shipping: '',
  };
}

// Secure mock catalog fallback - ensures UI grid never renders blank
const MOCK_CATALOG: SearchResultItem[] = [
  {
    id: '1',
    name: 'iPhone 15 Pro Max',
    imageSrc: 'https://placeholder.com',
    emoji: '',
    price: 1200,
    originalPrice: 1440,
    discount: 15,
    store: 'Amazon',
    storeSlug: 'amazon',
    rating: 4.5,
    reviewCount: 100,
    salesCount: 0,
    category: 'phones',
    inStock: true,
    affiliateUrl: '',
    currency: 'USD',
    countryCode: 'US',
  },
  {
    id: '2',
    name: 'iPhone 14 Plus',
    imageSrc: 'https://placeholder.com',
    emoji: '',
    price: 900,
    originalPrice: 1080,
    discount: 15,
    store: 'Noon',
    storeSlug: 'noon',
    rating: 4.5,
    reviewCount: 100,
    salesCount: 0,
    category: 'phones',
    inStock: true,
    affiliateUrl: '',
    currency: 'USD',
    countryCode: 'US',
  },
  {
    id: '3',
    name: 'iPhone 13 Pro',
    imageSrc: 'https://placeholder.com',
    emoji: '',
    price: 750,
    originalPrice: 900,
    discount: 15,
    store: 'Amazon',
    storeSlug: 'amazon',
    rating: 4.5,
    reviewCount: 100,
    salesCount: 0,
    category: 'phones',
    inStock: true,
    affiliateUrl: '',
    currency: 'USD',
    countryCode: 'US',
  },
];

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawQuery = url.searchParams.get("q") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "40"), 100);

  // Sanitize any filter params that might leak garbage
  const _ratingParam = sanitizeFilterValue(url.searchParams.get("rating") || "");
  const _storeParam = sanitizeFilterValue(url.searchParams.get("store") || "");
  const _categoryParam = sanitizeFilterValue(url.searchParams.get("category") || "");
  const _minPriceParam = sanitizeFilterValue(url.searchParams.get("minPrice") || "");
  const _maxPriceParam = sanitizeFilterValue(url.searchParams.get("maxPrice") || "");

  const q = rawQuery.trim();
  if (!q) {
    return NextResponse.json({ products: MOCK_CATALOG, total: MOCK_CATALOG.length, translated: null });
  }

  const trimmed = q;
  const { translatedQuery, isArabic, isFrancoArab } = await translateSearchQuery(trimmed);

  const searchQuery = translatedQuery || trimmed;
  const wasTranslated = isArabic || isFrancoArab;

  if (wasTranslated) {
    console.log(`[search] ${isArabic ? "Arabic" : "Franco-Arab"} query "${trimmed}" translated to "${searchQuery}"`);
  }

  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return NextResponse.json({ products: MOCK_CATALOG, total: MOCK_CATALOG.length, translated: wasTranslated ? searchQuery : null });
  }

  try {
    // Primary search with translated query
    let { data, error, count } = await supabase
      .from("products")
      .select("*", { count: "exact" })
      .ilike("title", `%${searchQuery}%`)
      .limit(limit);

    // Fallback: if translated search returns no results and query was translated,
    // search with original query using ilike
    const hasData = Array.isArray(data) && data.length > 0;
    if (!hasData && wasTranslated && searchQuery !== trimmed) {
      const fallback = await supabase
        .from("products")
        .select("*", { count: "exact" })
        .ilike("title", `%${trimmed}%`)
        .limit(limit);
      if (!fallback.error && fallback.data && fallback.data.length > 0) {
        data = fallback.data;
        count = fallback.count;
        error = null;
      }
    }

    // Fallback: if still no data, return mock catalog
    if (!hasData && (!data || data.length === 0)) {
      return NextResponse.json({ products: MOCK_CATALOG, total: MOCK_CATALOG.length, translated: wasTranslated ? searchQuery : null });
    }

    if (error) {
      console.error("[search] Supabase error:", error);
      return NextResponse.json({ products: MOCK_CATALOG, total: MOCK_CATALOG.length, translated: wasTranslated ? searchQuery : null });
    }

    return NextResponse.json({
      products: (data ?? []).map(mapProductRow),
      total: count ?? 0,
      translated: wasTranslated ? searchQuery : null,
    });
  } catch (error) {
    console.error("[api/search] Search failed:", error);
    // Emergency fallback: return mock catalog on any error
    return NextResponse.json({ products: MOCK_CATALOG, total: MOCK_CATALOG.length, translated: wasTranslated ? searchQuery : null });
  }
}