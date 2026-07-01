import type { NextRequest } from "next/server";
import {
  ARABIC_DEFAULT_COUNTRIES,
  DEFAULT_COUNTRY,
  type CountryCode,
  getDefaultCurrencyForCountry,
  isSupportedCountry,
} from "@/lib/international/config";

const GEO_HEADER_CANDIDATES = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "x-country-code",
  "cloudfront-viewer-country",
] as const;

/** Detect ISO country from edge/CDN headers (Vercel, Cloudflare, etc.). */
export function detectCountryFromHeaders(request: NextRequest): CountryCode {
  for (const header of GEO_HEADER_CANDIDATES) {
    const value = request.headers.get(header)?.toUpperCase();
    if (value && isSupportedCountry(value)) {
      return value;
    }
    if (value === "UK" && isSupportedCountry("GB")) {
      return "GB";
    }
  }

  const acceptLanguage = request.headers.get("accept-language") ?? "";
  if (/\bar\b/i.test(acceptLanguage) || /\bar-/i.test(acceptLanguage)) {
    return "AE";
  }

  return DEFAULT_COUNTRY;
}

export function shouldAutoRedirectToArabic(country: CountryCode): boolean {
  return ARABIC_DEFAULT_COUNTRIES.has(country);
}

export function resolveCurrencyForRequest(
  request: NextRequest,
  country: CountryCode
): string {
  const cookieCurrency = request.cookies.get("zor_currency")?.value;
  if (cookieCurrency) return cookieCurrency;
  return getDefaultCurrencyForCountry(country);
}
