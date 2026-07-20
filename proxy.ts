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
import { stripLocaleFromPathname } from "@/lib/international/path";

const intlMiddleware = createIntlMiddleware(routing);

function applyPreferenceCookies(
  response: NextResponse,
  country: CountryCode,
  request: NextRequest,
  localeOverride?: "en" | "ar",
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

  const preferredLocale =
    localeOverride ??
    (request.cookies.get(INTL_COOKIE_LOCALE)?.value as "en" | "ar" | undefined) ??
    getCountryConfig(country).defaultLocale;

  if (localeOverride || !request.cookies.get(INTL_COOKIE_LOCALE)) {
    response.cookies.set(INTL_COOKIE_LOCALE, preferredLocale, opts);
    response.cookies.set("NEXT_LOCALE", preferredLocale, opts);
  }

  response.headers.set("x-zor-detected-country", country);
}

/** Next.js 16+ proxy entry (replaces deprecated middleware.ts). */
export function proxy(request: NextRequest) {
  const detectedCountry = detectCountryFromHeaders(request);
  const geoInitialized = request.cookies.get(INTL_COOKIE_GEO_DONE)?.value === "1";
  const pathname = request.nextUrl.pathname;
  const pathWithoutLocale = stripLocaleFromPathname(pathname);
  const explicitEnglish = pathname === "/en" || pathname.startsWith("/en/");
  const explicitArabic = pathname === "/ar" || pathname.startsWith("/ar/");

  // Geo auto-Arabic is first-visit only, and never overrides an explicit /en URL.
  if (
    !geoInitialized &&
    shouldAutoRedirectToArabic(detectedCountry) &&
    !explicitArabic &&
    !explicitEnglish &&
    !pathname.startsWith("/api")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/ar${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
    const response = NextResponse.redirect(url);
    response.cookies.set(INTL_COOKIE_GEO_DONE, "1", {
      maxAge: INTL_COOKIE_MAX_AGE,
      path: "/",
    });
    applyPreferenceCookies(response, detectedCountry, request, "ar");
    return response;
  }

  const response = intlMiddleware(request);

  if (!geoInitialized) {
    response.cookies.set(INTL_COOKIE_GEO_DONE, "1", {
      maxAge: INTL_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  const localeOverride = explicitEnglish ? "en" : explicitArabic ? "ar" : undefined;
  applyPreferenceCookies(response, detectedCountry, request, localeOverride);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|robots\\.txt|sitemap\\.xml|.*\\..*).*)"],
};
