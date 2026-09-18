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
 * CJdropshipping query fan-out.
 *
 * CJ's `/product/list` matches `productNameEn` as a SUBSTRING of product
 * titles, so a full compound phrase like "iPhone 15 Pro Max", "MacBook Air
 * M3" or "Samsung Galaxy S24" matches nothing at all — CJ would report zero
 * products even though its catalog carries relevant items (cases, covers,
 * cables, wearables) for each meaningful part of the query.
 *
 * For device-intent searches the keyword list is fanned out to progressively
 * shorter prefixes (the full query always first) so every meaningful part of
 * the query reaches CJ's real inventory. Mirrors the AliExpress device
 * expansion and stays gated on `optimizeForDeviceIntent` so the homepage /
 * Compare fan-out is byte-identical.
 */
export function buildCjSearchQueries(
  query: string,
  options?: ConnectorSearchOptions,
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (options?.optimizeForDeviceIntent !== true) return [trimmed];

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return [trimmed];

  const variants = [trimmed];
  for (let i = tokens.length - 1; i >= 1; i--) {
    if (variants.length >= 3) break;
    const candidate = tokens.slice(0, i).join(" ");
    if (candidate !== trimmed) variants.push(candidate);
  }
  return variants;
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

    const keywords = buildCjSearchQueries(trimmed, options);
    // CJ pages one request at a time and rate-limits to 1 QPS, so split the
    // page budget across keyword variants to stay inside the engine deadline.
    const pagesPerKeyword = Math.max(1, Math.ceil(maxPages / keywords.length));

    try {
      const rawProducts = await client.searchProducts({
        keywords,
        maxPages: pagesPerKeyword,
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