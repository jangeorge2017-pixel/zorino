import { buildAffiliateUrl } from "@/lib/affiliate/generate";
import { getCreatorsAccessToken } from "@/lib/integrations/amazon/auth";
import {
  getAmazonCredentials,
} from "@/lib/integrations/amazon/config";
import type { AmazonValidationResult } from "@/lib/integrations/amazon/types";
import type {
  AmazonCreatorsError,
  AmazonCreatorsItem,
  AmazonSearchItemsResponse,
} from "@/lib/sync/providers/amazon/paapi-types";

const CREATORS_API_SEARCH_ENDPOINT = "https://creatorsapi.amazon/catalog/v1/searchItems";
const CREATORS_API_ITEMS_ENDPOINT = "https://creatorsapi.amazon/catalog/v1/getItems";

const SEARCH_RESOURCES = [
  "images.primary.large",
  "itemInfo.title",
  "itemInfo.byLineInfo",
  "itemInfo.classifications",
  "offersV2.listings.price",
  "offersV2.listings.availability",
  "offersV2.listings.condition",
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

export function mapAmazonCreatorsItem(
  item: AmazonCreatorsItem,
  associateTag: string,
  currency: string
): AmazonRawProduct | null {
  const title = item.itemInfo?.title?.displayValue?.trim();
  if (!item.asin || !title) return null;

  const listing = item.offersV2?.listings?.[0];
  const priceMoney = listing?.price?.money;
  const price = parsePriceAmount(
    priceMoney?.amount,
    priceMoney?.displayAmount
  );
  if (!price || price <= 0) return null;

  const savingBasisMoney = listing?.price?.savingBasis?.money;
  const original = parsePriceAmount(
    savingBasisMoney?.amount,
    savingBasisMoney?.displayAmount
  );
  const originalPrice = original > price ? original : price;

  const imageUrl = item.images?.primary?.large?.url
    ?? item.images?.primary?.medium?.url
    ?? "";
  if (!imageUrl.startsWith("http")) return null;

  const detailUrl =
    item.detailPageURL ?? `https://www.amazon.com/dp/${item.asin}?tag=${associateTag}`;
  const affiliateUrl = buildAmazonAffiliateUrl(detailUrl, associateTag);

  if (!affiliateUrl.includes(associateTag)) return null;

  const availType = listing?.availability?.type?.toLowerCase() ?? "";
  const inStock = !availType.includes("out_of_stock");

  const category =
    item.itemInfo?.classifications?.productGroup?.displayValue?.trim() || "General";

  return {
    asin: item.asin,
    title,
    brand: item.itemInfo?.byLineInfo?.brand?.displayValue,
    imageUrl,
    price,
    originalPrice,
    currency: priceMoney?.currency ?? currency,
    inStock,
    rating: 0,
    reviewCount: 0,
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
          ? "Amazon Creators API credentials are valid."
          : "Amazon Creators API connected — no items returned for test query.",
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
   * Search Amazon catalog via Creators API SearchItems.
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

    const token = await getCreatorsAccessToken({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      version: creds.version,
    });

    const all: AmazonRawProduct[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= maxPages; page++) {
      const body = JSON.stringify({
        keywords: trimmed,
        searchIndex: options?.searchIndex ?? "All",
        itemCount,
        itemPage: page,
        partnerTag: creds.associateTag,
        marketplace: creds.marketplace,
        resources: SEARCH_RESOURCES,
      });

      const response = await fetch(CREATORS_API_SEARCH_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-marketplace": creds.marketplace,
        },
        body,
        cache: "no-store",
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Amazon Creators API ${response.status}: ${text.slice(0, 300)}`);
      }

      let parsed: AmazonSearchItemsResponse;
      try {
        parsed = JSON.parse(text) as AmazonSearchItemsResponse;
      } catch {
        throw new Error("Amazon Creators API returned invalid JSON");
      }

      if (parsed.errors?.length) {
        throw new Error(
          parsed.errors.map((e) => e.message ?? e.code).filter(Boolean).join("; ")
        );
      }

      const items = parsed.searchResult?.items ?? [];
      if (items.length === 0) break;

      for (const raw of items) {
        const mapped = mapAmazonCreatorsItem(raw, creds.associateTag, "USD");
        if (!mapped || seen.has(mapped.asin)) continue;
        seen.add(mapped.asin);
        all.push(mapped);
      }

      if (items.length < itemCount) break;
    }

    return all;
  }

  /**
   * Fetch a single product by ASIN via Creators API GetItems.
   */
  async getByASIN(asin: string): Promise<AmazonRawProduct | null> {
    const creds = this.creds ?? getAmazonCredentials();
    if (!creds) return null;

    const trimmed = asin.trim().toUpperCase();
    if (!trimmed || trimmed.length < 5) return null;

    const token = await getCreatorsAccessToken({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      version: creds.version,
    });

    const body = JSON.stringify({
      ItemIds: [trimmed],
      PartnerTag: creds.associateTag,
      Marketplace: creds.marketplace,
      Resources: SEARCH_RESOURCES,
    });

    const response = await fetch(CREATORS_API_ITEMS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-marketplace": creds.marketplace,
      },
      body,
      cache: "no-store",
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Amazon Creators API getItems ${response.status}: ${text.slice(0, 300)}`);
    }

    let parsed: { itemsResult?: { items?: AmazonCreatorsItem[] }; errors?: AmazonCreatorsError[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Amazon Creators API returned invalid JSON");
    }

    if (parsed.errors?.length) {
      throw new Error(
        parsed.errors.map((e) => e.message ?? e.code).filter(Boolean).join("; ")
      );
    }

    const item = parsed.itemsResult?.items?.[0];
    if (!item) return null;

    return mapAmazonCreatorsItem(item, creds.associateTag, creds.marketplace.includes("eg") ? "EGP" : "USD");
  }
}

export function createAmazonClientFromEnv(): AmazonPaApiClient | null {
  const creds = getAmazonCredentials();
  if (!creds) return null;
  return new AmazonPaApiClient(creds);
}
