import { hasSameModel } from "@/lib/search/relevance";
import {
  classifyListingPair,
  clusterSignature,
  listingPairProvenDifferent,
} from "@/lib/search/cluster";
import { normalizeTitleKey, titleSimilarity } from "@/lib/marketplace-engine/utils";
import type { NormalizedSearchListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";

/**
 * Product matching — decide whether two listings represent the same product
 * across different stores (for cross-store comparison).
 *
 * Strict clustering decides FIRST (lib/search/cluster.ts):
 *   - PROVEN-different signals (shared identifier with different values, or an
 *     equal model with a different brand / incompatible storage) hard-block the
 *     merge — "256GB" and "512GB" are different devices and NEVER join.
 *   - A shared universal identifier (MPN/EAN/UPC/GTIN/ISBN/ASIN), or an
 *     identical [Brand]+[Model]+[Storage], or a fuzzy-equivalent model within
 *     one brand merges the offers for comparison.
 * Only when the structured extractors have no proof either way does the legacy
 * title-similarity tier decide.
 */
export function listingsRepresentSameProduct(
  a: NormalizedSearchListing,
  b: NormalizedSearchListing
): boolean {
  if (a.providerId === b.providerId && a.externalId === b.externalId) return true;

  if (listingPairProvenDifferent(a, b)) return false;

  const confidence = classifyListingPair(a, b);
  if (confidence !== null) return true;

  const similarity = titleSimilarity(a.title, b.title);
  const { DUPLICATE_TITLE_THRESHOLD, DUPLICATE_STRONG_THRESHOLD } = SEARCH_ENGINE_DEFAULTS;

  if (similarity >= DUPLICATE_STRONG_THRESHOLD) return true;
  if (similarity >= DUPLICATE_TITLE_THRESHOLD && hasSameModel(a.title, b.title)) {
    return true;
  }

  return false;
}

/**
 * Stable canonical key for grouping duplicate listings. Prefers the structured
 * [Brand]+[Model]+[Storage] signature when the title names a model — that key
 * is identical across orthographies and storage-verbatim titles ("iPhone 15 Pro
 * 256GB" vs "آيفون 15 برو 256 جيجابايت"), so comparison groups stay stable.
 * Falls back to the normalised title for products no model can be extracted
 * from.
 */
export function canonicalProductKey(title: string): string {
  const sig = clusterSignature(title);
  if (sig.model) {
    const structured = [sig.brand, sig.model, sig.storage].filter(Boolean).join(" ");
    if (structured) return normalizeTitleKey(structured).slice(0, 80) || "unknown";
  }
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
