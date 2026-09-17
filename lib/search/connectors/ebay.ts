import { createEbayClientFromEnv } from "@/lib/integrations/ebay";
import { isEbayConfigured } from "@/lib/integrations/ebay/config";
import type { EbayAffiliateClient } from "@/lib/integrations/ebay/client";
import { normalizeEbayRaw } from "@/lib/search/normalization";
import type { RawProviderListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ConnectorSearchOptions, SearchConnector } from "@/lib/search/connectors/types";
import { getProviderSearchCapabilities } from "@/lib/search/provider-capabilities";
import { analyzeSearchQueryIntent } from "@/lib/search/query-intent";
import { loadEbayCredentials } from "@/services/ebay/credentials";

/** eBay Browse API max pages per search (50 × 6 = 300 listings). */
const EBAY_MAX_PAGES = 6;

/** Pages fetched concurrently once a device-intent search opts in. */
const EBAY_OPTIMIZED_PAGE_BATCH = 2;

/**
 * eBay is the flakiest active provider: under the parallel provider fan-out it
 * transiently rate-limits / times out, and one flaky window used to collapse a
 * render to zero eBay results (observed: a healthy window had 37 eBay listings,
 * a degraded window minutes later had 0, so wrong-gen phones + cases owned the
 * top of page 1). Two guards make it resilient:
 *
 * 1) A short-lived last-known-good cache per query — when a live fetch throws
 *    or returns empty, instantly serve the most recent genuine eBay listings.
 * 2) A bounded retry with backoff — ONLY when no fresh cache exists (cold
 *    start), so a single transient hit doesn't drop eBay entirely. When a
 *    fresh cache exists we prefer speed over freshness and skip retries,
 *    because the engine races every provider at ~8s and a slow connector would
 *    otherwise be dropped regardless.
 */
const LIVE_RETRIES = 1;
const RETRY_BACKOFF_MS = [400];
const LAST_GOOD_TTL_MS = 20 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

type LastGoodEntry = { items: RawProviderListing[]; fetchedAt: number };
const lastGoodByQuery = new Map<string, LastGoodEntry>();

/** Test-only: clear the last-known-good cache between tests. */
export function resetEbayLastGoodCacheForTests(): void {
  lastGoodByQuery.clear();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKey(query: string, options: ConnectorSearchOptions | undefined): string {
  const pageSize = options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
  const targetFetch = options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT;
  const countryCode = options?.countryCode ?? "US";
  const category = resolveEbayDeviceSearchStrategy(query, options).categoryIds ?? "";
  return `${query.trim().toLowerCase()}|${countryCode}|${pageSize}|${targetFetch}|${category}`;
}

export type EbayDeviceSearchStrategy = {
  /** Category id narrowing the keyword search (undefined = keyword only). */
  categoryIds?: string;
  /** Pages fetched concurrently. 1 preserves the strictly sequential default. */
  pageBatch: number;
};

/**
 * Pure, testable policy: should an eBay search be narrowed to a device
 * category? Runs only when the caller (the /search surface) opts in, so the
 * homepage catalog and Compare Prices keep the exact legacy eBay calls.
 *
 * Rules:
 * - Accessory queries are never category-filtered — a case/charger lives in an
 *   accessory category, not the device one.
 * - No condition filter is ever added, so Used/Refurbished devices stay valid.
 * - Families with no confident category stay keyword-only.
 */
export function resolveEbayDeviceSearchStrategy(
  query: string,
  options?: ConnectorSearchOptions,
): EbayDeviceSearchStrategy {
  if (options?.optimizeForDeviceIntent !== true) {
    return { pageBatch: 1 };
  }
  const capabilities = getProviderSearchCapabilities("ebay");
  const intent = options?.intent ?? analyzeSearchQueryIntent(query);
  const categoryIds =
    capabilities.supportsCategoryFilter && intent.kind !== "accessory"
      ? intent.ebayCategoryId
      : undefined;
  return { categoryIds, pageBatch: EBAY_OPTIMIZED_PAGE_BATCH };
}

/** Single live Browse API attempt — normalize + dedupe like the old connector. */
async function fetchAndNormalize(
  client: EbayAffiliateClient,
  query: string,
  options: ConnectorSearchOptions | undefined,
): Promise<RawProviderListing[]> {
  const trimmed = query.trim();
  const pageSize = options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
  const maxPages = Math.min(
    options?.maxPages ?? EBAY_MAX_PAGES,
    EBAY_MAX_PAGES,
    SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER
  );
  const targetFetch = options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT;
  const countryCode = options?.countryCode ?? "US";

  const maxPagesNeeded = Math.ceil(targetFetch / pageSize);
  const pagesToScan = Math.min(maxPages, maxPagesNeeded);
  const strategy = resolveEbayDeviceSearchStrategy(trimmed, options);

  const attempt = async (categoryIds?: string): Promise<RawProviderListing[]> => {
    const batch = await client.searchByKeyword(trimmed, {
      pageSize,
      maxPages: pagesToScan,
      countryCode,
      categoryIds,
      pageBatch: strategy.pageBatch,
    });

    const listings: RawProviderListing[] = [];
    const seenIds = new Set<string>();

    for (const raw of batch) {
      const id = raw.itemId ?? "";
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const normalized = normalizeEbayRaw(raw);
      if (normalized) listings.push(normalized);
    }

    return listings;
  };

  if (!strategy.categoryIds) {
    // Default path (no optimization, accessory query, or no confident
    // category): identical to the legacy single uncategorized fetch.
    return attempt(undefined);
  }

  try {
    const listings = await attempt(strategy.categoryIds);
    if (listings.length > 0) return listings;
  } catch {
    // Fall through to the uncategorized fetch below.
  }

  // A category-narrowed Browse request can fail or return nothing (transient
  // 4xx, or an outdated/unsupported category id). Degrade to a plain keyword
  // search rather than dropping eBay for this query entirely.
  return attempt(undefined);
}

/**
 * Resilient eBay search core — pure and testable without credentials:
 * 1) Try the live fetch. With a fresh last-known-good available, one attempt
 *    only (serve the cache fast on flake); cold start gets one extra retry.
 * 2) On success, refresh the last-known-good cache for this query.
 * 3) On total failure/empty, serve the fresh last-known-good results instead
 *    of returning 0 (so a flaky window cannot collapse the page-1 mix).
 */
export async function searchEbayWithClient(
  client: EbayAffiliateClient,
  query: string,
  options?: ConnectorSearchOptions,
): Promise<RawProviderListing[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const key = cacheKey(trimmed, options);
  const now = Date.now();

  const cached = lastGoodByQuery.get(key);
  const hasFreshLastGood = cached !== undefined && now - cached.fetchedAt <= LAST_GOOD_TTL_MS;
  const maxAttempts = hasFreshLastGood ? 1 : LIVE_RETRIES + 1;

  let listings: RawProviderListing[] = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 800);
    try {
      listings = await fetchAndNormalize(client, trimmed, options);
    } catch {
      listings = [];
    }
    if (listings.length > 0) break;
  }

  if (listings.length > 0) {
    lastGoodByQuery.set(key, { items: listings, fetchedAt: now });
    if (lastGoodByQuery.size > MAX_CACHE_ENTRIES) {
      const oldestKey = lastGoodByQuery.keys().next().value as string | undefined;
      if (oldestKey !== undefined) lastGoodByQuery.delete(oldestKey);
    }
    return listings;
  }

  const lastGood = lastGoodByQuery.get(key);
  if (lastGood && now - lastGood.fetchedAt <= LAST_GOOD_TTL_MS) {
    return lastGood.items;
  }
  return [];
}

export const ebaySearchConnector: SearchConnector = {
  id: "ebay",
  name: "eBay",

  async isAvailable() {
    await loadEbayCredentials();
    return isEbayConfigured();
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    await loadEbayCredentials();
    if (!isEbayConfigured()) return [];

    const client = createEbayClientFromEnv();
    if (!client) return [];

    return searchEbayWithClient(client, trimmed, options);
  },
};