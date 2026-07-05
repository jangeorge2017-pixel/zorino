/**
 * Amazon PA-API 5.0 type stubs for Phase 2 integration.
 * @see https://webservices.amazon.com/paapi5/documentation/
 */

export interface AmazonPaApiConfig {
  accessKey: string;
  secretKey: string;
  associateTag: string;
  marketplace: string;
  region: string;
}

export interface AmazonSearchItemsRequest {
  Keywords?: string;
  SearchIndex?: string;
  ItemCount?: number;
  Resources?: string[];
}

export interface AmazonSearchItemsResponse {
  SearchResult?: {
    Items?: AmazonPaApiItem[];
    TotalResultCount?: number;
  };
}

export interface AmazonPaApiItem {
  ASIN: string;
  DetailPageURL?: string;
  Images?: {
    Primary?: { Large?: { URL?: string } };
  };
  ItemInfo?: {
    Title?: { DisplayValue?: string };
    Features?: { DisplayValues?: string[] };
    ByLineInfo?: { Brand?: { DisplayValue?: string } };
    Classifications?: { ProductGroup?: { DisplayValue?: string } };
  };
  CustomerReviews?: {
    StarRating?: { Value?: number };
    Count?: number;
  };
  Offers?: {
    Listings?: Array<{
      Price?: { Amount?: number; Currency?: string; DisplayAmount?: string };
      SavingBasis?: { Amount?: number; DisplayAmount?: string };
      Availability?: { Message?: string };
    }>;
  };
}

export function getAmazonPaApiConfig(): AmazonPaApiConfig | null {
  const accessKey = process.env.AMAZON_PAAPI_ACCESS_KEY?.trim();
  const secretKey = process.env.AMAZON_PAAPI_SECRET_KEY?.trim();
  const associateTag = process.env.AMAZON_ASSOCIATE_TAG?.trim();
  if (!accessKey || !secretKey) return null;
  const tag = associateTag || "zorino-20";

  return {
    accessKey,
    secretKey,
    associateTag: tag,
    marketplace: process.env.AMAZON_PAAPI_MARKETPLACE ?? "www.amazon.com",
    region: process.env.AMAZON_PAAPI_REGION ?? "us-east-1",
  };
}

/** Maps PA-API item to normalized fields (used when live integration ships). */
export function mapAmazonItemToNormalized(item: AmazonPaApiItem, countryCode: string, currency: string) {
  const listing = item.Offers?.Listings?.[0];
  const price = listing?.Price?.Amount ?? 0;
  const original = listing?.SavingBasis?.Amount ?? price;
  const title = item.ItemInfo?.Title?.DisplayValue ?? item.ASIN;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return {
    externalId: item.ASIN,
    title,
    slug: slug || item.ASIN.toLowerCase(),
    brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue,
    imageUrl: item.Images?.Primary?.Large?.URL ?? "",
    price,
    originalPrice: original,
    currency: listing?.Price?.Currency ?? currency,
    countryCode,
    inStock: !listing?.Availability?.Message?.toLowerCase().includes("unavailable"),
    productUrl: item.DetailPageURL ?? `https://amazon.com/dp/${item.ASIN}`,
  };
}
