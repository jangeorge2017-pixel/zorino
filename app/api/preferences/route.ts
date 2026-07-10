import { NextResponse } from "next/server";
import {
  getCountryConfig,
  getDefaultCurrencyForCountry,
  isSupportedCountry,
  isSupportedCurrency,
  type CountryCode,
  type CurrencyCode,
} from "@/lib/international/config";
import {
  INTL_COOKIE_COUNTRY,
  INTL_COOKIE_CURRENCY,
  INTL_COOKIE_LOCALE,
  INTL_COOKIE_MAX_AGE,
} from "@/lib/international/cookies";
import { preferencesToJson } from "@/lib/international/preferences";
import { syncIntlPreferencesToProfile } from "@/lib/global-marketplace/preferences/profile-sync";
import { locales, type Locale } from "@/i18n/config";
import { enforceRateLimit, publicApiRateLimiter } from "@/lib/security/api-rate-limit";

type PreferencesBody = {
  countryCode?: string;
  currencyCode?: string;
  locale?: string;
};

function cookieOptions() {
  return {
    maxAge: INTL_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function isSameSiteRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function readCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.split("=")[1];
}

function resolveLocale(
  body: PreferencesBody,
  countryCode: CountryCode,
  cookieLocale: string | undefined
): Locale {
  if (body.locale && locales.includes(body.locale as Locale)) {
    return body.locale as Locale;
  }

  // Country change suggests that market's default language.
  if (body.countryCode) {
    return getCountryConfig(countryCode).defaultLocale;
  }

  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  return getCountryConfig(countryCode).defaultLocale;
}

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, publicApiRateLimiter);
  if (rateLimited) return rateLimited;

  if (!isSameSiteRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PreferencesBody;

  try {
    body = (await request.json()) as PreferencesBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestCookies = request.headers.get("cookie") ?? "";
  const currentCountry = readCookie(requestCookies, INTL_COOKIE_COUNTRY);
  const currentCurrency = readCookie(requestCookies, INTL_COOKIE_CURRENCY);
  const currentLocale = readCookie(requestCookies, INTL_COOKIE_LOCALE);

  let countryCode = currentCountry;
  let currencyCode = currentCurrency;

  if (body.countryCode) {
    if (!isSupportedCountry(body.countryCode)) {
      return NextResponse.json({ error: "Unsupported country" }, { status: 400 });
    }
    countryCode = body.countryCode;
    if (!body.currencyCode) {
      currencyCode = getDefaultCurrencyForCountry(countryCode);
    }
  }

  if (body.currencyCode) {
    if (!isSupportedCurrency(body.currencyCode)) {
      return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
    }
    currencyCode = body.currencyCode;
  }

  if (!countryCode || !isSupportedCountry(countryCode)) {
    countryCode = "US";
  }
  if (!currencyCode || !isSupportedCurrency(currencyCode)) {
    currencyCode = getDefaultCurrencyForCountry(countryCode);
  }

  const locale = resolveLocale(body, countryCode as CountryCode, currentLocale);

  const prefs = {
    countryCode: countryCode as CountryCode,
    currencyCode: currencyCode as CurrencyCode,
    locale,
  };

  await syncIntlPreferencesToProfile(prefs);

  const response = NextResponse.json(preferencesToJson(prefs));

  response.cookies.set(INTL_COOKIE_COUNTRY, countryCode, cookieOptions());
  response.cookies.set(INTL_COOKIE_CURRENCY, currencyCode, cookieOptions());
  response.cookies.set(INTL_COOKIE_LOCALE, locale, cookieOptions());

  return response;
}

export async function GET(request: Request) {
  const requestCookies = request.headers.get("cookie") ?? "";
  const countryCode = readCookie(requestCookies, INTL_COOKIE_COUNTRY);
  const currencyCode = readCookie(requestCookies, INTL_COOKIE_CURRENCY);
  const cookieLocale = readCookie(requestCookies, INTL_COOKIE_LOCALE);

  const country = isSupportedCountry(countryCode ?? "") ? countryCode! : "US";
  const currency =
    currencyCode && isSupportedCurrency(currencyCode)
      ? currencyCode
      : getDefaultCurrencyForCountry(country);
  const locale =
    cookieLocale && locales.includes(cookieLocale as Locale)
      ? (cookieLocale as Locale)
      : getCountryConfig(country as CountryCode).defaultLocale;

  return NextResponse.json(
    preferencesToJson({
      countryCode: country as CountryCode,
      currencyCode: currency as CurrencyCode,
      locale,
    })
  );
}
