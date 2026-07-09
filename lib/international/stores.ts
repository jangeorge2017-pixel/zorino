import type { Store } from "@/lib/types/entities";
import { getCountryConfig, type CountryCode } from "@/lib/international/config";
import { getVisibleMarketplacesForCountry } from "@/lib/global-marketplace/visibility";

/** Whether a store is available in the given country based on supportedRegions. */
export function isStoreAvailableInCountry(store: Store, countryCode: CountryCode): boolean {
  const regions = store.supportedRegions ?? [];
  if (regions.includes("GLOBAL")) return true;

  const country = getCountryConfig(countryCode);
  return regions.some((region) => country.storeRegions.includes(region));
}

export function filterStoresByCountry(stores: Store[], countryCode: CountryCode): Store[] {
  if (countryCode === "GLOBAL") return stores;
  return stores.filter((store) => isStoreAvailableInCountry(store, countryCode));
}

/**
 * Filter stores to those whose slug maps to a marketplace visible in the country.
 * Falls back to region-based filtering when no registry match exists.
 */
export function filterStoresByMarketplaceVisibility(
  stores: Store[],
  countryCode: CountryCode
): Store[] {
  const visible = getVisibleMarketplacesForCountry(countryCode);
  const visibleIntegrationIds = new Set(
    visible.map((m) => m.integrationProviderId ?? m.id).filter(Boolean)
  );

  if (visibleIntegrationIds.size === 0) {
    return filterStoresByCountry(stores, countryCode);
  }

  return stores.filter((store) => {
    const key = store.integrationType ?? store.slug;
    if (key && visibleIntegrationIds.has(key)) return true;
    return isStoreAvailableInCountry(store, countryCode);
  });
}

/** Regional affiliate program slug — architecture for per-country programs. */
export function getAffiliateProgramForStore(
  store: Store,
  countryCode: CountryCode
): string | null {
  if (!isStoreAvailableInCountry(store, countryCode)) return null;
  return store.affiliateProgram ?? store.integrationType ?? null;
}
