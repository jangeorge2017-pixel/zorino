import { createAliExpressClientFromEnv } from "@/lib/integrations/aliexpress";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress/config";
import { attachOpenApiAffiliateLinks } from "@/lib/integrations/aliexpress/open-api-service";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";
import { normalizeAliExpressRaw } from "@/lib/search/normalization";
import { queryWantsAccessory } from "@/lib/search/relevance";
import type { RawProviderListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ConnectorSearchOptions, SearchConnector } from "@/lib/search/connectors/types";
import type { AliExpressRawProduct } from "@/lib/integrations/aliexpress/types";

const PARALLEL_PAGE_BATCH = 4;

async function getClient() {
  await loadAliExpressCredentials();
  if (!isAliExpressConfigured()) return null;
  return createAliExpressClientFromEnv();
}

function ingestBatch(
  batch: AliExpressRawProduct[],
  listings: RawProviderListing[],
  seenIds: Set<string>,
) {
  for (const raw of batch) {
    const id = raw.product_id != null ? String(raw.product_id) : "";
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    const normalized = normalizeAliExpressRaw(raw);
    if (normalized) listings.push(normalized);
  }
}

/**
 * AliExpress keyword catalog is accessory-heavy for phone/laptop queries.
 * Add device-oriented variants so ranking has real products to interleave —
 * not fake injected cards, just better parallel fetch coverage.
 */
function buildAliExpressSearchQueries(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (queryWantsAccessory(trimmed)) return [trimmed];

  const variants = [trimmed];
  const lower = trimmed.toLowerCase();

  if (/\b(iphone|samsung|galaxy|pixel|xiaomi|redmi|poco|oneplus|oppo|vivo|huawei|honor)\b/.test(lower)) {
    variants.push(`${trimmed} smartphone`);
    variants.push(`${trimmed} unlocked`);
    if (/\biphone\b/.test(lower)) {
      variants.push(`apple ${trimmed} mobile phone`.replace(/\s+/g, " ").trim());
    }
  } else if (/\b(laptop|macbook|notebook)\b/.test(lower)) {
    variants.push(`${trimmed} computer`);
    variants.push(`${trimmed} notebook`);
  } else if (/\b(ps5|playstation|switch|xbox)\b/.test(lower)) {
    variants.push(`${trimmed} console`);
  }

  return [...new Set(variants.map((v) => v.trim()).filter(Boolean))].slice(0, 3);
}

async function searchKeywordPages(
  client: NonNullable<Awaited<ReturnType<typeof getClient>>>,
  keyword: string,
  options: {
    pageSize: number;
    maxPages: number;
    targetFetch: number;
    currency: string;
  },
): Promise<AliExpressRawProduct[]> {
  const collected: AliExpressRawProduct[] = [];
  let exhausted = false;

  for (let startPage = 1; startPage <= options.maxPages && !exhausted; startPage += PARALLEL_PAGE_BATCH) {
    const pageNumbers = Array.from(
      { length: PARALLEL_PAGE_BATCH },
      (_, index) => startPage + index,
    ).filter((pageNo) => pageNo <= options.maxPages);

    const batches = await Promise.all(
      pageNumbers.map((pageNo) =>
        client.searchByKeyword(keyword, {
          pageSize: options.pageSize,
          pageNo,
          currency: options.currency,
        }),
      ),
    );

    let shortestBatch = options.pageSize;
    for (const batch of batches) {
      if (batch.length === 0) {
        exhausted = true;
        continue;
      }
      shortestBatch = Math.min(shortestBatch, batch.length);
      collected.push(...batch);
    }

    if (collected.length >= options.targetFetch) break;
    if (shortestBatch < options.pageSize) break;
  }

  return collected;
}

export const aliExpressSearchConnector: SearchConnector = {
  id: "aliexpress",
  name: "AliExpress",

  async isAvailable() {
    await loadAliExpressCredentials();
    return isAliExpressConfigured();
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const client = await getClient();
    if (!client) return [];

    const pageSize = options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
    const maxPages = options?.maxPages ?? SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER;
    const targetFetch = options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT;
    const minFetch = options?.minFetch ?? SEARCH_ENGINE_DEFAULTS.MIN_FETCH_COUNT;
    const currency = options?.currency ?? "USD";

    const keywords = buildAliExpressSearchQueries(trimmed);
    // Split page budget across keyword variants so we don't explode latency.
    const pagesPerKeyword = Math.max(2, Math.ceil(maxPages / keywords.length));
    const fetchPerKeyword = Math.max(minFetch, Math.ceil(targetFetch / keywords.length));

    const listings: RawProviderListing[] = [];
    const seenIds = new Set<string>();

    try {
      const rawGroups = await Promise.all(
        keywords.map((keyword) =>
          searchKeywordPages(client, keyword, {
            pageSize,
            maxPages: pagesPerKeyword,
            targetFetch: fetchPerKeyword,
            currency,
          }),
        ),
      );

      const collectedRaw: AliExpressRawProduct[] = [];
      const seenRaw = new Set<string>();
      for (const group of rawGroups) {
        for (const raw of group) {
          const id = raw.product_id != null ? String(raw.product_id) : "";
          if (!id || seenRaw.has(id)) continue;
          seenRaw.add(id);
          collectedRaw.push(raw);
        }
      }

      const withLinks = await attachOpenApiAffiliateLinks(
        client,
        collectedRaw.slice(0, Math.max(targetFetch, minFetch) * 2),
      );
      ingestBatch(withLinks, listings, seenIds);
      return listings;
    } catch (error) {
      console.error(
        "[aliexpress-connector]",
        error instanceof Error ? error.message : "AliExpress search failed",
      );
      return listings;
    }
  },
};
