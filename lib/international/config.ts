import type { Locale } from "@/i18n/config";

/** ISO 4217 currency codes supported by Zorino. */
export const currencyCodes = ["USD", "EUR", "GBP", "AED", "SAR", "EGP", "CAD"] as const;
export type CurrencyCode = (typeof currencyCodes)[number];

/** ISO 3166-1 alpha-2 country codes supported in the UI. */
export const countryCodes = ["US", "GB", "DE", "FR", "AE", "SA", "EG", "CA", "GLOBAL"] as const;
export type CountryCode = (typeof countryCodes)[number];

export type CurrencyConfig = {
  code: CurrencyCode;
  symbol: string;
  name: string;
  decimals: number;
  /** BCP 47 locale for Intl.NumberFormat */
  formatLocale: string;
};

export type CountryConfig = {
  code: CountryCode;
  name: string;
  flag: string;
  defaultLocale: Locale;
  defaultCurrency: CurrencyCode;
  /** Store region codes used in supportedRegions (GLOBAL matches all) */
  storeRegions: string[];
};

export type LanguageConfig = {
  code: Locale;
  label: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
  flag: string;
};

export const languages: Record<Locale, LanguageConfig> = {
  en: {
    code: "en",
    label: "English",
    nativeLabel: "English",
    dir: "ltr",
    flag: "🇺🇸",
  },
  ar: {
    code: "ar",
    label: "Arabic",
    nativeLabel: "العربية",
    dir: "rtl",
    flag: "🇸🇦",
  },
};

export const currencies: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2, formatLocale: "en-US" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2, formatLocale: "de-DE" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2, formatLocale: "en-GB" },
  AED: { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimals: 2, formatLocale: "ar-AE" },
  SAR: { code: "SAR", symbol: "ر.س", name: "Saudi Riyal", decimals: 2, formatLocale: "ar-SA" },
  EGP: { code: "EGP", symbol: "E£", name: "Egyptian Pound", decimals: 2, formatLocale: "ar-EG" },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimals: 2, formatLocale: "en-CA" },
};

export const countries: Record<CountryCode, CountryConfig> = {
  US: {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    defaultLocale: "en",
    defaultCurrency: "USD",
    storeRegions: ["US", "GLOBAL"],
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    defaultLocale: "en",
    defaultCurrency: "GBP",
    storeRegions: ["UK", "GB", "GLOBAL"],
  },
  DE: {
    code: "DE",
    name: "Germany",
    flag: "🇩🇪",
    defaultLocale: "en",
    defaultCurrency: "EUR",
    storeRegions: ["DE", "EU", "GLOBAL"],
  },
  FR: {
    code: "FR",
    name: "France",
    flag: "🇫🇷",
    defaultLocale: "en",
    defaultCurrency: "EUR",
    storeRegions: ["FR", "EU", "GLOBAL"],
  },
  AE: {
    code: "AE",
    name: "United Arab Emirates",
    flag: "🇦🇪",
    defaultLocale: "ar",
    defaultCurrency: "AED",
    storeRegions: ["AE", "GLOBAL"],
  },
  SA: {
    code: "SA",
    name: "Saudi Arabia",
    flag: "🇸🇦",
    defaultLocale: "ar",
    defaultCurrency: "SAR",
    storeRegions: ["SA", "GLOBAL"],
  },
  EG: {
    code: "EG",
    name: "Egypt",
    flag: "🇪🇬",
    defaultLocale: "ar",
    defaultCurrency: "EGP",
    storeRegions: ["EG", "GLOBAL"],
  },
  CA: {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    defaultLocale: "en",
    defaultCurrency: "CAD",
    storeRegions: ["CA", "GLOBAL"],
  },
  GLOBAL: {
    code: "GLOBAL",
    name: "Global",
    flag: "🌍",
    defaultLocale: "en",
    defaultCurrency: "USD",
    storeRegions: ["GLOBAL", "US", "UK", "GB", "DE", "FR", "EU", "AE", "SA", "EG", "CA"],
  },
};

/** GCC + Egypt → Arabic default locale on first visit */
export const ARABIC_DEFAULT_COUNTRIES = new Set<CountryCode>(["AE", "SA", "EG"]);

/** Country-specific category emphasis (slug order boost). */
export const countryCategoryPriority: Partial<Record<CountryCode, string[]>> = {
  AE: ["fashion", "phones", "wearables"],
  SA: ["fashion", "phones", "home"],
  US: ["gaming", "laptops", "phones"],
  GB: ["fashion", "gaming", "phones"],
  DE: ["laptops", "gaming", "tvs"],
  FR: ["electronics", "fashion", "gaming"],
};

export const DEFAULT_COUNTRY: CountryCode = "US";
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export function isSupportedCountry(code: string): code is CountryCode {
  return countryCodes.includes(code as CountryCode);
}

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return currencyCodes.includes(code as CurrencyCode);
}

export function getCountryConfig(code: string): CountryConfig {
  if (isSupportedCountry(code)) return countries[code];
  return countries[DEFAULT_COUNTRY];
}

export function getCurrencyConfig(code: string): CurrencyConfig {
  if (isSupportedCurrency(code)) return currencies[code];
  return currencies[DEFAULT_CURRENCY];
}

export function getDefaultLocaleForCountry(countryCode: string): Locale {
  return getCountryConfig(countryCode).defaultLocale;
}

export function getDefaultCurrencyForCountry(countryCode: string): CurrencyCode {
  return getCountryConfig(countryCode).defaultCurrency;
}

export function listCountries(): CountryConfig[] {
  return countryCodes
    .filter((c) => c !== "GLOBAL")
    .map((c) => countries[c]);
}

export function listCurrencies(): CurrencyConfig[] {
  return currencyCodes.map((c) => currencies[c]);
}
