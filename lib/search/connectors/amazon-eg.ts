import type { SearchConnector, ConnectorSearchOptions } from "@/lib/search/connectors/types";
import type { RawProviderListing } from "@/lib/search/types";
import { AMAZON_EG_SEED_LINKS } from "@/lib/amazon-eg/seed-links";

/**
 * Amazon Egypt search connector — seed-link based.
 * Returns real Amazon.eg products from the seed-link catalog.
 * Each product has a real title, ASIN, and affiliate URL with zorinoeg-21 tag.
 */
export const amazonEgSearchConnector: SearchConnector = {
  id: "amazon-eg",
  name: "Amazon Egypt",

  async isAvailable(): Promise<boolean> {
    return true;
  },

  async search(
    query: string,
    _options?: ConnectorSearchOptions
  ): Promise<RawProviderListing[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    // Match seed products whose title contains any query word
    const words = trimmed.split(/\s+/).filter((w) => w.length > 1);
    const matched = words.length === 0
      ? AMAZON_EG_SEED_LINKS
      : AMAZON_EG_SEED_LINKS.filter((link) =>
          words.some((w) => link.title.toLowerCase().includes(w))
        );

    return matched.map((link) => ({
      providerId: "amazon-eg" as const,
      externalId: link.id,
      title: link.title,
      imageUrl: "",
      price: 0,
      originalPrice: 0,
      discount: 0,
      currency: "EGP",
      storeName: "Amazon Egypt",
      category: "electronics",
      rating: 0,
      reviewCount: 0,
      inStock: true,
      productUrl: link.affiliateUrl,
      affiliateUrl: link.affiliateUrl,
    }));
  },
};
