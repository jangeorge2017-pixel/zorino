import { buildAffiliateUrl } from "@/lib/affiliate/generate";
import { signPaApiRequest } from "@/lib/integrations/amazon/auth";
import {
  amazonPaApiHost,
  getAmazonCredentials,
} from "@/lib/integrations/amazon/config";
import type { AmazonValidationResult } from "@/lib/integrations/amazon/types";
import type {
  AmazonPaApiItem,
  AmazonSearchItemsResponse,
} from "@/lib/sync/providers/amazon/paapi-types";

const PA_API_TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";

const SEARCH_RESOURCES = [
  "Images.Primary.Large",
  "ItemInfo.Title",
  "ItemInfo.ByLineInfo",
  "ItemInfo.Classifications",
  "Offers.Listings.Price",
  "Offers.Listings.SavingBasis",
  "Offers.Listings.Availability",
  "CustomerReviews.StarRating",
  "CustomerReviews.Count",
];

export type AmazonRawProduct = {
  asin: string;
  title: string;
  brand?: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  currency: string;
  inStock: boolean;
  rating: number;
  reviewCount: number;
  productUrl: string;
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

function buildAmazonAffiliateUrl(productUrl: string, associateTag: string): string {
  const base = productUrl.includes("://") ? productUrl : `https://www.amazon.com/dp/${productUrl}`;
  return buildAffiliateUrl({
    destinationUrl: base,
    marketplace: "amazon",
    partnerTag: associateTag,
  });
}

export function mapAmazonPaApiItem(
  item: AmazonPaApiItem,
  associateTag: string,
  currency: string
): AmazonRawProduct | null {
  const title = item.ItemInfo?.Title?.DisplayValue?.trim();
  if (!item.ASIN || !title) return null;

  const listing = item.Offers?.Listings?.[0];
  const price = parsePriceAmount(
    listing?.Price?.Amount,
    (listing?.Price as { DisplayAmount?: string } | undefined)?.DisplayAmount
  );
  if (!price || price <= 0) return null;

  const original = parsePriceAmount(
    listing?.SavingBasis?.Amount,
    (listing?.SavingBasis as { DisplayAmount?: string } | undefined)?.DisplayAmount
  );
  const originalPrice = original > price ? original : price;

  const imageUrl = item.Images?.Primary?.Large?.URL ?? "";
  if (!imageUrl.startsWith("http")) return null;

  const detailUrl =
    item.DetailPageURL ?? `https://www.amazon.com/dp/${item.ASIN}?tag=${associateTag}`;
  const affiliateUrl = buildAmazonAffiliateUrl(detailUrl, associateTag);

  if (!affiliateUrl.includes(associateTag)) return null;

  const availability = listing?.Availability?.Message?.toLowerCase() ?? "";
  const inStock = !availability.includes("unavailable");

  const starRating = item.CustomerReviews?.StarRating?.Value ?? 0;
  const reviewCount = item.CustomerReviews?.Count ?? 0;

  const category =
    item.ItemInfo?.Classifications?.ProductGroup?.DisplayValue?.trim() || "General";

  return {
    asin: item.ASIN,
    title,
    brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue,
    imageUrl,
    price,
    originalPrice,
    currency: listing?.Price?.Currency ?? currency,
    inStock,
    rating: typeof starRating === "number" ? Math.min(5, starRating) : 0,
    reviewCount: typeof reviewCount === "number" ? reviewCount : 0,
    productUrl: detailUrl,
    affiliateUrl,
    category,
  };
}

export class AmazonPaApiClient {
  constructor(private creds = getAmazonCredentials()) {}

  isConfigured(): boolean {
    return Boolean(this.creds);
  }

  async validateCredentials(): Promise<AmazonValidationResult> {
    const testedAt = new Date().toISOString();
    try {
      const items = await this.searchByKeyword("electronics", { itemCount: 1, maxPages: 1 });
      return {
        ok: true,
        message: items.length
          ? "Amazon PA-API credentials are valid."
          : "Amazon PA-API connected — no items returned for test query.",
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

  /**
   * Search Amazon catalog via PA-API 5.0 SearchItems.
   * Up to 10 pages × 10 items = 100 results per query.
   */
  async searchByKeyword(
    keyword: string,
    options?: { itemCount?: number; maxPages?: number; searchIndex?: string }
  ): Promise<AmazonRawProduct[]> {
    const creds = this.creds ?? getAmazonCredentials();
    if (!creds) return [];

    const trimmed = keyword.trim();
    if (!trimmed) return [];

    const itemCount = Math.min(Math.max(options?.itemCount ?? 10, 1), 10);
    const maxPages = Math.min(Math.max(options?.maxPages ?? 10, 1), 10);
    const host = amazonPaApiHost(creds.marketplace);
    const all: AmazonRawProduct[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= maxPages; page++) {
      const body = JSON.stringify({
        Keywords: trimmed,
        SearchIndex: options?.searchIndex ?? "All",
        ItemCount: itemCount,
        ItemPage: page,
        PartnerTag: creds.associateTag,
        PartnerType: "Associates",
        Marketplace: creds.marketplace,
        Resources: SEARCH_RESOURCES,
      });

      const signed = signPaApiRequest({
        host,
        region: creds.region,
        accessKey: creds.accessKey,
        secretKey: creds.secretKey,
        target: PA_API_TARGET,
        body,
      });

      const response = await fetch(signed.url, {
        method: "POST",
        headers: signed.headers,
        body: signed.body,
        cache: "no-store",
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Amazon PA-API ${response.status}: ${text.slice(0, 300)}`);
      }

      let parsed: AmazonSearchItemsResponse & {
        Errors?: { Code?: string; Message?: string }[];
      };
      try {
        parsed = JSON.parse(text) as AmazonSearchItemsResponse & {
          Errors?: { Code?: string; Message?: string }[];
        };
      } catch {
        throw new Error("Amazon PA-API returned invalid JSON");
      }

      if (parsed.Errors?.length) {
        throw new Error(
          parsed.Errors.map((e) => e.Message ?? e.Code).filter(Boolean).join("; ")
        );
      }

      const items = parsed.SearchResult?.Items ?? [];
      if (items.length === 0) break;

      for (const raw of items) {
        const mapped = mapAmazonPaApiItem(raw, creds.associateTag, "USD");
        if (!mapped || seen.has(mapped.asin)) continue;
        seen.add(mapped.asin);
        all.push(mapped);
      }

      if (items.length < itemCount) break;
    }

    return all;
  }
}

export function createAmazonClientFromEnv(): AmazonPaApiClient | null {
  const creds = getAmazonCredentials();
  if (!creds) return null;
  return new AmazonPaApiClient(creds);
}
