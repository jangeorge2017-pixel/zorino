import type { SearchConnector, ConnectorSearchOptions } from "@/lib/search/connectors/types";
import type { RawProviderListing } from "@/lib/search/types";
import { getAmazonCredentials, isAmazonConfigured, isAmazonDirectEnabled } from "@/lib/integrations/amazon/config";
import { getCreatorsAccessToken } from "@/lib/integrations/amazon/auth";
import {
  fetchAmazonProductScraper,
  fetchAmazonSearchScraper,
  isAmazonScraperAvailable,
} from "@/lib/integrations/amazon-scraper";
import { normalizeAmazonScraperRaw } from "@/lib/search/normalization";
import { normalizeAmazonScraperSearchResults } from "@/lib/search/normalization";
import { AMAZON_EG_SEED_LINKS } from "@/lib/amazon-eg/seed-links";

/**
 * Amazon Egypt search connector.
 * Uses real amazon.eg storefront scraping (no API keys required) for keyword
 * searches and ASIN product lookups, feeding the same "amazon-eg" mapping.
 * Falls back to seed-link ASINs enriched via the Creators API when credentials
 * are available. Without either real source the connector returns [] so no
 * broken (price: 0 / placeholder-image) cards appear in search or on the
 * homepage. The /stores/amazon-eg page shows seed-link buttons independently.
 */

const EG_MARKETPLACE = "www.amazon.eg";
const EG_ASSOCIATE_TAG = "zorinoeg-21";

const GET_RESOURCES = [
  "images.primary.large",
  "itemInfo.title",
  "itemInfo.byLineInfo",
  "itemInfo.classifications",
  "offersV2.listings.price",
  "offersV2.listings.availability",
  "offersV2.listings.condition",
];

type EGRawProduct = {
  asin: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  currency: string;
  inStock: boolean;
  rating: number;
  reviewCount: number;
  affiliateUrl: string;
  category: string;
};

function parsePriceAmount(amount: number | undefined, displayAmount?: string): number {
  if (displayAmount) {
    const parsed = parseFloat(displayAmount.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (amount == null || !Number.isFinite(amount)) return 0;
  if (amount > 0 && amount < 50_000) return amount;
  return amount / 100;
}

async function fetchEgProductsByAsins(asins: string[]): Promise<Map<string, EGRawProduct>> {
  const creds = getAmazonCredentials();
  if (!creds || asins.length === 0) return new Map();

  let token: string;
  try {
    token = await getCreatorsAccessToken({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      version: creds.version,
    });
  } catch {
    return new Map();
  }

  const results = new Map<string, EGRawProduct>();

  for (const asin of asins) {
    try {
      const response = await fetch("https://creatorsapi.amazon/catalog/v1/getItems", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-marketplace": EG_MARKETPLACE,
        },
        body: JSON.stringify({
          ItemIds: [asin],
          PartnerTag: EG_ASSOCIATE_TAG,
          Marketplace: EG_MARKETPLACE,
          Resources: GET_RESOURCES,
        }),
        cache: "no-store",
      });

      if (!response.ok) continue;

      const parsed = await response.json() as {
        itemsResult?: { items?: Array<{
          asin?: string;
          detailPageURL?: string;
          images?: { primary?: { large?: { url?: string }; medium?: { url?: string } } };
          itemInfo?: {
            title?: { displayValue?: string };
            byLineInfo?: { brand?: { displayValue?: string } };
            classifications?: { productGroup?: { displayValue?: string } };
          };
          offersV2?: { listings?: Array<{
            price?: {
              money?: { amount?: number; displayAmount?: string; currency?: string };
              savingBasis?: { money?: { amount?: number; displayAmount?: string } };
            };
            availability?: { type?: string };
          }> };
        }> };
        errors?: Array<{ code?: string; message?: string }>;
      };

      if (parsed.errors?.length) continue;

      const item = parsed.itemsResult?.items?.[0];
      if (!item?.asin) continue;

      const title = item.itemInfo?.title?.displayValue?.trim();
      if (!title) continue;

      const listing = item.offersV2?.listings?.[0];
      const priceMoney = listing?.price?.money;
      const price = parsePriceAmount(priceMoney?.amount, priceMoney?.displayAmount);
      if (!price || price <= 0) continue;

      const imageUrl = item.images?.primary?.large?.url ?? item.images?.primary?.medium?.url ?? "";
      if (!imageUrl.startsWith("http")) continue;

      const savingBasisMoney = listing?.price?.savingBasis?.money;
      const original = parsePriceAmount(savingBasisMoney?.amount, savingBasisMoney?.displayAmount);
      const originalPrice = original > price ? original : price;

      const availType = listing?.availability?.type?.toLowerCase() ?? "";
      const inStock = !availType.includes("out_of_stock");
      const category = item.itemInfo?.classifications?.productGroup?.displayValue?.trim() ?? "General";

      results.set(item.asin, {
        asin: item.asin,
        title,
        imageUrl,
        price,
        originalPrice,
        currency: priceMoney?.currency ?? "EGP",
        inStock,
        rating: 0,
        reviewCount: 0,
        affiliateUrl: `${item.detailPageURL ?? `https://www.amazon.eg/dp/${item.asin}`}${item.detailPageURL?.includes("?") ? "&" : "?"}tag=${EG_ASSOCIATE_TAG}`,
        category,
      });
    } catch {
      // Skip ASINs that fail — graceful degradation
    }
  }

  return results;
}

export const amazonEgSearchConnector: SearchConnector = {
  id: "amazon-eg",
  name: "Amazon Egypt",

  async isAvailable(): Promise<boolean> {
    // A REAL Amazon Egypt data source (Creators API credentials OR the local
    // open-source storefront scraper, which needs no keys) makes the store
    // available. Without either there is no genuine amazon.eg product data, so
    // the connector must not report as operational.
    //
    // Phase 5 decision (AMAZON-EG IS INDIRECT): this is the LATENT DIRECT path
    // (seed ASINs / query → Creators API getItems / storefront scraper). It
    // must NOT activate merely because credentials are later added — it
    // requires the explicit AMAZON_DIRECT_ENABLE=1 architecture opt-in. The
    // approved indirect path (affiliate URL → host-guarded ASIN → ingestion)
    // does not use this connector.
    //
    // Phase 6 (current): Oxylabs subscription retired (401). The local
    // storefront scraper (fetchAmazonSearchScraper on amazon.eg) is the
    // production source — additive, no credentials required.
    return isAmazonDirectEnabled() && (isAmazonConfigured() || isAmazonScraperAvailable());
  },

  async search(
    query: string,
    _options?: ConnectorSearchOptions
  ): Promise<RawProviderListing[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    // Additive local scraper source: real amazon.eg keyword search results.
    // Feeds the SAME "amazon-eg" store mapping and does not replace the
    // seed-link / Creators path below (which remains the fallback).
    try {
      const searchResults = await fetchAmazonSearchScraper(trimmed, "amazon-eg");
      const sListing = normalizeAmazonScraperSearchResults(searchResults, "amazon-eg");
      if (sListing.length > 0) return sListing;
    } catch {
      // A scraper failure must never silence the existing Egypt path.
    }

    // Match seed products whose title contains any query word
    const words = trimmed.split(/\s+/).filter((w) => w.length > 1);
    const matched = words.length === 0
      ? AMAZON_EG_SEED_LINKS
      : AMAZON_EG_SEED_LINKS.filter((link) =>
          words.some((w) => link.title.toLowerCase().includes(w))
        );

    if (matched.length === 0) return [];

    const asins = matched.map((link) => link.id.replace("eg-", ""));

    // Additive local scraper source: fetch real product data for the matched
    // Egypt ASINs via the storefront product page fetch on amazon.eg. Feeds
    // the SAME store mapping and does not replace the Creators path.
    try {
      const sListing: RawProviderListing[] = [];
      for (const asin of asins) {
        const product = await fetchAmazonProductScraper(asin, "amazon-eg");
        if (!product) continue;
        const item = normalizeAmazonScraperRaw(product, "amazon-eg");
        if (item) sListing.push(item);
      }
      if (sListing.length > 0) return sListing;
    } catch {
      // A scraper failure must never silence the existing Egypt path.
    }

    // Attempt to enrich seed ASINs with real data from the Creators API.
    // Without credentials, getAmazonCredentials() returns null and
    // fetchEgProductsByAsins() returns an empty map — so the connector
    // returns [] and no broken product cards appear.
    const enriched = await fetchEgProductsByAsins(asins);

    const results: RawProviderListing[] = [];
    for (const link of matched) {
      const asin = link.id.replace("eg-", "");
      const api = enriched.get(asin);
      if (api) {
        results.push({
          providerId: "amazon-eg" as const,
          externalId: api.asin,
          title: api.title,
          imageUrl: api.imageUrl,
          price: api.price,
          originalPrice: api.originalPrice,
          discount: api.originalPrice > api.price
            ? Math.max(0, Math.round(((api.originalPrice - api.price) / api.originalPrice) * 100))
            : 0,
          currency: api.currency,
          storeName: "Amazon Egypt",
          category: api.category,
          rating: api.rating,
          reviewCount: api.reviewCount,
          inStock: api.inStock,
          productUrl: `https://www.amazon.eg/dp/${api.asin}`,
          affiliateUrl: api.affiliateUrl,
        });
      }
    }

    return results;
  },
};