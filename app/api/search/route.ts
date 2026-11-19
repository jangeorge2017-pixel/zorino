import { NextRequest, NextResponse } from "next/server";
import { getSearchResultsPage } from "@/lib/data/homepage";
import {
  isUsableRemoteProductImageUrl,
  normalizeProductImageUrl,
} from "@/lib/images/product-image";
import type { CurrencyCode } from "@/lib/international/config";
import {
  detectCountryFromHeaders,
  resolveCurrencyForRequest,
} from "@/lib/international/detect";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import { translateSearchQuery } from "@/lib/search/query-translation";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const requestedLimit = Number(url.searchParams.get("limit") ?? "40");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(1, Math.floor(requestedLimit)), SEARCH_ENGINE_DEFAULTS.PAGE_SIZE)
    : 40;

  if (!q.trim()) {
    return NextResponse.json({ products: [], total: 0, storeCounts: {} });
  }

  const trimmed = q.trim();
  const { translatedQuery, wasTranslated } = await translateSearchQuery(trimmed);
  const searchQuery = translatedQuery || trimmed;

  const country = detectCountryFromHeaders(req);
  const currencyCode = resolveCurrencyForRequest(req, country) as CurrencyCode;
  const page = await getSearchResultsPage(searchQuery, 0, limit, "relevance", currencyCode);

  const products = page.items
    .filter((item) => isUsableRemoteProductImageUrl(item.imageSrc))
    .map((item) => {
      const imageUrl = normalizeProductImageUrl(item.imageSrc);
      return {
        id: item.id,
        name: item.name,
        title: item.name,
        image_url: imageUrl,
        imageSrc: imageUrl,
        price: item.price,
        original_price: item.originalPrice,
        originalPrice: item.originalPrice,
        discount: item.discount,
        currency: item.currency ?? currencyCode,
        country_code: item.countryCode,
        store: item.store,
        store_slug: item.storeSlug,
        storeSlug: item.storeSlug,
        category: item.category,
        rating: item.rating,
        review_count: item.reviewCount,
        in_stock: item.inStock,
        affiliate_url: item.affiliateUrl,
        condition: item.condition,
      };
    });

  const storeCounts: Record<string, number> = {};
  for (const product of products) {
    const slug = product.storeSlug || product.store || "unknown";
    storeCounts[slug] = (storeCounts[slug] ?? 0) + 1;
  }

  return NextResponse.json({
    products,
    total: products.length,
    translated: wasTranslated ? searchQuery : null,
    storeCounts,
    hasMore: page.hasMore,
    offset: 0,
    limit,
  });
}
