/**
 * Amazon Creators API response types (lowerCamelCase).
 * @see https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/operations/search-items
 */

export interface AmazonCreatorsConfig {
  clientId: string;
  clientSecret: string;
  associateTag: string;
  marketplace: string;
  version: string;
}

export interface AmazonSearchItemsRequest {
  keywords?: string;
  searchIndex?: string;
  itemCount?: number;
  resources?: string[];
}

export interface AmazonSearchItemsResponse {
  searchResult?: {
    items?: AmazonCreatorsItem[];
    totalResultCount?: number;
  };
  errors?: AmazonCreatorsError[];
}

export interface AmazonCreatorsError {
  code?: string;
  message?: string;
}

export interface AmazonCreatorsItem {
  asin: string;
  detailPageURL?: string;
  images?: {
    primary?: {
      large?: { url?: string; height?: number; width?: number };
      medium?: { url?: string; height?: number; width?: number };
      small?: { url?: string; height?: number; width?: number };
    };
  };
  itemInfo?: {
    title?: { displayValue?: string; label?: string; locale?: string };
    features?: { displayValues?: string[] };
    byLineInfo?: { brand?: { displayValue?: string } };
    classifications?: { productGroup?: { displayValue?: string } };
  };
  offersV2?: {
    listings?: Array<{
      price?: {
        money?: { amount?: number; currency?: string; displayAmount?: string };
        savingBasis?: {
          money?: { amount?: number; currency?: string; displayAmount?: string };
          savingBasisType?: string;
        };
        savings?: {
          money?: { amount?: number; displayAmount?: string };
          percentage?: number;
        };
      };
      availability?: { type?: string; maxOrderQuantity?: number };
      condition?: { value?: string; subCondition?: string };
      merchantInfo?: { name?: string };
      isBuyBoxWinner?: boolean;
    }>;
  };
}

export function getAmazonCreatorsConfig(): AmazonCreatorsConfig | null {
  const clientId = process.env.AMAZON_CREATORS_CLIENT_ID?.trim();
  const clientSecret = process.env.AMAZON_CREATORS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const tag = process.env.AMAZON_ASSOCIATE_TAG?.trim() || "zorino-20";

  return {
    clientId,
    clientSecret,
    associateTag: tag,
    marketplace: process.env.AMAZON_CREATORS_MARKETPLACE ?? "www.amazon.eg",
    version: process.env.AMAZON_CREATORS_VERSION ?? "3.2",
  };
}
