import type { SearchEngineResult } from "@/lib/search/types";

const CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

type CacheEntry = {
  result: SearchEngineResult;
  expiresAt: number;
};

const searchCache = new Map<string, CacheEntry>();

export function buildSearchCacheKey(query: string, limit: number): string {
  return `${query.trim().toLowerCase()}:${limit}`;
}

export function getCachedSearch(key: string): SearchEngineResult | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    searchCache.delete(key);
    return null;
  }
  return entry.result;
}

export function setCachedSearch(key: string, result: SearchEngineResult): void {
  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }
  searchCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearSearchCache(): void {
  searchCache.clear();
}
