import { getAmazonAssociateTag } from "@/lib/integrations/amazon/config";

/**
 * Amazon marketplace/localization targets supported by the local Amazon scraper.
 * Each key maps to the real Amazon storefront domain used in the product URL and
 * to the canonical currency of that marketplace.
 */
export const AMAZON_SCRAPER_MARKETPLACES = {
  "amazon-storefront": {
    domain: "com",
    storeUrl: "https://www.amazon.com",
    currency: "USD",
    locale: "en_US",
    geoLocation: "10001",
  },
  "amazon-co-uk": {
    domain: "co.uk",
    storeUrl: "https://www.amazon.co.uk",
    currency: "GBP",
    locale: "en_GB",
    geoLocation: "SW1A1AA",
  },
  "amazon-eg": {
    domain: "eg",
    storeUrl: "https://www.amazon.eg",
    currency: "EGP",
    locale: "en_AE",
    geoLocation: "11511",
  },
} as const;

export type AmazonScraperMarketplaceKey = keyof typeof AMAZON_SCRAPER_MARKETPLACES;

export type AmazonScrapedProduct = {
  asin: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  currency: string;
  productUrl: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  category: string;
};

export type AmazonScrapedSearchResult = {
  asin: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  currency: string;
  productUrl: string;
  rating: number;
  reviewCount: number;
  marketplace: AmazonScraperMarketplaceKey;
};

/** Associate tag used when building the outgoing Amazon product URL. */
export function getAmazonScraperAssociateTag(marketplace: AmazonScraperMarketplaceKey): string {
  return marketplace === "amazon-eg" ? "zorinoeg-21" : getAmazonAssociateTag();
}

/**
 * The scraper needs NO API credentials/keys. Availability is purely the
 * explicit Phase 5 architecture opt-in (AMAZON_DIRECT_ENABLE=1) plus the
 * environment's ability to reach the Amazon storefront.
 */
export function isAmazonScraperAvailable(): boolean {
  const disabled = process.env.AMAZON_SCRAPER_DISABLED?.trim().toLowerCase();
  if (disabled === "1" || disabled === "true" || disabled === "yes" || disabled === "on") {
    return false;
  }
  return true;
}