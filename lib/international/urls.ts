import { getSiteUrl } from "@/lib/site-url";
import { locales, type Locale } from "@/i18n/config";
import { routing } from "@/i18n/routing";

const LOCALE_PREFIX_PATTERN = new RegExp(`^/(${locales.join("|")})(/|$)`);

/** Strip leading locale segment from a pathname. */
export function stripLocaleFromPathname(pathname: string): string {
  const stripped = pathname.replace(LOCALE_PREFIX_PATTERN, "/");
  if (stripped === "") return "/";
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

/** Build a localized URL respecting localePrefix: 'as-needed'. */
export function buildLocalizedUrl(pathname: string, locale: Locale, baseUrl?: string): string {
  const siteUrl = (baseUrl ?? getSiteUrl()).replace(/\/$/, "");
  const path = stripLocaleFromPathname(pathname);
  const normalizedPath = path === "/" ? "" : path;

  if (locale === routing.defaultLocale) {
    return `${siteUrl}${normalizedPath || "/"}`;
  }

  return `${siteUrl}/${locale}${normalizedPath}`;
}

/** hreflang map for all supported locales. */
export function buildHreflangAlternates(
  pathname: string,
  baseUrl?: string
): Record<string, string> {
  const siteUrl = baseUrl ?? getSiteUrl();
  const alternates: Record<string, string> = {};

  for (const locale of locales) {
    alternates[locale] = buildLocalizedUrl(pathname, locale, siteUrl);
  }

  alternates["x-default"] = buildLocalizedUrl(pathname, routing.defaultLocale, siteUrl);
  return alternates;
}

export function openGraphLocale(locale: Locale): string {
  return locale === "ar" ? "ar_AE" : "en_US";
}
