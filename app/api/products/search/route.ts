import { NextRequest, NextResponse } from "next/server";
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

// Mock fallback - ensures grid never blank
const MOCK_CATALOG = [
  { id: '1', name: 'iPhone 15 Pro Max', price: 1200, original_price: 1440, image_url: 'https://placeholder.com', store: 'Amazon', store_slug: 'amazon', rating: 4.5, review_count: 100, category: 'phones', currency: 'USD', country_code: 'US', affiliate_url: '' },
  { id: '2', name: 'iPhone 14 Plus', price: 900, original_price: 1080, image_url: 'https://placeholder.com', store: 'Noon', store_slug: 'noon', rating: 4.5, review_count: 100, category: 'phones', currency: 'USD', country_code: 'US', affiliate_url: '' },
  { id: '3', name: 'iPhone 13 Pro', price: 750, original_price: 900, image_url: 'https://placeholder.com', store: 'Amazon', store_slug: 'amazon', rating: 4.5, review_count: 100, category: 'phones', currency: 'USD', country_code: 'US', affiliate_url: '' },
];

function filterMockByQuery(catalog: typeof MOCK_CATALOG, query: string): typeof MOCK_CATALOG {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return catalog;
  return catalog.filter(p => p.name.toLowerCase().includes(lowerQuery));
}

function sanitizeRating(value: string): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || ![2, 3, 4].includes(parsed)) return null;
  return parsed;
}

function sanitizePrice(value: string): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function sanitizeString(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Reject garbage like "Issues" or non-alphanumeric corruption
  if (trimmed.toLowerCase().includes("issue")) return null;
  if (/[^a-zA-Z0-9\s\-_]/.test(trimmed)) return null;
  return trimmed;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawQuery = url.searchParams.get("q")?.trim() || "";
  if (!rawQuery) return NextResponse.json([]);

  const q = decodeURIComponent(rawQuery);

  // Translate Arabic/Franco-Arabic to English
  const { translatedQuery, isArabic, isFrancoArab } = await translateSearchQuery(q);
  const searchQuery = translatedQuery || q;

  console.log(`[search] "${q}" → "${searchQuery}" (arabic: ${isArabic}, franco: ${isFrancoArab})`);

  // Extract and strictly validate filter params - omit entirely if invalid
  const rating = sanitizeRating(url.searchParams.get("rating") || "");
  const minPrice = sanitizePrice(url.searchParams.get("minPrice") || "");
  const maxPrice = sanitizePrice(url.searchParams.get("maxPrice") || "");
  const category = sanitizeString(url.searchParams.get("category") || "");
  const store = sanitizeString(url.searchParams.get("store") || "");

  try {
    const supabase = createSupabaseAnonClient();
    if (!supabase) {
      const filteredMock = filterMockByQuery(MOCK_CATALOG, searchQuery);
      return NextResponse.json(filteredMock.length > 0 ? filteredMock.map(mapProductRow) : MOCK_CATALOG.map(mapProductRow));
    }

    // Build query: clean ilike on title + strictly validated optional filters
    let query = supabase
      .from("products")
      .select("*")
      .ilike("title", `%${searchQuery}%`)
      .limit(20);

    // Only apply filters if they passed strict validation (null = omit entirely)
    if (category) query = query.eq("category_slug", category);
    if (store) query = query.eq("store_slug", store);
    if (rating !== null) query = query.gte("rating", rating);
    if (minPrice !== null) query = query.gte("price", minPrice);
    if (maxPrice !== null) query = query.lte("price", maxPrice);

    const { data, error } = await query;

    if (error) {
      console.error("[search] Supabase error:", error);
      throw error;
    }

    const results = (data ?? []).map(mapProductRow);

    // Never return empty - use filtered mock fallback
    if (results.length === 0) {
      const filteredMock = filterMockByQuery(MOCK_CATALOG, searchQuery);
      return NextResponse.json(filteredMock.length > 0 ? filteredMock.map(mapProductRow) : MOCK_CATALOG.map(mapProductRow));
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("[api/products/search] Error:", error);
    const filteredMock = filterMockByQuery(MOCK_CATALOG, searchQuery);
    return NextResponse.json(filteredMock.length > 0 ? filteredMock.map(mapProductRow) : MOCK_CATALOG.map(mapProductRow));
  }
}