import type {
  AliExpressCredentials,
  AliExpressCredentialStatus,
  AliExpressValidationResult,
  AliExpressRawProduct,
} from "@/lib/integrations/aliexpress/types";

export type {
  AliExpressCredentials,
  AliExpressCredentialStatus,
  AliExpressValidationResult,
  AliExpressRawProduct,
};

/** Normalized Open API product for ZORINO (UI-agnostic). */
export type AliExpressOpenApiProduct = {
  title: string;
  image: string;
  currentPrice: number;
  originalPrice: number;
  discount: number;
  rating: number;
  salesCount: number;
  storeName: string;
  shipping: string;
  affiliateUrl: string;
  productId: string;
  productUrl: string;
  currency: string;
  category: string;
  inStock: boolean;
};
