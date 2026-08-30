import type { SearchConnector, ConnectorSearchOptions } from "./types";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import { getAllAdmitadFeeds } from "@/lib/integrations/admitad/config";
import {
  normalizeProductImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/images/product-image";
import { normalizeAdmitadRaw } from "@/lib/search/normalization";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import { fetchAdmitadFeedProducts } from "@/lib/integrations/admitad/feed-fetcher";

const MAX_RESULTS_FROM_FEED = 200;

type IngestedRow = {
  product_slug: string;
  product_name: string;
  image_url: string | null;
  lowest_price: number;
  original_price: number | null;
  discount_percent: number | null;
  store_name: string;
  affiliate_url: string | null;
  external_url: string | null;
  currency: string;
};

/**
 * Supplement live-feed results with freshly INGESTED rows from
 * lowest_prices_today (same real provider data, persisted by the ingestion
 * pipeline). Keeps search results stable on cold instances where feed
 * downloads are still in flight.
 */
async function searchIngestedRows(
  query: string,
  targetCount: number,
  seenIds: Set<string>,
): Promise<RawProviderListing[]> {
  try {
    const { createSupabaseAnonClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseAnonClient();
    if (!supabase) return [];

    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) return [];

    const orFilter = words.map((w) => `product_name.ilike.%${w}%`).join(",");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("lowest_prices_today")
      .select(
        "product_slug, product_name, image_url, lowest_price, original_price, discount_percent, store_name, affiliate_url, external_url, currency",
      )
      .eq("provider", "admitad")
      .or(orFilter)
      .not("image_url", "is", null)
      .neq("image_url", "")
      .limit(Math.max(targetCount * 2, 60));

    if (error || !data?.length) return [];

    const listings: RawProviderListing[] = [];
    for (const row of data as IngestedRow[]) {
      if (listings.length >= targetCount) break;
      if (!row.product_slug || !row.product_name || !(row.lowest_price > 0)) continue;
      if (!row.affiliate_url && !row.external_url) continue;
      if (seenIds.has(`db:${row.product_slug}`)) continue;
      seenIds.add(`db:${row.product_slug}`);

      const originalPrice =
        row.original_price && row.original_price > row.lowest_price
          ? row.original_price
          : row.lowest_price;
      const url = row.affiliate_url || row.external_url || "";
      const imageUrl = normalizeProductImageUrl(row.image_url || "");
      // Never surface a row whose image resolves to the placeholder.
      if (imageUrl === PRODUCT_IMAGE_PLACEHOLDER) continue;

      listings.push({
        providerId: "admitad",
        // product_slug is "admitad-<campaign>-<offer>"; downstream
        // toNormalizedListing prepends "admitad-" once, so strip it here.
        externalId: row.product_slug.replace(/^admitad-/, ""),
        title: row.product_name,
        imageUrl,
        price: row.lowest_price,
        originalPrice,
        discount:
          row.discount_percent !== null && row.discount_percent >= 0
            ? Math.round(row.discount_percent)
            : Math.max(0, Math.round(((originalPrice - row.lowest_price) / originalPrice) * 100)),
        currency: row.currency || "USD",
        storeName: row.store_name || "Alibaba",
        category: "General",
        rating: 0,
        reviewCount: 0,
        inStock: true,
        productUrl: url,
        affiliateUrl: url,
      });
    }
    return listings;
  } catch (err) {
    console.error(
      "[admitad] ingested-row supplement failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Admitad search connector.
 *
 * Searches ALL cached Admitad merchant feeds (primary ADMITAD_FEED_URL plus
 * every program discovered via the Publisher API) through the shared
 * feed-fetcher (in-memory cache, same source as the homepage) and normalizes
 * results through the standard pipeline — same pattern as AliExpress/eBay.
 */
export const admitadSearchConnector: SearchConnector = {
  id: "admitad" as SearchProviderId,
  name: "Alibaba & Partners",

  async isAvailable() {
    try {
      const feeds = await getAllAdmitadFeeds();
      return feeds.length > 0;
    } catch {
      return false;
    }
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    try {
      const feeds = await getAllAdmitadFeeds();
      if (feeds.length === 0) return [];

      const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

      const pageSize = options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
      const maxPages = options?.maxPages ?? SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER;
      const targetCount = Math.min(pageSize * maxPages, MAX_RESULTS_FROM_FEED);

      // Shared cached multi-feed fetch — no per-query network refetch.
      const feedResults = await fetchAdmitadFeedProducts();

      const listings: RawProviderListing[] = [];
      const seenIds = new Set<string>();

      for (const feedResult of feedResults) {
        for (const offer of feedResult.offers) {
          if (listings.length >= targetCount) break;

          const nameLower = offer.name.toLowerCase();
          const matches =
            queryWords.length === 0 ||
            queryWords.some((w) => nameLower.includes(w));
          if (!matches) continue;

          const dedupeKey = `${feedResult.feedSlug}:${offer.id}`;
          if (seenIds.has(dedupeKey)) continue;
          seenIds.add(dedupeKey);

          const image = normalizeProductImageUrl(offer.image || "");
          // Skip offers that have no usable product image — never emit a
          // placeholder-image search card as real data.
          if (image === PRODUCT_IMAGE_PLACEHOLDER) continue;

          const normalized = normalizeAdmitadRaw(
            {
              // Plain offer id — normalizeAdmitadRaw + toNormalizedListing add
              // the provider prefix themselves; feeding them an
              // already-prefixed id stacks it (admitad-admitad-…).
              id: offer.id,
              name: offer.name,
              price: offer.price,
              oldprice: offer.oldprice,
              currencyId: offer.currencyId,
              url: offer.url,
              image,
              vendor: offer.vendor,
            },
            feedResult.feedName,
          );
          if (!normalized) continue;
          // Campaign-qualified, prefix-free external id → final slug becomes
          // admitad-<campaignId>-<offerId>, matching homepage/product routes.
          normalized.externalId = `${feedResult.feedSlug.replace(/^admitad-/, "")}-${offer.id}`;
          listings.push(normalized);
        }
      }

      // Cold-instance safety net: top up from ingested DB rows so search
      // reliably returns real Admitad merchant products even when live feed
      // downloads are still warming up.
      let dbTopUp: RawProviderListing[] = [];
      if (listings.length < targetCount) {
        dbTopUp = await searchIngestedRows(query, targetCount - listings.length, seenIds);
        listings.push(...dbTopUp);
      }

      console.log(
        `[admitad] search "${query}": ${feedResults.length} feeds, ${listings.length} listings (${dbTopUp} from ingested rows)`,
      );

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
