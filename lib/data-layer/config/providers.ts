import type { DataProviderId, DataProviderMeta } from "@/lib/data-layer/types";

/** Central registry of all supported providers and their metadata. */
export const PROVIDER_REGISTRY: Record<DataProviderId, DataProviderMeta> = {
  amazon: {
    id: "amazon",
    name: "Amazon",
    website: "https://www.amazon.com",
    supportedRegions: ["US", "UK", "DE", "AE", "SA", "EG", "CA"],
    supportedCurrencies: ["USD", "GBP", "EUR", "AED", "SAR", "EGP", "CAD"],
    capabilities: ["products", "stores", "prices", "coupons", "categories"],
    envKeys: ["AMAZON_PAAPI_ACCESS_KEY", "AMAZON_PAAPI_SECRET_KEY", "AMAZON_ASSOCIATE_TAG"],
    rateLimitPerMinute: 30,
    defaultCacheTtlMs: 5 * 60 * 1000,
  },
  ebay: {
    id: "ebay",
    name: "eBay",
    website: "https://www.ebay.com",
    supportedRegions: ["US", "UK", "DE", "AU", "CA"],
    supportedCurrencies: ["USD", "GBP", "EUR", "AUD", "CAD"],
    capabilities: ["products", "stores", "prices", "coupons"],
    envKeys: ["EBAY_APP_ID", "EBAY_CERT_ID", "EBAY_CAMPAIGN_ID"],
    rateLimitPerMinute: 60,
    defaultCacheTtlMs: 3 * 60 * 1000,
  },
  aliexpress: {
    id: "aliexpress",
    name: "AliExpress",
    website: "https://www.aliexpress.com",
    supportedRegions: ["GLOBAL", "US", "UK", "AE", "SA", "EG"],
    supportedCurrencies: ["USD", "EUR", "GBP", "AED", "SAR", "EGP"],
    capabilities: ["products", "stores", "prices", "coupons", "categories"],
    envKeys: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET", "ALIEXPRESS_TRACKING_ID"],
    rateLimitPerMinute: 40,
    defaultCacheTtlMs: 5 * 60 * 1000,
  },
  walmart: {
    id: "walmart",
    name: "Walmart",
    website: "https://www.walmart.com",
    supportedRegions: ["US", "CA"],
    supportedCurrencies: ["USD", "CAD"],
    capabilities: ["products", "stores", "prices", "coupons"],
    envKeys: ["WALMART_AFFILIATE_ID", "WALMART_API_KEY"],
    rateLimitPerMinute: 30,
    defaultCacheTtlMs: 5 * 60 * 1000,
  },
  "best-buy": {
    id: "best-buy",
    name: "Best Buy",
    website: "https://www.bestbuy.com",
    supportedRegions: ["US", "CA"],
    supportedCurrencies: ["USD", "CAD"],
    capabilities: ["products", "stores", "prices", "coupons"],
    envKeys: ["BESTBUY_API_KEY", "BESTBUY_AFFILIATE_ID"],
    rateLimitPerMinute: 30,
    defaultCacheTtlMs: 5 * 60 * 1000,
  },
  noon: {
    id: "noon",
    name: "Noon",
    website: "https://www.noon.com",
    supportedRegions: ["AE", "SA", "EG"],
    supportedCurrencies: ["AED", "SAR", "EGP"],
    capabilities: ["products", "stores", "prices", "coupons", "categories"],
    envKeys: ["NOON_API_KEY", "NOON_AFFILIATE_ID"],
    rateLimitPerMinute: 40,
    defaultCacheTtlMs: 3 * 60 * 1000,
  },
  jarir: {
    id: "jarir",
    name: "Jarir",
    website: "https://www.jarir.com",
    supportedRegions: ["SA", "AE"],
    supportedCurrencies: ["SAR", "AED"],
    capabilities: ["products", "stores", "prices", "coupons"],
    envKeys: ["JARIR_API_KEY", "JARIR_AFFILIATE_ID"],
    rateLimitPerMinute: 30,
    defaultCacheTtlMs: 5 * 60 * 1000,
  },
  extra: {
    id: "extra",
    name: "eXtra",
    website: "https://www.extra.com",
    supportedRegions: ["SA", "AE"],
    supportedCurrencies: ["SAR", "AED"],
    capabilities: ["products", "stores", "prices", "coupons"],
    envKeys: ["EXTRA_API_KEY", "EXTRA_AFFILIATE_ID"],
    rateLimitPerMinute: 30,
    defaultCacheTtlMs: 5 * 60 * 1000,
  },
  btech: {
    id: "btech",
    name: "B.TECH",
    website: "https://www.btech.com",
    supportedRegions: ["EG"],
    supportedCurrencies: ["EGP"],
    capabilities: ["products", "stores", "prices", "coupons"],
    envKeys: ["BTECH_API_KEY", "BTECH_AFFILIATE_ID"],
    rateLimitPerMinute: 30,
    defaultCacheTtlMs: 5 * 60 * 1000,
  },
  raya: {
    id: "raya",
    name: "Raya Shop",
    website: "https://www.rayashop.com",
    supportedRegions: ["EG"],
    supportedCurrencies: ["EGP"],
    capabilities: ["products", "stores", "prices", "coupons"],
    envKeys: ["RAYA_API_KEY", "RAYA_AFFILIATE_ID"],
    rateLimitPerMinute: 30,
    defaultCacheTtlMs: 5 * 60 * 1000,
  },
};

/** Map store slugs used in the app to their data provider. */
export const STORE_SLUG_TO_PROVIDER: Record<string, DataProviderId> = {
  amazon: "amazon",
  ebay: "ebay",
  aliexpress: "aliexpress",
  walmart: "walmart",
  "best-buy": "best-buy",
  noon: "noon",
  jarir: "jarir",
  extra: "extra",
  btech: "btech",
  raya: "raya",
};

export function getProviderMeta(id: DataProviderId): DataProviderMeta {
  return PROVIDER_REGISTRY[id];
}

export function listProviderMetas(): DataProviderMeta[] {
  return Object.values(PROVIDER_REGISTRY);
}

export function resolveProviderByStoreSlug(slug: string): DataProviderId | null {
  return STORE_SLUG_TO_PROVIDER[slug] ?? null;
}
