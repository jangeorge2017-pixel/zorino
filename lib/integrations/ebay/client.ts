import type { ImportJobConfig } from "@/lib/sync/providers/shared/import-config";
import { fetchJson } from "@/lib/sync/providers/shared/http";
import {
  buildEbayAffiliateContext,
  ebayMarketplaceId,
  getEbayAccessToken,
} from "@/lib/integrations/ebay/auth";
import { EBAY_BROWSE_API } from "@/lib/integrations/ebay/config";
import type { EbayRawProduct, EbayValidationResult } from "@/lib/integrations/ebay/types";

type SearchResponse = {
  itemSummaries?: EbayRawProduct[];
  total?: number;
};

export class EbayAffiliateClient {
  constructor(
    private campaignId?: string,
    private referenceId?: string
  ) {}

  async validateCredentials(): Promise<EbayValidationResult> {
    const testedAt = new Date().toISOString();
    try {
      const items = await this.searchProducts(
        { keywords: ["phone"], maxPages: 1, pageSize: 1 },
        "US"
      );
      return {
        ok: true,
        message: items.length
          ? "eBay Browse API credentials are valid."
          : "eBay API connected — no items returned for test query.",
        testedAt,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Validation failed",
        testedAt,
      };
    }
  }

  async searchProducts(
    config: ImportJobConfig,
    countryCode: string
  ): Promise<EbayRawProduct[]> {
    const token = await getEbayAccessToken();
    const marketplaceId = ebayMarketplaceId(countryCode);
    const keywords = config.keywords ?? ["electronics"];
    const maxPages = config.maxPages ?? 2;
    const pageSize = Math.min(config.pageSize ?? 20, 50);

    const all: EbayRawProduct[] = [];

    for (const keyword of keywords) {
      for (let offset = 0, page = 0; page < maxPages; page++, offset += pageSize) {
        const params = new URLSearchParams({
          q: keyword,
          limit: String(pageSize),
          offset: String(offset),
        });

        const batch = await fetchJson<SearchResponse>(
          `${EBAY_BROWSE_API}/item_summary/search?${params}`,
          {
            headers: this.buildHeaders(token, marketplaceId),
          }
        );

        const items = batch.itemSummaries ?? [];
        all.push(...items);
        if (items.length < pageSize) break;
      }
    }

    return dedupeById(all);
  }

  async getItemsByIds(itemIds: string[], countryCode: string): Promise<EbayRawProduct[]> {
    if (itemIds.length === 0) return [];

    const token = await getEbayAccessToken();
    const marketplaceId = ebayMarketplaceId(countryCode);
    const all: EbayRawProduct[] = [];

    for (const itemId of itemIds.slice(0, 20)) {
      try {
        const item = await fetchJson<EbayRawProduct>(
          `${EBAY_BROWSE_API}/item/${encodeURIComponent(itemId)}`,
          {
            headers: this.buildHeaders(token, marketplaceId),
          }
        );
        all.push(item);
      } catch {
        // skip unavailable listings
      }
    }

    return all;
  }

  private buildHeaders(token: string, marketplaceId: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      "Accept-Language": "en-US",
    };

    const affiliateContext = buildEbayAffiliateContext(this.campaignId, this.referenceId);
    if (affiliateContext) {
      headers["X-EBAY-C-ENDUSERCTX"] = affiliateContext;
    }

    return headers;
  }
}

function dedupeById(items: EbayRawProduct[]): EbayRawProduct[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = item.itemId ?? item.title ?? "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
