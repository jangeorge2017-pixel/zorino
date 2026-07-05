import { analyzeSearchListing } from "@/lib/search/relevance";
import { normalizeRawListing } from "@/lib/search/normalization";
import type { NormalizedSearchListing, RawProviderListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";

/**
 * Relevance ranking — score every listing, rank devices first.
 * Accessories only appear after all matching devices when enough devices exist.
 */
export function rankRawListings(
  listings: RawProviderListing[],
  query: string
): NormalizedSearchListing[] {
  const { MIN_DEVICES_BEFORE_ACCESSORIES } = SEARCH_ENGINE_DEFAULTS;

  const analyzed = listings
    .map((raw) => {
      const result = analyzeSearchListing(raw.title, query, { category: raw.category });
      if (result.tier === "none" || result.tier === "repair") return null;
      return normalizeRawListing(raw, {
        score: result.score,
        tier: result.tier,
        isDevice: result.isDevice,
      });
    })
    .filter((item): item is NormalizedSearchListing => item !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const devices = analyzed.filter((row) => row.isDevice && row.matchTier !== "accessory");

  if (devices.length >= MIN_DEVICES_BEFORE_ACCESSORIES) {
    return devices;
  }

  // Devices naturally rank above accessories due to higher scores.
  return analyzed;
}

export function sortUnifiedByRelevance<T extends { relevanceScore: number; isDevice: boolean }>(
  products: T[]
): T[] {
  return [...products].sort((a, b) => {
    if (a.isDevice !== b.isDevice) return a.isDevice ? -1 : 1;
    return b.relevanceScore - a.relevanceScore;
  });
}
