/** Supported affiliate marketplaces (Phase 1). */
export const AFFILIATE_MARKETPLACES = [
  "amazon",
  "amazon-eg",
  "aliexpress",
  "ebay",
  "walmart",
  "temu",
  "noon",
  "admitad",
] as const;

export type AffiliateMarketplace = (typeof AFFILIATE_MARKETPLACES)[number];

export const AFFILIATE_ENV_KEYS: Record<AffiliateMarketplace, string[]> = {
  amazon: ["AMAZON_ASSOCIATE_TAG"],
  "amazon-eg": ["AMAZON_EG_ASSOCIATE_TAG"],
  /** Portal tracking ID only — Open API keys are separate and unused for portal links. */
  aliexpress: ["ALIEXPRESS_TRACKING_ID"],
  ebay: ["EBAY_CAMPAIGN_ID", "EBAY_APP_ID", "EBAY_CERT_ID", "EBAY_REFERENCE_ID"],
  walmart: ["WALMART_AFFILIATE_ID"],
  temu: ["TEMU_AFFILIATE_ID"],
  noon: ["NOON_UAE_AFFILIATE_ID", "NOON_KSA_AFFILIATE_ID"],
  admitad: ["ADMITAD_FEED_URL"],
};

export const DEFAULT_COMMISSION_RATES: Record<AffiliateMarketplace, number> = {
  amazon: 4,
  "amazon-eg": 4,
  aliexpress: 5,
  ebay: 4,
  walmart: 3,
  temu: 7,
  noon: 5,
  admitad: 5,
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
    "amz-eg": "amazon-eg",
    "amazon-egypt": "amazon-eg",
    ae: "aliexpress",
  };
  return aliases[key] ?? null;
}

/** True when host equals the domain or is a strict subdomain of it. */
function isHostOrSubdomainOf(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** True when host matches any of the given registrable domains (or subdomain). */
function hostMatchesAnyDomain(host: string, domains: string[]): boolean {
  return domains.some((domain) => isHostOrSubdomainOf(host, domain));
}

export function extractMarketplaceFromUrl(url: string): AffiliateMarketplace | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (hostMatchesAnyDomain(host, ["amazon.eg"])) return "amazon-eg";
    if (
      hostMatchesAnyDomain(host, [
        "amazon.com",
        "amazon.co.uk",
        "amazon.de",
        "amazon.fr",
        "amazon.it",
        "amazon.es",
        "amazon.ca",
        "amazon.com.mx",
        "amazon.com.br",
        "amazon.in",
        "amazon.com.au",
        "amazon.co.jp",
        "amazon.nl",
        "amazon.ae",
        "amazon.sa",
      ])
    )
      return "amazon";
    if (hostMatchesAnyDomain(host, ["aliexpress.com"])) return "aliexpress";
    if (
      hostMatchesAnyDomain(host, [
        "ebay.com",
        "ebay.co.uk",
        "ebay.de",
        "ebay.fr",
        "ebay.com.au",
      ])
    )
      return "ebay";
    if (hostMatchesAnyDomain(host, ["walmart.com"])) return "walmart";
    if (hostMatchesAnyDomain(host, ["temu.com"])) return "temu";
    if (hostMatchesAnyDomain(host, ["noon.com", "nooncdn.com"])) return "noon";
    return null;
  } catch {
    return null;
  }
}
