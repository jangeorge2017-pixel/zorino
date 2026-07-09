/**
 * Localization infrastructure — catalog only (no message bundles yet).
 * Active routing locales remain in i18n/config.ts (en, ar).
 */

export const SUPPORTED_LOCALES = ["en", "ar", "fr", "de", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type LocaleCatalogEntry = {
  code: SupportedLocale;
  label: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
  /** Whether next-intl routing is enabled for this locale */
  routingActive: boolean;
  /** BCP 47 tag for Intl formatters */
  bcp47: string;
};

export const LOCALE_CATALOG: Record<SupportedLocale, LocaleCatalogEntry> = {
  en: {
    code: "en",
    label: "English",
    nativeLabel: "English",
    dir: "ltr",
    routingActive: true,
    bcp47: "en-US",
  },
  ar: {
    code: "ar",
    label: "Arabic",
    nativeLabel: "العربية",
    dir: "rtl",
    routingActive: true,
    bcp47: "ar",
  },
  fr: {
    code: "fr",
    label: "French",
    nativeLabel: "Français",
    dir: "ltr",
    routingActive: false,
    bcp47: "fr-FR",
  },
  de: {
    code: "de",
    label: "German",
    nativeLabel: "Deutsch",
    dir: "ltr",
    routingActive: false,
    bcp47: "de-DE",
  },
  es: {
    code: "es",
    label: "Spanish",
    nativeLabel: "Español",
    dir: "ltr",
    routingActive: false,
    bcp47: "es-ES",
  },
};

export const DEFAULT_LOCALE: SupportedLocale = "en";

export function isSupportedLocale(code: string): code is SupportedLocale {
  return SUPPORTED_LOCALES.includes(code as SupportedLocale);
}

export function getLocaleCatalogEntry(code: string): LocaleCatalogEntry {
  if (isSupportedLocale(code)) return LOCALE_CATALOG[code];
  return LOCALE_CATALOG.en;
}

export function listLocaleCatalog(): LocaleCatalogEntry[] {
  return SUPPORTED_LOCALES.map((code) => LOCALE_CATALOG[code]);
}

export function listRoutingLocales(): SupportedLocale[] {
  return SUPPORTED_LOCALES.filter((code) => LOCALE_CATALOG[code].routingActive);
}
