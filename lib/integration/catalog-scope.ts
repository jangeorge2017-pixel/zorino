/**
 * Catalog market scope — the single source of truth for WHICH markets the
 * product catalog ingests and serves.
 *
 * Historically every catalog query hardcoded `country_code = "US"` and every
 * Admitad offer was stamped `countryCode: "US"`. That made the US the only
 * market the pipeline could ever hold, so real rows bound to the Arabic
 * storefronts (AE / SA / EG — e.g. Noon EG, Jumia EG, Admitad merchants that
 * target those geos) were dropped at the country filter layer.
 *
 * This module replaces that hardcoding with ONE configurable scope shared by
 * both the ingestion path (what country a row is bound to) and the query path
 * (which country codes a read leg accepts), so the two can never drift.
 *
 * Real-data rule: the market a row is bound to comes ONLY from a real source
 * signal (a program's declared GEO target, or the offer's own currency). The
 * scope below never invents a market; it only decides which real markets the
 * catalog serves.
 */

import {
  DEFAULT_COUNTRY,
  getDefaultCurrencyForCountry,
  isSupportedCountry,
  isSupportedCurrency,
  type CountryCode,
  type CurrencyCode,
} from "@/lib/international/config";

/**
 * Default markets the catalog ingests and serves: the US plus the Arabic
 * storefronts Zorino targets. Overridable with the `CATALOG_COUNTRIES` env var
 * (comma-separated ISO 3166-1 alpha-2 codes) so scope can change without a code
 * change. `GLOBAL` is a UI pseudo-market and is never a concrete catalog scope.
 */
export const DEFAULT_CATALOG_COUNTRIES: readonly CountryCode[] = [
  "US",
  "AE",
  "SA",
  "EG",
];

function parseCatalogCountries(raw: string | undefined): readonly CountryCode[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((token) => token.trim().toUpperCase())
    .filter(
      (token): token is CountryCode =>
        isSupportedCountry(token) && token !== "GLOBAL",
    );
  return parsed.length > 0
    ? Array.from(new Set(parsed))
    : DEFAULT_CATALOG_COUNTRIES;
}

/** Markets the catalog ingests and serves (see DEFAULT_CATALOG_COUNTRIES). */
export const CATALOG_COUNTRIES: readonly CountryCode[] = parseCatalogCountries(
  process.env.CATALOG_COUNTRIES,
);

/**
 * Currencies accepted at the query layer — the default currency of each catalog
 * market, deduped. Derived from CATALOG_COUNTRIES so the currency scope can
 * never drift from the country scope.
 */
export const CATALOG_CURRENCIES: readonly CurrencyCode[] = Array.from(
  new Set(CATALOG_COUNTRIES.map((country) => getDefaultCurrencyForCountry(country))),
);

const CATALOG_COUNTRY_SET = new Set<string>(CATALOG_COUNTRIES);
const CATALOG_CURRENCY_SET = new Set<string>(CATALOG_CURRENCIES);

/** True when `code` is a market the catalog serves. */
export function isCatalogCountry(code: string | null | undefined): boolean {
  return typeof code === "string" && CATALOG_COUNTRY_SET.has(code.toUpperCase());
}

/** True when `code` is a currency the catalog serves. */
export function isCatalogCurrency(code: string | null | undefined): boolean {
  return typeof code === "string" && CATALOG_CURRENCY_SET.has(code.toUpperCase());
}

/** REAL currency → home-market country mapping used to bind a feed offer. */
const CURRENCY_HOME_COUNTRY: Readonly<Partial<Record<CurrencyCode, CountryCode>>> = {
  USD: "US",
  EUR: "DE",
  GBP: "GB",
  AED: "AE",
  SAR: "SA",
  EGP: "EG",
  CAD: "CA",
};

/** Home-market country for a real ISO 4217 currency, or null when unmapped. */
export function resolveCountryForCurrency(
  currency: string | null | undefined,
): CountryCode | null {
  if (!currency) return null;
  const upper = currency.trim().toUpperCase();
  if (!isSupportedCurrency(upper)) return null;
  return CURRENCY_HOME_COUNTRY[upper] ?? null;
}

/**
 * Resolve the market country for a feed offer from the REAL signals its source
 * provides — a merchant/program declared GEO target (authoritative) first, then
 * the offer's own currency. Falls back to the default country only when neither
 * signal maps to a known market, so a row is never mislabeled.
 */
export function resolveCatalogCountryForOffer(signals: {
  geoRestrictions?: readonly string[] | null;
  currency?: string | null;
}): CountryCode {
  const geo = (signals.geoRestrictions ?? [])
    .map((region) => (region ?? "").trim().toUpperCase())
    .find(
      (region): region is CountryCode =>
        isSupportedCountry(region) && region !== "GLOBAL",
    );
  if (geo) return geo;
  return resolveCountryForCurrency(signals.currency) ?? DEFAULT_COUNTRY;
}
