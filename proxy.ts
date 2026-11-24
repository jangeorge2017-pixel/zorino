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

const INTERNAL_LOCALE_REWRITE_HEADER = "x-zor-internal-locale-rewrite";

function isInternalProxyRewriteTarget(url: URL, request: NextRequest) {
  const hostname = url.hostname.toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === request.nextUrl.hostname.toLowerCase()
  );
}

function getRequestHost(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    request.nextUrl.host
  ).toLowerCase();
}

function getRequestProtocol(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwarded === "http" || forwarded === "https") return forwarded;
  return request.nextUrl.protocol === "http:" ? "http" : "https";
}

function normalizeInternalRedirect(response: NextResponse, request: NextRequest) {
  const location = response.headers.get("location");
  if (!location) return response;

  try {
    const url = new URL(location, request.url);
    if (isInternalProxyRewriteTarget(url, request) || url.host.toLowerCase() === getRequestHost(request)) {
      const origin = `${getRequestProtocol(request)}://${getRequestHost(request)}`;
      response.headers.set("location", `${origin}${url.pathname}${url.search}${url.hash}`);
    }
  } catch {}

  return response;
}

function normalizeIntlProxyResponse(response: NextResponse, request: NextRequest) {
  normalizeInternalRedirect(response, request);

  const rewrite = response.headers.get("x-middleware-rewrite");
  if (!rewrite) return response;

  try {
    const url = new URL(rewrite);
    if (url.protocol === "https:" && isInternalProxyRewriteTarget(url, request)) {
      url.protocol = "http:";
      response.headers.set("x-middleware-rewrite", url.toString());
    }
  } catch {}

  const overrideHeader = response.headers.get("x-middleware-override-headers");
  const overrides = overrideHeader
    ? overrideHeader.split(",").map((name) => name.trim()).filter(Boolean)
    : [];
  if (!overrides.includes(INTERNAL_LOCALE_REWRITE_HEADER)) {
    overrides.push(INTERNAL_LOCALE_REWRITE_HEADER);
  }
  response.headers.set("x-middleware-override-headers", overrides.join(","));
  response.headers.set(`x-middleware-request-${INTERNAL_LOCALE_REWRITE_HEADER}`, "1");
  return response;
}

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
  if (request.headers.get(INTERNAL_LOCALE_REWRITE_HEADER) === "1") {
    return NextResponse.next();
  }

  const detectedCountry = detectCountryFromHeaders(request);
  const geoInitialized = request.cookies.get(INTL_COOKIE_GEO_DONE)?.value === "1";
  const pathname = request.nextUrl.pathname;
  const pathWithoutLocale = stripLocaleFromPathname(pathname);
  const explicitEnglish = pathname === "/en" || pathname.startsWith("/en/");
  const explicitArabic = pathname === "/ar" || pathname.startsWith("/ar/");

  if (explicitEnglish) {
    const headers = new Headers(request.headers);
    headers.set("x-next-intl-locale", "en");
    headers.set(INTERNAL_LOCALE_REWRITE_HEADER, "1");
    const response = normalizeIntlProxyResponse(
      NextResponse.rewrite(request.nextUrl, { request: { headers } }),
      request,
    );
    if (!geoInitialized) {
      response.cookies.set(INTL_COOKIE_GEO_DONE, "1", {
        maxAge: INTL_COOKIE_MAX_AGE,
        path: "/",
      });
    }
    applyPreferenceCookies(response, detectedCountry, request, "en");
    return response;
  }

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
    const response = normalizeInternalRedirect(NextResponse.redirect(url), request);
    response.cookies.set(INTL_COOKIE_GEO_DONE, "1", {
      maxAge: INTL_COOKIE_MAX_AGE,
      path: "/",
    });
    applyPreferenceCookies(response, detectedCountry, request, "ar");
    return response;
  }

  const response = normalizeIntlProxyResponse(intlMiddleware(request), request);

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
  matcher: ["/((?!api|_next|_vercel|cart|auth/callback|robots\\.txt|sitemap\\.xml|.*\\..*).*)"],
};
