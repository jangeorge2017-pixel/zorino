export * from "@/lib/international/config";
export * from "@/lib/international/cookies";
export * from "@/lib/international/detect";
export * from "@/lib/international/format";
export * from "@/lib/international/exchange-rates";
export * from "@/lib/international/preferences";
export * from "@/lib/international/stores";
export * from "@/lib/international/categories";
export * from "@/lib/international/urls";

/** Phase 2 — global marketplace foundation */
export {
  getVisibleMarketplacesForCountry,
  getPrimaryMarketplaceForCountry,
  isMarketplaceAvailableInCountry,
  createCurrencyService,
  CurrencyService,
  resolveMarketplacePreferences,
  syncIntlPreferencesToProfile,
  MARKETPLACE_REGISTRY,
  GLOBAL_COUNTRY_REGISTRY,
  getGlobalCountryConfig,
  LOCALE_CATALOG,
  SUPPORTED_LOCALES,
} from "@/lib/global-marketplace";
