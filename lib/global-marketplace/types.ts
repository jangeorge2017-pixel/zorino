import type { CurrencyCode, CountryCode } from "@/lib/international/config";
import type { SupportedLocale } from "@/lib/global-marketplace/localization/locales";

/** Lifecycle of a marketplace integration in the registry. */
export type MarketplaceStatus = "active" | "configured" | "planned";

export type MarketplaceAffiliateInfo = {
  programId: string;
  network?: string;
  /** Env var key for default affiliate tag / tracking id */
  defaultTagEnvKey?: string;
};

export type MarketplaceShippingInfo = {
  /** ISO country codes where direct shipping is supported */
  countries: CountryCode[];
  notes?: string;
};

export type MarketplaceEndpoints = {
  /** Relative API route or provider adapter key for search */
  search: string;
  /** Relative API route or provider adapter key for product detail */
  product: string;
};

/**
 * Scalable marketplace registry entry.
 * Adding a marketplace = add one config object — no engine changes required.
 */
export type MarketplaceDefinition = {
  id: string;
  name: string;
  logo: string;
  supportedCountries: CountryCode[];
  supportedLanguages: SupportedLocale[];
  supportedCurrencies: CurrencyCode[];
  affiliate: MarketplaceAffiliateInfo;
  shipping: MarketplaceShippingInfo;
  categories: string[];
  endpoints: MarketplaceEndpoints;
  /** Links to lib/sync or lib/data-layer provider when wired */
  integrationProviderId?: string;
  status: MarketplaceStatus;
};

/** Phase 2 country configuration — extends base international country config. */
export type GlobalCountryConfig = {
  isoCode: CountryCode;
  name: string;
  flag: string;
  currency: CurrencyCode;
  language: SupportedLocale;
  supportedLanguages: SupportedLocale[];
  timezone: string;
  /** Marketplace ids available in this country */
  availableMarketplaces: string[];
  /** Default marketplace priority (first = highest) */
  marketplacePriority: string[];
};

export type ResolvedMarketplacePreferences = {
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  locale: SupportedLocale;
  source: "cookie" | "localStorage" | "profile" | "geo" | "default";
};

export type CurrencyOverride = {
  currencyCode: CurrencyCode;
  source: "manual" | "country-default" | "profile";
};
