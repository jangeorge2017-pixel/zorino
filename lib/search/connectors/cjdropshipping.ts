import { CJdropshippingClient } from "@/lib/sync/providers/cjdropshipping/client";
import { normalizeCJRaw } from "@/lib/search/normalization";
import type { RawProviderListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ConnectorSearchOptions, SearchConnector } from "@/lib/search/connectors/types";

function getClient(): CJdropshippingClient | null {
  const apiKey = process.env.CJDROPSHIPPING_API_KEY?.trim();
  if (!apiKey) return null;
  return new CJdropshippingClient(apiKey);
}

/**
 * CJdropshipping search connector.
 *
 * First-class connector that calls the CJ REST API directly and normalizes
 * results through the standard pipeline — same pattern as AliExpress/eBay.
 *
 * Requires: CJDROPSHIPPING_API_KEY in Vercel Production Environment Variables.
 */
export const cjdropshippingSearchConnector: SearchConnector = {
  id: "cjdropshipping",
  name: "CJdropshipping",

  async isAvailable() {
    return !!process.env.CJDROPSHIPPING_API_KEY?.trim();
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const client = getClient();
    if (!client) return [];

    const pageSize = options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
    const maxPages = options?.maxPages ?? SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER;

    try {
      const rawProducts = await client.searchProducts({
        keywords: [trimmed],
        maxPages,
        pageSize,
      });

      const listings: RawProviderListing[] = [];
      const seenIds = new Set<string>();

      for (const raw of rawProducts) {
        const id = raw.pid ?? "";
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const normalized = normalizeCJRaw(raw);
        if (normalized) listings.push(normalized);
      }

      return listings;
    } catch (error) {
      console.error(
        "[cjdropshipping-connector]",
        error instanceof Error ? error.message : "CJdropshipping search failed",
      );
      return [];
    }
  },
};
