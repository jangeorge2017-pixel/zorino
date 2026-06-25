/** Supported affiliate marketplaces (Phase 1). */
export const AFFILIATE_MARKETPLACES = [
  "amazon",
  "aliexpress",
  "ebay",
  "walmart",
  "temu",
] as const;

export type AffiliateMarketplace = (typeof AFFILIATE_MARKETPLACES)[number];

export const AFFILIATE_ENV_KEYS: Record<AffiliateMarketplace, string[]> = {
  amazon: ["AMAZON_ASSOCIATE_TAG"],
  aliexpress: ["ALIEXPRESS_TRACKING_ID", "ALIEXPRESS_APP_KEY"],
  ebay: ["EBAY_CAMPAIGN_ID", "EBAY_APP_ID"],
  walmart: ["WALMART_AFFILIATE_ID"],
  temu: ["TEMU_AFFILIATE_ID"],
};

export const DEFAULT_COMMISSION_RATES: Record<AffiliateMarketplace, number> = {
  amazon: 4,
  aliexpress: 5,
  ebay: 4,
  walmart: 3,
  temu: 7,
};

/** Map store integration_type / slug to affiliate marketplace id. */
export function resolveMarketplace(
  storeSlugOrType: string | null | undefined
): AffiliateMarketplace | null {
  if (!storeSlugOrType) return null;
  const key = storeSlugOrType.toLowerCase();
  if (AFFILIATE_MARKETPLACES.includes(key as AffiliateMarketplace)) {
    return key as AffiliateMarketplace;
  }
  const aliases: Record<string, AffiliateMarketplace> = {
    amz: "amazon",
    ae: "aliexpress",
  };
  return aliases[key] ?? null;
}

export function extractMarketplaceFromUrl(url: string): AffiliateMarketplace | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("amazon")) return "amazon";
    if (host.includes("aliexpress")) return "aliexpress";
    if (host.includes("ebay")) return "ebay";
    if (host.includes("walmart")) return "walmart";
    if (host.includes("temu")) return "temu";
    return null;
  } catch {
    return null;
  }
}
