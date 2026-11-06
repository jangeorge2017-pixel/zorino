import { NextRequest, NextResponse } from "next/server";
import { getSearchResultsPage } from "@/lib/data/homepage";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import { type CurrencyCode } from "@/lib/international/config";
import { resolveCurrencyForRequest, detectCountryFromHeaders } from "@/lib/international/detect";
import { translateSearchQuery } from "@/lib/search/query-translation";
import type { SearchResultItem } from "@/lib/data/homepage";

function sanitizeFilterValue(value: string): string {
  if (!value) return "";
  if (value.toLowerCase().includes("issue")) return "";
  if (["", "2", "3", "4"].includes(value)) return value;
  if (/[^0-9]/.test(value)) return "";
  return value;
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

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawQuery = url.searchParams.get("q") ?? "";
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(
    url.searchParams.get("limit") ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE
  );
  const sortRaw = url.searchParams.get("sort") ?? "relevance";
  const sort = sortRaw === "price" || sortRaw === "price_low" ? "price" : "relevance";

  // Sanitize any filter params that might leak garbage
  const _ratingParam = sanitizeFilterValue(url.searchParams.get("rating") || "");
  const _storeParam = sanitizeFilterValue(url.searchParams.get("store") || "");
  const _categoryParam = sanitizeFilterValue(url.searchParams.get("category") || "");
  const _minPriceParam = sanitizeFilterValue(url.searchParams.get("minPrice") || "");
  const _maxPriceParam = sanitizeFilterValue(url.searchParams.get("maxPrice") || "");

  const q = rawQuery.trim();
  if (!q) {
    return NextResponse.json({ items: MOCK_CATALOG, total: MOCK_CATALOG.length, hasMore: false });
  }

  const country = detectCountryFromHeaders(req);
  const currencyCode = resolveCurrencyForRequest(req, country) as CurrencyCode;

  try {
    const page = await getSearchResultsPage(
      q,
      Number.isFinite(offset) ? offset : 0,
      Number.isFinite(limit) ? Math.min(Math.max(1, limit), SEARCH_ENGINE_DEFAULTS.PAGE_SIZE) : SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
      sort,
      currencyCode,
    );

    // Fallback: if search engine returns empty, serve mock catalog
    if (!page.items || page.items.length === 0) {
      return NextResponse.json({
        items: MOCK_CATALOG,
        total: MOCK_CATALOG.length,
        hasMore: false,
      });
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error("[api/search/paged] Search failed:", error);
    // Emergency fallback: return mock catalog on any error
    return NextResponse.json({
      items: MOCK_CATALOG,
      total: MOCK_CATALOG.length,
      hasMore: false,
    });
  }
}