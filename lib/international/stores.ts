import type { Store } from "@/lib/types/entities";
import { getCountryConfig, type CountryCode } from "@/lib/international/config";

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

/** Regional affiliate program slug — architecture for per-country programs. */
export function getAffiliateProgramForStore(
  store: Store,
  countryCode: CountryCode
): string | null {
  if (!isStoreAvailableInCountry(store, countryCode)) return null;
  return store.affiliateProgram ?? store.integrationType ?? null;
}
