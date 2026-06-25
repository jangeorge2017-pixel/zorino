import type { ImportJobConfig } from "@/lib/sync/providers/shared/import-config";
import { fetchJson } from "@/lib/sync/providers/shared/http";
import { ebayMarketplaceId, getEbayAccessToken } from "@/lib/sync/providers/ebay/auth";

const BROWSE_API = "https://api.ebay.com/buy/browse/v1";

type EbayItemSummary = {
  itemId?: string;
  title?: string;
  price?: { value?: string; currency?: string };
  image?: { imageUrl?: string };
  additionalImages?: { imageUrl?: string }[];
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
  shortDescription?: string;
  condition?: string;
  seller?: { username?: string };
  estimatedAvailabilities?: { estimatedAvailableQuantity?: number }[];
  buyingOptions?: string[];
};

type SearchResponse = {
  itemSummaries?: EbayItemSummary[];
  total?: number;
};

export class EbayClient {
  async searchProducts(
    config: ImportJobConfig,
    countryCode: string
  ): Promise<EbayItemSummary[]> {
    const token = await getEbayAccessToken();
    const marketplaceId = ebayMarketplaceId(countryCode);
    const keywords = config.keywords ?? ["electronics"];
    const maxPages = config.maxPages ?? 2;
    const pageSize = Math.min(config.pageSize ?? 20, 50);

    const all: EbayItemSummary[] = [];

    for (const keyword of keywords) {
      for (let offset = 0, page = 0; page < maxPages; page++, offset += pageSize) {
        const params = new URLSearchParams({
          q: keyword,
          limit: String(pageSize),
          offset: String(offset),
        });

        const batch = await fetchJson<SearchResponse>(
          `${BROWSE_API}/item_summary/search?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
              "Accept-Language": "en-US",
            },
          }
        );

        const items = batch.itemSummaries ?? [];
        all.push(...items);
        if (items.length < pageSize) break;
      }
    }

    return dedupeById(all);
  }

  async getItemsByIds(itemIds: string[], countryCode: string): Promise<EbayItemSummary[]> {
    if (itemIds.length === 0) return [];

    const token = await getEbayAccessToken();
    const marketplaceId = ebayMarketplaceId(countryCode);
    const all: EbayItemSummary[] = [];

    for (const itemId of itemIds.slice(0, 20)) {
      try {
        const item = await fetchJson<EbayItemSummary>(
          `${BROWSE_API}/item/${encodeURIComponent(itemId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
            },
          }
        );
        all.push(item);
      } catch {
        // skip unavailable listings
      }
    }

    return all;
  }
}

function dedupeById(items: EbayItemSummary[]): EbayItemSummary[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = item.itemId ?? item.title ?? "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
