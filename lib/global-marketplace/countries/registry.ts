import type { CountryCode } from "@/lib/international/config";
import { listMarketplaces } from "@/lib/global-marketplace/marketplaces/registry";
import type { GlobalCountryConfig } from "@/lib/global-marketplace/types";

const ALL_MARKETPLACE_IDS = listMarketplaces().map((m) => m.id);

/**
 * Phase 2 country configuration — marketplace availability & defaults.
 * Extends lib/international/config.ts without replacing it.
 */
export const GLOBAL_COUNTRY_REGISTRY: Record<CountryCode, GlobalCountryConfig> = {
  US: {
    isoCode: "US",
    name: "United States",
    flag: "🇺🇸",
    currency: "USD",
    language: "en",
    supportedLanguages: ["en", "es"],
    timezone: "America/New_York",
    availableMarketplaces: ["amazon-us", "best-buy", "walmart", "target", "newegg", "aliexpress", "ebay"],
    marketplacePriority: ["amazon-us", "best-buy", "walmart", "target", "newegg", "ebay", "aliexpress"],
  },
  GB: {
    isoCode: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    currency: "GBP",
    language: "en",
    supportedLanguages: ["en"],
    timezone: "Europe/London",
    availableMarketplaces: ["amazon-uk", "currys", "argos", "aliexpress", "ebay"],
    marketplacePriority: ["amazon-uk", "currys", "argos", "ebay", "aliexpress"],
  },
  DE: {
    isoCode: "DE",
    name: "Germany",
    flag: "🇩🇪",
    currency: "EUR",
    language: "de",
    supportedLanguages: ["de", "en"],
    timezone: "Europe/Berlin",
    availableMarketplaces: ["amazon-de", "mediamarkt", "saturn", "aliexpress", "ebay"],
    marketplacePriority: ["amazon-de", "mediamarkt", "saturn", "ebay", "aliexpress"],
  },
  FR: {
    isoCode: "FR",
    name: "France",
    flag: "🇫🇷",
    currency: "EUR",
    language: "fr",
    supportedLanguages: ["fr", "en"],
    timezone: "Europe/Paris",
    availableMarketplaces: ["amazon-fr", "fnac", "cdiscount", "aliexpress"],
    marketplacePriority: ["amazon-fr", "fnac", "cdiscount", "aliexpress"],
  },
  AE: {
    isoCode: "AE",
    name: "United Arab Emirates",
    flag: "🇦🇪",
    currency: "AED",
    language: "ar",
    supportedLanguages: ["ar", "en"],
    timezone: "Asia/Dubai",
    availableMarketplaces: ["noon-ae", "jarir", "extra", "aliexpress"],
    marketplacePriority: ["noon-ae", "jarir", "extra", "aliexpress"],
  },
  SA: {
    isoCode: "SA",
    name: "Saudi Arabia",
    flag: "🇸🇦",
    currency: "SAR",
    language: "ar",
    supportedLanguages: ["ar", "en"],
    timezone: "Asia/Riyadh",
    availableMarketplaces: ["amazon-sa", "noon-sa", "jarir", "extra", "aliexpress"],
    marketplacePriority: ["amazon-sa", "noon-sa", "jarir", "extra", "aliexpress"],
  },
  EG: {
    isoCode: "EG",
    name: "Egypt",
    flag: "🇪🇬",
    currency: "EGP",
    language: "ar",
    supportedLanguages: ["ar", "en", "fr"],
    timezone: "Africa/Cairo",
    availableMarketplaces: ["amazon-eg", "noon-eg", "jumia-eg", "aliexpress"],
    marketplacePriority: ["amazon-eg", "noon-eg", "jumia-eg", "aliexpress"],
  },
  CA: {
    isoCode: "CA",
    name: "Canada",
    flag: "🇨🇦",
    currency: "CAD",
    language: "en",
    supportedLanguages: ["en", "fr"],
    timezone: "America/Toronto",
    availableMarketplaces: ["amazon-us", "best-buy", "walmart", "aliexpress", "ebay"],
    marketplacePriority: ["amazon-us", "best-buy", "walmart", "ebay", "aliexpress"],
  },
  GLOBAL: {
    isoCode: "GLOBAL",
    name: "Global",
    flag: "🌍",
    currency: "USD",
    language: "en",
    supportedLanguages: ["en", "ar", "fr", "de", "es"],
    timezone: "UTC",
    availableMarketplaces: ALL_MARKETPLACE_IDS,
    marketplacePriority: ["aliexpress", "ebay", "amazon-us", ...ALL_MARKETPLACE_IDS.filter(
      (id) => !["aliexpress", "ebay", "amazon-us"].includes(id)
    )],
  },
};

export function getGlobalCountryConfig(countryCode: CountryCode): GlobalCountryConfig {
  return GLOBAL_COUNTRY_REGISTRY[countryCode] ?? GLOBAL_COUNTRY_REGISTRY.US;
}

export function listGlobalCountries(): GlobalCountryConfig[] {
  return (Object.keys(GLOBAL_COUNTRY_REGISTRY) as CountryCode[])
    .filter((code) => code !== "GLOBAL")
    .map((code) => GLOBAL_COUNTRY_REGISTRY[code]);
}
