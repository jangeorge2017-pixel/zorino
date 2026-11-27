import { NextRequest, NextResponse } from "next/server";
import { getSearchResultsPage } from "@/lib/data/homepage";
import type { CurrencyCode } from "@/lib/international/config";
import {
  detectCountryFromHeaders,
  resolveCurrencyForRequest,
} from "@/lib/international/detect";
import {
  interleaveByStoreRoundRobin,
  SEARCH_ENGINE_DEFAULTS,
  storeRoundRobinKey,
  toProductCard,
} from "@/lib/search/types";
import { isUsableRemoteProductImageUrl } from "@/lib/images/product-image";
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
  const candidateLimit = Math.min(
    SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT,
    Math.max(limit * 8, SEARCH_ENGINE_DEFAULTS.PAGE_SIZE),
  );
  const page = await getSearchResultsPage(
    searchQuery,
    0,
    candidateLimit,
    "relevance",
    currencyCode,
    trimmed,
  );

  const cards = page.items
    .map((item) => ({ item, card: item.productCard ?? toProductCard(item) }))
    .filter(
      (row): row is { item: (typeof page.items)[number]; card: NonNullable<ReturnType<typeof toProductCard>> } =>
        row.card !== null && isUsableRemoteProductImageUrl(row.card.image_url),
    );
  const balanced = interleaveByStoreRoundRobin(
    cards,
    (row) =>
      storeRoundRobinKey({
        storeSlug: row.item.storeSlug,
        store: row.item.store,
        store_name: row.card.store_name,
        provider: row.card.provider,
      }),
    limit,
  );
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
    const key = storeRoundRobinKey({
      storeSlug: product.store_slug,
      store: product.store,
      provider: product.provider,
    });
    storeCounts[key] = (storeCounts[key] ?? 0) + 1;
  }

  return NextResponse.json({
    products,
    total: page.total,
    translated: wasTranslated ? searchQuery : null,
    storeCounts,
    hasMore: page.hasMore,
    offset: 0,
    limit,
  });
}
