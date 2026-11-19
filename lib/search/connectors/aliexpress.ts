import { createAliExpressClientFromEnv } from "@/lib/integrations/aliexpress";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress/config";
import { fetchTextSafely } from "@/lib/integrations/egypt-stores/http";
import {
  cleanTitle,
  getAttribute,
  parseMoney,
  resolveUrl,
  stripTags,
} from "@/lib/integrations/egypt-stores/parse";
import { attachOpenApiAffiliateLinks } from "@/lib/integrations/aliexpress/open-api-service";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";
import { normalizeAliExpressRaw } from "@/lib/search/normalization";
import { queryWantsAccessory } from "@/lib/search/relevance";
import { getProviderSearchCapabilities } from "@/lib/search/provider-capabilities";
import {
  analyzeSearchQueryIntent,
  buildExpandedSearchQueries,
} from "@/lib/search/query-intent";
import type { RawProviderListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ConnectorSearchOptions, SearchConnector } from "@/lib/search/connectors/types";
import type { AliExpressRawProduct } from "@/lib/integrations/aliexpress/types";

// Lower than before: AliExpress aggressively rate-limits the Open Platform when
// many product.query calls fire at once (HTTP 429 / flow limit / ECONNRESET),
// and the whole search fan-out is capped at PROVIDER_FETCH_TIMEOUT_MS in
// engine.ts. Fewer concurrent pages per batch keeps the connector inside both
// budgets so it reliably returns real products instead of intermittently
// zeroing out.
const PARALLEL_PAGE_BATCH = 2;

// Cap the affiliate-link generation batch. The engine deadline is tight and a
// huge promotion-link payload adds several seconds with little benefit — the
// products already carry product_detail_url and are only enriched when the
// batch is small enough to finish. Matches the API's own 50-source_values
// limit; this only bounds ENRICHMENT, never how many fetched listings are
// ingested (see the connector below).
const MAX_AFFILIATE_LINK_SLICE = 50;

const STOREFRONT_BASE_URL = "https://www.aliexpress.com";
const STOREFRONT_TIMEOUT_MS = 6_500;
const STOREFRONT_MIN_LISTINGS = 10;

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
 *
 * The device-aware branch is opt-in (`optimizeForDeviceIntent`); the legacy
 * branch below is byte-for-byte the original variant list so the homepage
 * catalog fan-out is unaffected.
 */
export function buildAliExpressSearchQueries(
  query: string,
  options?: ConnectorSearchOptions,
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (queryWantsAccessory(trimmed)) return [trimmed];

  if (options?.optimizeForDeviceIntent === true) {
    const intent = options.intent ?? analyzeSearchQueryIntent(trimmed);
    const capabilities = getProviderSearchCapabilities("aliexpress");
    const appendTerms = capabilities.deviceAppendTerms?.[intent.family];
    return buildExpandedSearchQueries(trimmed, appendTerms, { maxVariants: 3 });
  }

  return buildLegacyAliExpressSearchQueries(trimmed);
}

function buildLegacyAliExpressSearchQueries(trimmed: string): string[] {
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

    const batches = await Promise.allSettled(
      pageNumbers.map((pageNo) =>
        client.searchByKeyword(keyword, {
          pageSize: options.pageSize,
          pageNo,
          currency: options.currency,
        }),
      ),
    );

    let shortestBatch = options.pageSize;
    let anySettled = false;
    for (const batch of batches) {
      if (batch.status === "rejected") {
        // Rate-limit / transient failure on one page must not abort the others.
        console.warn(
          "[aliexpress-connector] page failed (non-fatal)",
          batch.reason instanceof Error ? batch.reason.message : String(batch.reason),
        );
        continue;
      }
      anySettled = true;
      const page = batch.value;
      if (page.length === 0) {
        exhausted = true;
        continue;
      }
      shortestBatch = Math.min(shortestBatch, page.length);
      collected.push(...page);
    }

    // If every page in this batch failed, stop paginating rather than hammering.
    if (!anySettled) break;
    if (collected.length >= options.targetFetch) break;
    if (shortestBatch < options.pageSize) break;
  }

  return collected;
}

/**
 * Storefront HTML fallback. The Open API key is optional: when it is missing,
 * rate-limited, or slow on a given egress cell the server-rendered search page
 * still carries real AliExpress product cards (id, title, image, price, and a
 * native /item/<id>.html URL). Every field is read from that real HTML; nothing
 * is synthesized.
 */
function parseAliExpressStorefrontHtml(html: string): AliExpressRawProduct[] {
  const starts = [
    ...html.matchAll(
      /<div\b[^>]*class="[^"]*search-item-card-wrapper-gallery[^"]*"[^>]*>/gi,
    ),
  ]
    .map((match) => match.index ?? -1)
    .filter((index) => index >= 0);
  const results: AliExpressRawProduct[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i]!;
    const end = starts[i + 1] ?? Math.min(html.length, start + 30_000);
    const block = html.slice(start, end);

    const linkTag =
      /<a\b[^>]*class="[^"]*search-card-item[^"]*"[^>]*>/i.exec(block)?.[0] ?? "";
    const productUrl = resolveUrl(getAttribute(linkTag, "href"), STOREFRONT_BASE_URL);
    const productId = productUrl ? /\/item\/(\d+)\.html/i.exec(productUrl)?.[1] : undefined;
    if (!productUrl || !productId || seen.has(productId)) continue;

    const imageTag =
      /<img\b[^>]*class="[^"]*images--item[^"]*"[^>]*>/i.exec(block)?.[0] ?? "";
    const imageUrl = resolveUrl(
      getAttribute(imageTag, "src") ?? getAttribute(imageTag, "data-src"),
      STOREFRONT_BASE_URL,
    );
    if (!imageUrl?.startsWith("https://")) continue;

    const titleMarkup =
      /<h3\b[^>]*class="[^"]*new--titleText[^"]*"[^>]*>([\s\S]*?)<\/h3>/i.exec(block)?.[1];
    const title = cleanTitle(stripTags(titleMarkup ?? getAttribute(imageTag, "alt") ?? ""));
    if (!title) continue;

    const priceMatch =
      /<div class="new--price-sale[^"]*"[^>]*>[\s\S]*?<span[^>]*>\s*([A-Z]{3})\s*([\d,.]+)\s*<\/span>/i.exec(
        block,
      );
    const price = parseMoney(priceMatch?.[2]);
    if (!price) continue;

    const originalMatch =
      /<div class="new--price-(?:original|old)[^"]*"[^>]*>[\s\S]{0,300}?<span[^>]*>\s*(?:[A-Z]{3})?\s*([\d,.]+)\s*<\/span>/i.exec(
        block,
      );
    const original = parseMoney(originalMatch?.[1]);

    seen.add(productId);
    results.push({
      product_id: productId,
      product_title: title,
      product_main_image_url: imageUrl,
      target_sale_price: String(price),
      target_original_price: original > price ? String(original) : String(price),
      target_sale_price_currency: priceMatch?.[1] ?? "EGP",
      product_detail_url: productUrl,
      promotion_link: productUrl,
      first_level_category_name: "General",
    });
  }

  return results;
}

async function fetchAliExpressStorefront(
  keywords: readonly string[],
  target: number,
): Promise<AliExpressRawProduct[]> {
  const collected: AliExpressRawProduct[] = [];
  const seen = new Set<string>();

  await Promise.allSettled(
    keywords.slice(0, 2).map(async (keyword) => {
      const url = `${STOREFRONT_BASE_URL}/w/wholesale-${encodeURIComponent(keyword)}.html`;
      const html = await fetchTextSafely(url, {
        timeoutMs: STOREFRONT_TIMEOUT_MS,
        headers: { "accept-language": "en-US,en;q=0.9" },
      });
      if (!html) return;
      for (const raw of parseAliExpressStorefrontHtml(html)) {
        const id = String(raw.product_id ?? "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        collected.push(raw);
      }
    }),
  );

  return collected.slice(0, Math.max(1, target));
}

export const aliExpressSearchConnector: SearchConnector = {
  id: "aliexpress",
  name: "AliExpress",

  async isAvailable() {
    await loadAliExpressCredentials();
    // The storefront HTML fallback needs no credentials. Keeping the connector
    // active is what lets Render serve real AliExpress cards even when the Open
    // API app key is absent or rate-limited in that egress cell.
    return true;
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const client = await getClient();

    const pageSize = options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
    const maxPages = options?.maxPages ?? SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER;
    const targetFetch = options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT;
    const minFetch = options?.minFetch ?? SEARCH_ENGINE_DEFAULTS.MIN_FETCH_COUNT;
    const currency = options?.currency ?? "USD";

    const keywords = buildAliExpressSearchQueries(trimmed, options);
    // Split page budget across keyword variants so we don't explode latency.
    const pagesPerKeyword = Math.max(2, Math.ceil(maxPages / keywords.length));
    const fetchPerKeyword = Math.max(minFetch, Math.ceil(targetFetch / keywords.length));

    const listings: RawProviderListing[] = [];
    const seenIds = new Set<string>();

    if (client) {
      try {
        const rawGroups = await Promise.allSettled(
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
          if (group.status === "rejected") {
            // A rate-limited keyword must not discard whatever other keywords
            // already returned.
            console.warn(
              "[aliexpress-connector] keyword fan-out failed (non-fatal)",
              group.reason instanceof Error ? group.reason.message : String(group.reason),
            );
            continue;
          }
          for (const raw of group.value) {
            const id = raw.product_id != null ? String(raw.product_id) : "";
            if (!id || seenRaw.has(id)) continue;
            seenRaw.add(id);
            collectedRaw.push(raw);
          }
        }

        // Enrich a bounded leading batch with tracked affiliate links (the link
        // API generates at most 50 per call). EVERY other fetched listing is
        // still ingested with its real product URL — previously the enrichment
        // slice doubled as an ingestion cap and silently discarded ~90% of the
        // real AliExpress products the connector had already fetched.
        const withLinks = await attachOpenApiAffiliateLinks(
          client,
          collectedRaw.slice(0, MAX_AFFILIATE_LINK_SLICE),
        );
        ingestBatch(withLinks, listings, seenIds);
        ingestBatch(collectedRaw.slice(MAX_AFFILIATE_LINK_SLICE), listings, seenIds);
      } catch (error) {
        console.error(
          "[aliexpress-connector]",
          error instanceof Error ? error.message : "AliExpress search failed",
        );
      }
    }

    if (listings.length < STOREFRONT_MIN_LISTINGS) {
      try {
        const storefrontRaw = await fetchAliExpressStorefront(keywords, targetFetch);
        ingestBatch(storefrontRaw, listings, seenIds);
      } catch (error) {
        console.warn(
          "[aliexpress-connector] storefront fallback failed (non-fatal)",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return listings;
  },
};
