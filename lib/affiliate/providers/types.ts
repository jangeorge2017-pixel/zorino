/**
 * Provider contracts for marketplace affiliate integrations.
 * Open API adapters can implement these later without changing callers.
 */

export type AffiliateProviderId = "aliexpress";

export type AffiliateLinkSource =
  | "portal"
  | "portal_base"
  | "promotion_link"
  | "original"
  | "open_api"; // reserved for future Open API adapter

export type GenerateAffiliateLinkInput = {
  productUrl: string;
  /** Pre-generated promotion link from a catalog feed (if any). */
  promotionLink?: string | null;
  productId?: string | null;
  externalId?: string | null;
};

export type AffiliateLinkResult = {
  url: string;
  source: AffiliateLinkSource;
  providerId: AffiliateProviderId;
  trackingApplied: boolean;
};

export type AffiliateSearchQuery = {
  keywords: string;
  page?: number;
  pageSize?: number;
  currency?: string;
  language?: string;
};

export type AffiliateSearchResult = {
  items: unknown[];
  total?: number;
};

export type AffiliateProductDetailsQuery = {
  productId: string;
  currency?: string;
  language?: string;
};

export type AffiliateProductDetails = {
  productId: string;
  title?: string;
  productUrl?: string;
  raw?: unknown;
};

export type AffiliateCouponQuery = {
  keywords?: string;
  storeId?: string;
  limit?: number;
};

export type AffiliateCoupon = {
  id: string;
  code?: string;
  title?: string;
  url?: string;
};

/** Product discovery — Open API later. */
export interface AffiliateSearchProvider {
  search(query: AffiliateSearchQuery): Promise<AffiliateSearchResult>;
}

/** Product detail fetch — Open API later. */
export interface AffiliateProductProvider {
  getProductDetails(
    query: AffiliateProductDetailsQuery,
  ): Promise<AffiliateProductDetails | null>;
}

/** Affiliate / tracking link generation — portal today, Open API later. */
export interface AffiliateLinkProvider {
  generateAffiliateLink(
    input: GenerateAffiliateLinkInput,
  ): Promise<AffiliateLinkResult>;
  generateAffiliateLinks?(
    inputs: GenerateAffiliateLinkInput[],
  ): Promise<Map<string, AffiliateLinkResult>>;
}

/** Coupons — reserved for future Coupon API. */
export interface AffiliateCouponProvider {
  listCoupons(query?: AffiliateCouponQuery): Promise<AffiliateCoupon[]>;
}

export interface MarketplaceAffiliateProvider
  extends AffiliateSearchProvider,
    AffiliateProductProvider,
    AffiliateLinkProvider,
    AffiliateCouponProvider {
  readonly id: AffiliateProviderId;
  readonly displayName: string;
}
