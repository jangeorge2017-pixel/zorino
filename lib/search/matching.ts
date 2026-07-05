import { hasSameModel } from "@/lib/search/relevance";
import { normalizeTitleKey, titleSimilarity } from "@/lib/marketplace-engine/utils";
import type { NormalizedSearchListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";

/**
 * Product matching — decide whether two listings represent the same product
 * across different stores (for cross-store comparison).
 */
export function listingsRepresentSameProduct(
  a: NormalizedSearchListing,
  b: NormalizedSearchListing
): boolean {
  if (a.providerId === b.providerId && a.externalId === b.externalId) return true;

  const similarity = titleSimilarity(a.title, b.title);
  const { DUPLICATE_TITLE_THRESHOLD, DUPLICATE_STRONG_THRESHOLD } = SEARCH_ENGINE_DEFAULTS;

  if (similarity >= DUPLICATE_STRONG_THRESHOLD) return true;
  if (similarity >= DUPLICATE_TITLE_THRESHOLD && hasSameModel(a.title, b.title)) {
    return true;
  }

  return false;
}

/** Stable canonical key for grouping duplicate listings. */
export function canonicalProductKey(title: string): string {
  const key = normalizeTitleKey(title);
  return key.slice(0, 80) || "unknown";
}

/** Pick the best display title when merging offers. */
export function pickDisplayTitle(
  current: string,
  candidate: string,
  preferred?: NormalizedSearchListing
): string {
  if (preferred?.title === candidate) return candidate;
  if (preferred?.title === current) return current;
  return candidate.length > current.length ? candidate : current;
}
