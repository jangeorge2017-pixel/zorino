import { NextRequest, NextResponse } from "next/server";
import { getSearchResultsPage } from "@/lib/data/homepage";
import type { CurrencyCode } from "@/lib/international/config";
import {
  detectCountryFromHeaders,
  resolveCurrencyForRequest,
} from "@/lib/international/detect";
import {
  interleaveByStore,
  SEARCH_ENGINE_DEFAULTS,
  toProductCard,
} from "@/lib/search/types";
import { translateSearchQuery } from "@/lib/search/query-translation";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const requestedLimit = Number(
    url.searchParams.get("limit") ?? String(SEARCH_ENGINE_DEFAULTS.PAGE_SIZE),
  );
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(1, Math.floor(requestedLimit)), SEARCH_ENGINE_DEFAULTS.PAGE_SIZE)
    : SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;

  if (!q.trim()) {
    return NextResponse.json({ products: [], total: 0, storeCounts: {} });
  }

  const trimmed = q.trim();
  const { translatedQuery, wasTranslated } = await translateSearchQuery(trimmed);
  const searchQuery = translatedQuery || trimmed;

  const country = detectCountryFromHeaders(req);
  const currencyCode = resolveCurrencyForRequest(req, country) as CurrencyCode;
  const page = await getSearchResultsPage(searchQuery, 0, limit, "relevance", currencyCode);

  const cards = page.items
    .map((item) => ({ item, card: item.productCard ?? toProductCard(item) }))
    .filter(
      (row): row is { item: (typeof page.items)[number]; card: NonNullable<ReturnType<typeof toProductCard>> } =>
        row.card !== null,
    );
  const balanced = interleaveByStore(cards, (row) => row.card.store_name);
  const products = balanced.map(({ item, card }) => ({
    ...card,
    name: card.title,
    title: card.title,
    imageSrc: card.image_url,
    original_price: item.originalPrice,
    originalPrice: item.originalPrice,
    discount: item.discount,
    currency: card.currency || currencyCode,
    country_code: item.countryCode,
    store: card.store_name,
    store_slug: item.storeSlug || card.provider,
    storeSlug: item.storeSlug || card.provider,
    category: item.category,
    rating: item.rating,
    review_count: item.reviewCount,
    in_stock: item.inStock,
    affiliate_url: card.product_url,
    condition: item.condition,
  }));

  const storeCounts: Record<string, number> = {};
  for (const product of products) {
    const slug = product.store_slug || product.store || "unknown";
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
