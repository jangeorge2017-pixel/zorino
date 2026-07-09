import type { NextRequest } from "next/server";
import type { Locale } from "@/i18n/config";
import {
  DEFAULT_COUNTRY,
  type CountryCode,
  getDefaultCurrencyForCountry,
  isSupportedCountry,
  isSupportedCurrency,
} from "@/lib/international/config";
import { detectCountryFromHeaders } from "@/lib/international/detect";
import {
  INTL_COOKIE_COUNTRY,
  INTL_COOKIE_CURRENCY,
} from "@/lib/international/cookies";
import type { ResolvedMarketplacePreferences } from "@/lib/global-marketplace/types";
import { getCurrentUser } from "@/services/users";
import { profileToIntlPreferences } from "@/lib/global-marketplace/preferences/profile-sync";

type ResolveOptions = {
  locale?: Locale;
  request?: NextRequest;
  /** Cookie values from server cookie store */
  cookieCountry?: string | null;
  cookieCurrency?: string | null;
  /** Geo header set by middleware */
  geoCountry?: string | null;
};

/**
 * Resolve country/currency with explicit priority:
 * 1. Cookie (manual selection)
 * 2. Authenticated profile
 * 3. Geo detection
 * 4. Default
 */
export async function resolveMarketplacePreferences(
  options: ResolveOptions = {}
): Promise<ResolvedMarketplacePreferences> {
  const locale = options.locale ?? "en";

  if (options.cookieCountry && isSupportedCountry(options.cookieCountry)) {
    const countryCode = options.cookieCountry;
    const currencyCode =
      options.cookieCurrency && isSupportedCurrency(options.cookieCurrency)
        ? options.cookieCurrency
        : getDefaultCurrencyForCountry(countryCode);
    return { countryCode, currencyCode, locale, source: "cookie" };
  }

  const { data: user } = await getCurrentUser();
  if (user?.countryCode && isSupportedCountry(user.countryCode)) {
    const fromProfile = profileToIntlPreferences(user);
    const countryCode = fromProfile.countryCode!;
    const currencyCode =
      fromProfile.currencyCode && isSupportedCurrency(fromProfile.currencyCode)
        ? fromProfile.currencyCode
        : getDefaultCurrencyForCountry(countryCode);
    return {
      countryCode,
      currencyCode,
      locale: (fromProfile.locale as Locale) ?? locale,
      source: "profile",
    };
  }

  let geoCountry: CountryCode = DEFAULT_COUNTRY;
  if (options.geoCountry && isSupportedCountry(options.geoCountry)) {
    geoCountry = options.geoCountry;
  } else if (options.request) {
    geoCountry = detectCountryFromHeaders(options.request);
  }

  return {
    countryCode: geoCountry,
    currencyCode: getDefaultCurrencyForCountry(geoCountry),
    locale,
    source: options.request || options.geoCountry ? "geo" : "default",
  };
}

export function readCookiesFromRequest(request: Request): {
  countryCode?: string;
  currencyCode?: string;
} {
  const raw = request.headers.get("cookie") ?? "";
  const parts = raw.split(";").map((p) => p.trim());

  const countryCode = parts
    .find((p) => p.startsWith(`${INTL_COOKIE_COUNTRY}=`))
    ?.split("=")[1];
  const currencyCode = parts
    .find((p) => p.startsWith(`${INTL_COOKIE_CURRENCY}=`))
    ?.split("=")[1];

  return { countryCode, currencyCode };
}
