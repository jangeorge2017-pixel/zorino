import type { ImportJobConfig } from "@/lib/sync/providers/shared/import-config";
import { fetchJson } from "@/lib/sync/providers/shared/http";
import {
  buildEbayAffiliateContext,
  ebayMarketplaceId,
  getEbayAccessToken,
} from "@/lib/integrations/ebay/auth";
import { getEbayBrowseApiBase } from "@/lib/integrations/ebay/config";
import type { EbayRawProduct, EbayValidationResult } from "@/lib/integrations/ebay/types";

type SearchResponse = {
  itemSummaries?: EbayRawProduct[];
  total?: number;
};

/**
 * Pure builder for the Browse `/item_summary/search` query string. eBay accepts
 * at most ONE `category_ids` value per request and still requires `q`, so the
 * category is only added when explicitly supplied — the default path produces
 * exactly the same params as before. No condition filter is ever added.
 */
export function buildBrowseSearchParams(input: {
  q: string;
  limit: number;
  offset: number;
  categoryIds?: string;
}): URLSearchParams {
  const params = new URLSearchParams({
    q: input.q,
    limit: String(input.limit),
    offset: String(input.offset),
  });
  const category = input.categoryIds?.trim();
  if (category) params.set("category_ids", category);
  return params;
}

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
      const items = await this.searchByKeyword(keyword, {
        countryCode,
        pageSize,
        maxPages,
        token,
        marketplaceId,
      });
      all.push(...items);
    }

    return dedupeById(all);
  }

  /** Keyword search for live product discovery (search / compare flows). */
  async searchByKeyword(
    keyword: string,
    options?: {
      countryCode?: string;
      pageSize?: number;
      maxPages?: number;
      token?: string;
      marketplaceId?: string;
      /** Optional single US eBay category id (Browse `category_ids`). */
      categoryIds?: string;
      /**
       * Pages fetched concurrently per batch. Defaults to 1 (strictly
       * sequential — identical to the original behaviour). Callers sharing a
       * tight latency budget may raise it so a device search still fills its
       * pages before the provider fan-out deadline.
       */
      pageBatch?: number;
    }
  ): Promise<EbayRawProduct[]> {
    const countryCode = options?.countryCode ?? "US";
    const pageSize = Math.min(Math.max(options?.pageSize ?? 50, 1), 50);
    const maxPages = options?.maxPages ?? 1;
    const token = options?.token ?? (await getEbayAccessToken());
    const marketplaceId = options?.marketplaceId ?? ebayMarketplaceId(countryCode);
    const categoryIds = options?.categoryIds;
    const batchSize = Math.min(Math.max(options?.pageBatch ?? 1, 1), Math.max(maxPages, 1));
    const q = keyword.trim();
    if (!q) return [];

    const all: EbayRawProduct[] = [];

    const fetchPage = (page: number) =>
      fetchJson<SearchResponse>(
        `${getEbayBrowseApiBase()}/item_summary/search?${buildBrowseSearchParams({
          q,
          limit: pageSize,
          offset: page * pageSize,
          categoryIds,
        })}`,
        {
          headers: this.buildHeaders(token, marketplaceId),
          timeoutMs: 12_000,
        }
      );

    if (batchSize === 1) {
      for (let page = 0; page < maxPages; page++) {
        const items = (await fetchPage(page)).itemSummaries ?? [];
        all.push(...items);
        if (items.length < pageSize) break;
      }
      return dedupeById(all);
    }

    for (let start = 0; start < maxPages; start += batchSize) {
      const pages = Array.from(
        { length: Math.min(batchSize, maxPages - start) },
        (_, index) => start + index
      );
      const settled = await Promise.allSettled(pages.map((page) => fetchPage(page)));
      let sawShortPage = false;
      for (const result of settled) {
        if (result.status === "rejected") {
          // A single page failing under the shared search deadline must not
          // discard the pages that did return.
          sawShortPage = true;
          continue;
        }
        const items = result.value.itemSummaries ?? [];
        all.push(...items);
        if (items.length < pageSize) sawShortPage = true;
      }
      if (sawShortPage) break;
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
          `${getEbayBrowseApiBase()}/item/${encodeURIComponent(itemId)}`,
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
