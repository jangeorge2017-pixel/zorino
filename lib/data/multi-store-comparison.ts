import type { CompareProductResult, CompareOffer } from "@/services/compare";
import type { SearchResultItem } from "@/lib/data/homepage";
import { searchProducts } from "@/lib/search/engine";
import { buildStore } from "@/lib/data/marketplace-product-detail";
import { isValidProductDestinationUrl } from "@/lib/affiliate/product-url";

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

// Cosine similarity over filtered token sets. 0.40 together with the
// sharedCoreTokens>=1 guard admits genuine model-variant twins whose titles
// differ in spelling/packaging ("Samsung Galaxy Watch 4 44mm" vs "Samsung
// Galaxy Watch4 SM-R870 Blk" score 0.5) while the token guard still rejects
// unrelated listings that happen to share a generic word.
const MIN_TITLE_SIMILARITY = 0.4;
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
 * Count of meaningful title tokens shared between two product names.
 *
 * Works over the same stopword-filtered token sets as titleSimilarity, so a
 * shared token is a loaded identifier (brand/model/capacity word) — not "the",
 * "for", or a bare number. A genuinely comparable product must share at least
 * one such token with the base product; this hard guard is what lets the
 * similarity threshold be loosened without also admitting unrelated listings
 * that share only a generic word.
 */
export function sharedCoreTokens(a: string, b: string): number {
  const sa = setTitle(tokenizeTitle(a));
  const sb = setTitle(tokenizeTitle(b));
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared += 1;
  return shared;
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

export type ScoredCandidate = {
  item: SearchResultItem;
  score: number;
  ratio: number;
  storeSlug: string;
};

/**
 * Score a single search-engine candidate against a base product and decide
 * whether it is the SAME product available on another store.
 *
 * Strict real-data rules (nothing fabricated, ever):
 *  - Must not duplicate an already-attached offer.
 *  - Must come from a store not already represented in the base result.
 *  - Must carry a REAL, shoppable product-level destination URL. A merchant
 *    homepage, search/category page or opaque link never qualifies — such a
 *    listing is left unshoppable instead of being silently attached.
 *  - Must be in stock at a positive price inside the base price band
 *    (look-alike accessories that are much cheaper than the base product are
 *    rejected even when their titles overlap).
 *  - Must share at least one meaningful title token with the base product and
 *    clear MIN_TITLE_SIMILARITY cosine over the filtered token sets.
 *
 * Returns null when the candidate is a different product or cannot be shopped,
 * so enrichment never attaches a fabricated or unreachable offer.
 */
export function scoreCompareCandidate(
  baseName: string,
  basePrice: number,
  candidate: SearchResultItem,
  knownStores: ReadonlySet<string>,
  knownOfferIds: ReadonlySet<string>,
): ScoredCandidate | null {
  if (!candidate.name) return null;
  if (knownOfferIds.has(`${candidate.storeSlug}-${candidate.id}`)) return null;
  const storeSlug = candidate.storeSlug || "partner";
  if (knownStores.has(storeSlug)) return null;
  if (candidate.price <= 0 || !candidate.inStock) return null;
  if (!isValidProductDestinationUrl(candidate.affiliateUrl)) return null;

  const ratio = candidate.price / basePrice;
  if (ratio < MIN_PRICE_RATIO || ratio > MAX_PRICE_RATIO) return null;

  if (sharedCoreTokens(baseName, candidate.name) < 1) return null;
  const score = titleSimilarity(baseName, candidate.name);
  if (score < MIN_TITLE_SIMILARITY) return null;

  return { item: candidate, score, ratio, storeSlug };
}

/**
 * Pick the qualifying cross-store extras for a base product: the highest-scoring
 * match per store, capped at MAX_EXTRA_OFFERS, in score order. Pure and
 * synchronous so the cross-store matching rules can be regression-tested
 * without a network.
 */
export function selectCompareExtras(
  baseName: string,
  basePrice: number,
  candidates: readonly SearchResultItem[],
  knownStores: ReadonlySet<string>,
  knownOfferIds: ReadonlySet<string>,
  baseProductId: string,
): CompareOffer[] {
  const bestPerStore = new Map<string, ScoredCandidate>();
  for (const candidate of candidates) {
    const scored = scoreCompareCandidate(
      baseName,
      basePrice,
      candidate,
      knownStores,
      knownOfferIds,
    );
    if (!scored) continue;
    const existing = bestPerStore.get(scored.storeSlug);
    if (!existing || scored.score > existing.score) {
      bestPerStore.set(scored.storeSlug, scored);
    }
  }

  return [...bestPerStore.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EXTRA_OFFERS)
    .map(({ item }) => offerFromSearchItem(item, baseProductId));
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
  const knownIds = new Set(
    result.offers.map((o) => {
      const slug = o.provider ?? o.store?.slug ?? o.storeId;
      return `${slug}-${o.id.replace(/^price-/, "")}`;
    }),
  );

  let candidates: SearchResultItem[];
  try {
    candidates = await searchProductsWithinDeadline(coreQuery, 24);
  } catch {
    return result;
  }

  const extras = selectCompareExtras(
    baseName,
    basePrice,
    candidates,
    knownStores,
    knownIds,
    result.product.id,
  );

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
