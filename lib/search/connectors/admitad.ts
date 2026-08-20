import type { SearchConnector, ConnectorSearchOptions } from "./types";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import { ADMITAD_PROVIDER_ID } from "@/lib/integrations/admitad/config";
import { SEED_FEED_OFFERS } from "@/lib/integrations/admitad/seed";

const MAX_PRODUCTS_PER_SEARCH = 200;

const SEED_IMAGE_BY_ID = new Map(
  SEED_FEED_OFFERS.filter((o) => o.image).map((o) => [o.id, o.image]),
);

export const admitadSearchConnector: SearchConnector = {
  id: ADMITAD_PROVIDER_ID as SearchProviderId,
  name: "Alibaba",

  async isAvailable() {
    return true;
  },

  async search(query: string, _options?: ConnectorSearchOptions) {
    try {
      const { fetchAdmitadFeedProducts } = await import(
        "@/lib/integrations/admitad/feed-fetcher"
      );

      const feeds = await fetchAdmitadFeedProducts();
      const queryLower = query.toLowerCase();
      const queryWords = queryLower
        .split(/\s+/)
        .filter((w) => w.length > 2);

      const results: RawProviderListing[] = [];

      for (const feed of feeds) {
        for (const offer of feed.offers) {
          const nameLower = offer.name.toLowerCase();
          const matches =
            queryWords.length === 0 ||
            queryWords.some((w) => nameLower.includes(w));
          if (!matches) continue;

          results.push({
            providerId: ADMITAD_PROVIDER_ID as SearchProviderId,
            externalId: `alibaba-${offer.id}`,
            title: offer.name,
            imageUrl: offer.image || SEED_IMAGE_BY_ID.get(offer.id) || "",
            price: offer.price,
            originalPrice: offer.oldprice ?? offer.price,
            discount:
              offer.oldprice && offer.oldprice > offer.price
                ? Math.round(
                    ((offer.oldprice - offer.price) / offer.oldprice) * 100
                  )
                : 0,
            currency: offer.currencyId,
            storeName: feed.feedName,
            category: "General",
            rating: 0,
            reviewCount: 0,
            inStock: true,
            productUrl: offer.url,
            affiliateUrl: offer.url,
          });

          if (results.length >= MAX_PRODUCTS_PER_SEARCH) break;
        }
        if (results.length >= MAX_PRODUCTS_PER_SEARCH) break;
      }

      return results;
    } catch (error) {
      console.error(
        "[admitad] search failed:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  },
};
