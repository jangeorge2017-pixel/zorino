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

export type IntlPreferences = {
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  locale: Locale;
};

export async function getServerIntlPreferences(locale: Locale): Promise<IntlPreferences> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  let countryCode = cookieStore.get(INTL_COOKIE_COUNTRY)?.value;
  if (!countryCode || !isSupportedCountry(countryCode)) {
    const geoCountry = headerStore.get("x-zor-detected-country");
    countryCode = geoCountry && isSupportedCountry(geoCountry) ? geoCountry : DEFAULT_COUNTRY;
  }

  let currencyCode = cookieStore.get(INTL_COOKIE_CURRENCY)?.value;
  if (!currencyCode || !isSupportedCurrency(currencyCode)) {
    currencyCode = getDefaultCurrencyForCountry(countryCode);
  }

  return {
    countryCode: countryCode as CountryCode,
    currencyCode: currencyCode as CurrencyCode,
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
