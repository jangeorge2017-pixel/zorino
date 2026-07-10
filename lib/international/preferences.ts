import { cookies, headers } from "next/headers";
import type { Locale } from "@/i18n/config";
import {
  DEFAULT_COUNTRY,
  type CountryCode,
  type CurrencyCode,
  getCountryConfig,
  getCurrencyConfig,
  getDefaultCurrencyForCountry,
  isSupportedCountry,
  isSupportedCurrency,
} from "@/lib/international/config";
import {
  INTL_COOKIE_COUNTRY,
  INTL_COOKIE_CURRENCY,
} from "@/lib/international/cookies";
import { resolveMarketplacePreferences } from "@/lib/global-marketplace/preferences/resolve";

export type IntlPreferences = {
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  locale: Locale;
};

export async function getServerIntlPreferences(locale: Locale): Promise<IntlPreferences> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const resolved = await resolveMarketplacePreferences({
    locale,
    cookieCountry: cookieStore.get(INTL_COOKIE_COUNTRY)?.value,
    cookieCurrency: cookieStore.get(INTL_COOKIE_CURRENCY)?.value,
    geoCountry: headerStore.get("x-zor-detected-country"),
  });

  return {
    countryCode: resolved.countryCode,
    currencyCode: resolved.currencyCode,
    // Always prefer the active route locale over profile/cookie defaults.
    locale,
  };
}

export function parseIntlPreferences(
  country?: string | null,
  currency?: string | null,
  locale: Locale = "en"
): IntlPreferences {
  const countryCode =
    country && isSupportedCountry(country) ? country : DEFAULT_COUNTRY;
  const currencyCode =
    currency && isSupportedCurrency(currency)
      ? currency
      : getDefaultCurrencyForCountry(countryCode);

  return { countryCode, currencyCode, locale };
}

export function preferencesToJson(prefs: IntlPreferences) {
  return {
    country: {
      code: prefs.countryCode,
      name: getCountryConfig(prefs.countryCode).name,
      flag: getCountryConfig(prefs.countryCode).flag,
    },
    currency: {
      code: prefs.currencyCode,
      symbol: getCurrencyConfig(prefs.currencyCode).symbol,
      name: getCurrencyConfig(prefs.currencyCode).name,
    },
    locale: prefs.locale,
  };
}
