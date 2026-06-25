import type { StoreIntegrationType } from "@/lib/types/entities";

export type MarketplaceProviderId =
  | "aliexpress"
  | "ebay"
  | "cjdropshipping"
  | "amazon"
  | "temu"
  | "walmart";

export type ProductIdentifierType = "gtin" | "upc" | "ean" | "mpn" | "asin" | "sku" | "model";

export type ProductIdentifier = {
  type: ProductIdentifierType;
  value: string;
};

export type DuplicateMatchType =
  | "external_id"
  | "identifier"
  | "slug"
  | "title"
  | "fuzzy_title";

export type DuplicateMatchResult = {
  productId: string;
  matchType: DuplicateMatchType;
  confidence: number;
  existingSyncHash?: string | null;
};

export type MarketplaceOffer = {
  productId: string;
  storeId: string;
  storeName: string;
  provider: StoreIntegrationType | string;
  price: number;
  originalPrice: number;
  currency: string;
  countryCode: string;
  inStock: boolean;
  externalUrl?: string | null;
  discountPercent: number;
  isLowest: boolean;
};

export type ProductPricingSummary = {
  productId: string;
  lowestPrice: number;
  highestPrice: number;
  savingsPercent: number;
  savingsAmount: number;
  offerCount: number;
  cheapestProvider: string;
  offers: MarketplaceOffer[];
};

export type ProductVariant = {
  id: string;
  productId: string;
  storeId?: string | null;
  externalId?: string | null;
  sku?: string | null;
  name: string;
  attributes: Record<string, string>;
  price?: number | null;
  originalPrice?: number | null;
  currency: string;
  inStock: boolean;
  imageUrl?: string | null;
};

export type PriceChangeDirection = "up" | "down" | "same" | "new";

export type PriceChangeRecord = {
  price: number;
  originalPrice?: number | null;
  currency: string;
  provider?: string | null;
  storeId?: string | null;
  changePercent?: number | null;
  changeDirection?: PriceChangeDirection | null;
  recordedAt: string;
};
