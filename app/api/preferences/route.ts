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
  INTL_COOKIE_MAX_AGE,
} from "@/lib/international/cookies";
import { preferencesToJson } from "@/lib/international/preferences";
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
  const currentCountry = requestCookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${INTL_COOKIE_COUNTRY}=`))
    ?.split("=")[1];
  const currentCurrency = requestCookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${INTL_COOKIE_CURRENCY}=`))
    ?.split("=")[1];

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

  const locale =
    body.locale && locales.includes(body.locale as Locale)
      ? (body.locale as Locale)
      : getCountryConfig(countryCode).defaultLocale;

  const response = NextResponse.json(
    preferencesToJson({
      countryCode: countryCode as CountryCode,
      currencyCode: currencyCode as CurrencyCode,
      locale,
    })
  );

  response.cookies.set(INTL_COOKIE_COUNTRY, countryCode, cookieOptions());
  response.cookies.set(INTL_COOKIE_CURRENCY, currencyCode, cookieOptions());

  return response;
}

export async function GET(request: Request) {
  const requestCookies = request.headers.get("cookie") ?? "";
  const countryCode = requestCookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${INTL_COOKIE_COUNTRY}=`))
    ?.split("=")[1];
  const currencyCode = requestCookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${INTL_COOKIE_CURRENCY}=`))
    ?.split("=")[1];

  const country = isSupportedCountry(countryCode ?? "") ? countryCode! : "US";
  const currency =
    currencyCode && isSupportedCurrency(currencyCode)
      ? currencyCode
      : getDefaultCurrencyForCountry(country);

  return NextResponse.json(
    preferencesToJson({
      countryCode: country as CountryCode,
      currencyCode: currency as CurrencyCode,
      locale: getCountryConfig(country).defaultLocale,
    })
  );
}
