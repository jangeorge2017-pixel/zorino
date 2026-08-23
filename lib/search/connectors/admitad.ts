import type { SearchConnector, ConnectorSearchOptions } from "./types";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import { getAllAdmitadFeeds } from "@/lib/integrations/admitad/config";
import { normalizeProductImageUrl } from "@/lib/images/product-image";
import { normalizeAdmitadRaw } from "@/lib/search/normalization";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import { fetchAdmitadFeedProducts } from "@/lib/integrations/admitad/feed-fetcher";

const MAX_RESULTS_FROM_FEED = 200;

/**
 * Admitad search connector.
 *
 * Searches ALL cached Admitad merchant feeds (primary ADMITAD_FEED_URL plus
 * every program discovered via the Publisher API) through the shared
 * feed-fetcher (in-memory cache, same source as the homepage) and normalizes
 * results through the standard pipeline — same pattern as AliExpress/eBay.
 */
export const admitadSearchConnector: SearchConnector = {
  id: "admitad" as SearchProviderId,
  name: "Alibaba & Partners",

  async isAvailable() {
    try {
      const feeds = await getAllAdmitadFeeds();
      return feeds.length > 0;
    } catch {
      return false;
    }
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    try {
      const feeds = await getAllAdmitadFeeds();
      if (feeds.length === 0) return [];

      const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

      const pageSize = options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
      const maxPages = options?.maxPages ?? SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER;
      const targetCount = Math.min(pageSize * maxPages, MAX_RESULTS_FROM_FEED);

      // Shared cached multi-feed fetch — no per-query network refetch.
      const feedResults = await fetchAdmitadFeedProducts();

      const listings: RawProviderListing[] = [];
      const seenIds = new Set<string>();

      for (const feedResult of feedResults) {
        for (const offer of feedResult.offers) {
          if (listings.length >= targetCount) break;

          const nameLower = offer.name.toLowerCase();
          const matches =
            queryWords.length === 0 ||
            queryWords.some((w) => nameLower.includes(w));
          if (!matches) continue;

          const dedupeKey = `${feedResult.feedSlug}:${offer.id}`;
          if (seenIds.has(dedupeKey)) continue;
          seenIds.add(dedupeKey);

          const normalized = normalizeAdmitadRaw(
            {
              id: `${feedResult.feedSlug}-${offer.id}`,
              name: offer.name,
              price: offer.price,
              oldprice: offer.oldprice,
              currencyId: offer.currencyId,
              url: offer.url,
              image: normalizeProductImageUrl(offer.image || ""),
              vendor: offer.vendor,
            },
            feedResult.feedName,
          );
          if (normalized) listings.push(normalized);
        }
      }

      return listings;
    } catch (error) {
      console.error(
        "[admitad] search failed:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  },
};
