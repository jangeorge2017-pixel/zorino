import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import {
  INTL_COOKIE_COUNTRY,
  INTL_COOKIE_CURRENCY,
  INTL_COOKIE_GEO_DONE,
  INTL_COOKIE_LOCALE,
  INTL_COOKIE_MAX_AGE,
} from "@/lib/international/cookies";
import {
  detectCountryFromHeaders,
  shouldAutoRedirectToArabic,
} from "@/lib/international/detect";
import {
  getCountryConfig,
  getDefaultCurrencyForCountry,
  type CountryCode,
} from "@/lib/international/config";
import { stripLocaleFromPathname } from "@/lib/international/urls";

const intlMiddleware = createIntlMiddleware(routing);

function applyPreferenceCookies(
  response: NextResponse,
  country: CountryCode,
  request: NextRequest
) {
  const secure = process.env.NODE_ENV === "production";
  const opts = { maxAge: INTL_COOKIE_MAX_AGE, path: "/", sameSite: "lax" as const, secure };

  if (!request.cookies.get(INTL_COOKIE_COUNTRY)) {
    response.cookies.set(INTL_COOKIE_COUNTRY, country, opts);
  }

  if (!request.cookies.get(INTL_COOKIE_CURRENCY)) {
    response.cookies.set(
      INTL_COOKIE_CURRENCY,
      getDefaultCurrencyForCountry(country),
      opts
    );
  }

  if (!request.cookies.get(INTL_COOKIE_LOCALE)) {
    response.cookies.set(
      INTL_COOKIE_LOCALE,
      getCountryConfig(country).defaultLocale,
      opts
    );
  }

  response.headers.set("x-zor-detected-country", country);
}

/** Next.js 16+ proxy entry (replaces deprecated middleware.ts). */
export function proxy(request: NextRequest) {
  const detectedCountry = detectCountryFromHeaders(request);
  const geoInitialized = request.cookies.get(INTL_COOKIE_GEO_DONE)?.value === "1";
  const pathname = request.nextUrl.pathname;
  const pathWithoutLocale = stripLocaleFromPathname(pathname);

  if (
    !geoInitialized &&
    shouldAutoRedirectToArabic(detectedCountry) &&
    !pathname.startsWith("/ar") &&
    !pathname.startsWith("/api")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/ar${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
    const response = NextResponse.redirect(url);
    response.cookies.set(INTL_COOKIE_GEO_DONE, "1", {
      maxAge: INTL_COOKIE_MAX_AGE,
      path: "/",
    });
    applyPreferenceCookies(response, detectedCountry, request);
    return response;
  }

  const response = intlMiddleware(request);

  if (!geoInitialized) {
    response.cookies.set(INTL_COOKIE_GEO_DONE, "1", {
      maxAge: INTL_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  applyPreferenceCookies(response, detectedCountry, request);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|robots\\.txt|sitemap\\.xml|.*\\..*).*)"],
};
