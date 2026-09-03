import type { CompareProductResult, CompareOffer } from "@/services/compare";
import type { SearchResultItem } from "@/lib/data/homepage";
import { searchProducts } from "@/lib/search/engine";
import { buildStore } from "@/lib/data/marketplace-product-detail";

/**
 * Multi-store comparison enrichment.
 *
 * When a product resolves to a single merchant offer (the common case for
 * live marketplace lookups), we query the unified live-product pipeline for
 * the same item on other stores and attach REAL matched listings as
 * additional comparison offers.
 *
 * Rules:
 * - Only real listings returned by active provider connectors are used.
 * - A listing qualifies only when its title strongly matches the base
 *   product title AND its price sits in a plausible band around the base
 *   price (guards against accessories/wrong-item matches).
 * - At most one offer per provider, capped total extras.
 * - Never fabricate offers, prices, or stores.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "of", "in", "on", "to",
  "new", "hot", "sale", "2023", "2024", "2025", "2026", "us", "eu", "plug",
  "free", "shipping", "fast", "delivery", "original", "genuine",
]);

// Terminal condition words mark the end of a listing's meaningful title (the
// "condition / seller tail"). When building the cross-store query we stop at
// these — everything after is seller/condition detail we don't need.
const TERMINAL_NOISE = new Set([
  "good", "excellent", "better", "best", "like", "never", "used",
  "poor", "fair", "acceptable", "unacceptable", "refurbished", "renewed",
  "sealed", "open", "boxed", "grade", "scratch", "scratches", "blemish",
  "blemished", "plain", "cracked", "broken", "battery", "condition",
]);

// Presentation / dimension / color words that should be *skipped* but must NOT
// truncate the query — a capacity or model token can legitimately follow them
// (e.g. "Fully Unlocked 6.1in - 128GB ..."). Dropping those next tokens is what
// made the generated query too broad to surface the genuine device.
const SKIP_NOISE = new Set([
  "fully", "factory", "international", "global", "official", "version",
  "warranty", "available", "stock", "ship", "ships", "ready", "all", "wide",
  "colors", "color", "colour", "esim", "sim", "inch", "inches", "1in", "only",
]);

const MIN_TITLE_SIMILARITY = 0.55;
const MIN_PRICE_RATIO = 0.33;
const MAX_PRICE_RATIO = 3;
const MAX_EXTRA_OFFERS = 4;
const MAX_QUERY_TOKENS = 6;
// Cap how long enrichment waits for the search fan-out. The engine already
// isolates per-provider failures (one provider 405/429 doesn't drop the ones
// that succeeded), but a stalled provider must never block the compare section.
const ENRICH_SEARCH_TIMEOUT_MS = 12_000;

/**
 * Run the unified search fan-out with a hard deadline. If a provider stalls and
 * the whole fan-out exceeds the budget, resolve with [] so enrichment fails
 * gracefully (returning the base result) instead of never settling.
 */
async function searchProductsWithinDeadline(
  query: string,
  limit: number,
): Promise<SearchResultItem[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      searchProducts(query, limit),
      new Promise<SearchResultItem[]>((resolve) => {
        timer = setTimeout(() => resolve([]), ENRICH_SEARCH_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function tokenizeTitle(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+.]+/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.+]+|[.+]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function setTitle(tokens: string[]): Set<string> {
  return new Set(tokens);
}

/** Cosine-style similarity over token sets. */
export function titleSimilarity(a: string, b: string): number {
  const sa = setTitle(tokenizeTitle(a));
  const sb = setTitle(tokenizeTitle(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / Math.sqrt(sa.size * sb.size);
}

/**
 * Build a focused cross-store search query from a seller title.
 *
 * The full seller title (e.g. "Apple iPhone 15 Fully Unlocked 6.1in - 128GB -
 * eSIM -Good") is a poor query: it mixes in condition, color and seller detail
 * that dilutes every provider connector's ranking, so the genuine same-product
 * listing on another store rarely makes the top-N cut. This derives a short
 * query of the meaningful core tokens (brand, model, capacity) while trimming
 * the condition/seller tail.
 *
 * The capacity/model tokens are deliberately kept — AliExpress relevance, for
 * example, returns the genuine device for queries like "iphone 15 128gb
 * unlocked" but not for the bare "apple iphone 15" (which surfaces only cases
 * and the wrong model). Only the terminal condition tail is dropped.
 */
export function buildCoreQuery(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const kept: string[] = [];
  for (const word of words) {
    const alnum = word.replace(/[^\p{L}\p{N}]+/gu, "");
    if (alnum.length <= 1) continue;
    if (STOPWORDS.has(word)) continue;
    if (TERMINAL_NOISE.has(word)) {
      // A condition word marks the end of the meaningful title. Stop here once
      // we have already collected the core brand/model.
      if (kept.length > 0) break;
      continue;
    }
    if (SKIP_NOISE.has(word)) {
      // Presentation/dimension/color word: skip it but keep scanning — a useful
      // capacity or model token can follow ("Fully Unlocked 6.1in - 128GB").
      continue;
    }
    kept.push(alnum);
    if (kept.length >= MAX_QUERY_TOKENS) break;
  }

  if (kept.length === 0) return name;
  return kept.join(" ");
}

function offerFromSearchItem(item: SearchResultItem, baseProductId: string): CompareOffer {
  const store = buildStore(item.storeSlug || "partner", item.store);
  const originalPrice = item.originalPrice ?? item.price;
  const discountPercent =
    originalPrice > item.price
      ? Math.round(((originalPrice - item.price) / originalPrice) * 10000) / 100
      : (item.discount ?? 0);
  return {
    id: `price-${item.id}`,
    productId: baseProductId,
    storeId: store.id,
    price: item.price,
    originalPrice: item.originalPrice,
    currency: item.currency ?? (store.supportedCurrencies?.[0] ?? ""),
    countryCode: item.countryCode ?? null,
    inStock: item.inStock,
    isCurrent: true,
    recordedAt: new Date().toISOString(),
    store,
    provider: store.slug,
    discountPercent,
    externalUrl: item.affiliateUrl,
  };
}

type EnrichedEntry = {
  result: CompareProductResult;
  expiresAt: number;
};

const ENRICH_TTL_MS = 10 * 60 * 1000;
const enrichCache = new Map<string, EnrichedEntry>();

function cacheKey(result: CompareProductResult): string {
  return `${result.product.name.trim().toLowerCase()}|${result.offers[0]?.storeId ?? ""}`;
}

/**
 * Attach real cross-store offers to a single-merchant comparison result.
 * Returns the original result untouched when no trustworthy matches exist.
 */
export async function enrichCompareResult(
  result: CompareProductResult,
): Promise<CompareProductResult> {
  const key = cacheKey(result);
  const cached = enrichCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) enrichCache.delete(key);

  const enriched = await enrichCompareResultUncached(result);
  enrichCache.set(key, {
    result: enriched,
    expiresAt: Date.now() + ENRICH_TTL_MS,
  });
  return enriched;
}

async function enrichCompareResultUncached(
  result: CompareProductResult,
): Promise<CompareProductResult> {
  const baseOffer = result.offers[0];
  if (!baseOffer) return result;

  const baseName = result.product.name;
  const basePrice = baseOffer.price;
  if (!baseName || basePrice <= 0) return result;

  // Search the live pipeline with a focused core query rather than the full
  // seller title. A full title dilutes every provider's ranking so the genuine
  // same-product listing on another store rarely makes the top-N cut. The limit
  // is kept above the engine's default so a genuine cross-store twin is not
  // drowned out by the base store's own numerous listings.
  const coreQuery = buildCoreQuery(baseName);

  const knownStores = new Set(
    result.offers.map((o) => o.provider ?? o.store?.slug ?? o.storeId),
  );
  const knownIds = new Set(result.offers.map((o) => o.id));

  let candidates: SearchResultItem[];
  try {
    candidates = await searchProductsWithinDeadline(coreQuery, 24);
  } catch {
    return result;
  }

  const bestPerStore = new Map<string, { item: SearchResultItem; score: number }>();
  for (const candidate of candidates) {
    if (knownIds.has(`${candidate.storeSlug}-${candidate.id}`)) continue;
    const slug = candidate.storeSlug || "partner";
    if (knownStores.has(slug)) continue;
    if (candidate.price <= 0 || !candidate.inStock) continue;

    const ratio = candidate.price / basePrice;
    if (ratio < MIN_PRICE_RATIO || ratio > MAX_PRICE_RATIO) continue;

    const score = titleSimilarity(baseName, candidate.name);
    if (score < MIN_TITLE_SIMILARITY) continue;

    const existing = bestPerStore.get(slug);
    if (!existing || score > existing.score) {
      bestPerStore.set(slug, { item: candidate, score });
    }
  }

  const extras = [...bestPerStore.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EXTRA_OFFERS)
    .map(({ item }) => offerFromSearchItem(item, result.product.id));

  if (extras.length === 0) return result;

  const offers = [...result.offers, ...extras].sort((a, b) => a.price - b.price);
  const lowest = offers[0];
  const highest = offers[offers.length - 1];
  const maxDiscount = Math.max(...offers.map((o) => o.discountPercent));
  const highestDiscountOffer = offers.reduce((best, o) =>
    o.discountPercent > best.discountPercent ? o : best,
  );
  for (const offer of offers) offer.isLowest = offer.id === lowest.id;
  for (const offer of offers) {
    offer.isHighestDiscount =
      maxDiscount > 0 && offer.discountPercent === maxDiscount;
  }

  return {
    ...result,
    offers,
    lowestPrice: lowest.price,
    highestPrice: highest.price,
    highestDiscount: maxDiscount,
    savingsVsHighest: Math.max(0, highest.price - lowest.price),
    savingsPercent:
      highest.price > lowest.price
        ? Math.round(((highest.price - lowest.price) / highest.price) * 10000) / 100
        : 0,
    providerCount: new Set(offers.map((o) => o.provider ?? o.store?.slug ?? o.storeId)).size,
    cheapestStoreName: lowest.store?.name ?? result.cheapestStoreName,
    highestDiscountStoreName:
      highestDiscountOffer.store?.name ?? result.highestDiscountStoreName,
  };
}

/** Enrich many comparison results in parallel, tolerating failures. */
export async function enrichCompareResults(
  results: CompareProductResult[],
): Promise<CompareProductResult[]> {
  return Promise.all(
    results.map((r) =>
      enrichCompareResult(r).catch(() => r),
    ),
  );
}
