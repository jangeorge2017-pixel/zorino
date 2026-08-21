import type { SearchConnector, ConnectorSearchOptions } from "./types";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import { ADMITAD_PROVIDER_ID } from "@/lib/integrations/admitad/config";
import { normalizeProductImageUrl } from "@/lib/images/product-image";
import { normalizeAdmitadRaw } from "@/lib/search/normalization";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";

const MAX_RESULTS_FROM_FEED = 200;

/**
 * Admitad search connector.
 *
 * First-class connector that searches the cached Admitad XML feed and
 * normalizes results through the standard pipeline — same pattern as
 * AliExpress/eBay.
 *
 * Availability depends on ADMITAD_FEED_URL being set in the environment.
 */
export const admitadSearchConnector: SearchConnector = {
  id: ADMITAD_PROVIDER_ID as SearchProviderId,
  name: "Alibaba",

  async isAvailable() {
    const { ADMITAD_FEEDS } = await import("@/lib/integrations/admitad/config");
    return ADMITAD_FEEDS.length > 0;
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    try {
      const { fetchAdmitadFeedProducts } = await import(
        "@/lib/integrations/admitad/feed-fetcher"
      );

      const feeds = await fetchAdmitadFeedProducts();
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

      const pageSize = options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
      const maxPages = options?.maxPages ?? SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER;
      const targetCount = Math.min(pageSize * maxPages, MAX_RESULTS_FROM_FEED);

      const listings: RawProviderListing[] = [];
      const seenIds = new Set<string>();

      for (const feed of feeds) {
        for (const offer of feed.offers) {
          const nameLower = offer.name.toLowerCase();
          const matches =
            queryWords.length === 0 ||
            queryWords.some((w) => nameLower.includes(w));
          if (!matches) continue;

          if (seenIds.has(offer.id)) continue;
          seenIds.add(offer.id);

          const normalized = normalizeAdmitadRaw(
            {
              id: offer.id,
              name: offer.name,
              price: offer.price,
              oldprice: offer.oldprice,
              currencyId: offer.currencyId,
              url: offer.url,
              image: normalizeProductImageUrl(offer.image || ""),
              vendor: offer.vendor,
            },
            feed.feedName,
          );
          if (normalized) listings.push(normalized);

          if (listings.length >= targetCount) break;
        }
        if (listings.length >= targetCount) break;
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
