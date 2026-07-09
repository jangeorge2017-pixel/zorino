import type { CountryCode } from "@/lib/international/config";
import { getGlobalCountryConfig } from "@/lib/global-marketplace/countries/registry";
import { getMarketplaceById, listMarketplaces } from "@/lib/global-marketplace/marketplaces/registry";
import type { MarketplaceDefinition } from "@/lib/global-marketplace/types";

export function isMarketplaceAvailableInCountry(
  marketplaceId: string,
  countryCode: CountryCode
): boolean {
  const country = getGlobalCountryConfig(countryCode);
  return country.availableMarketplaces.includes(marketplaceId);
}

/** Marketplaces visible to the user for their selected country, in priority order. */
export function getVisibleMarketplacesForCountry(
  countryCode: CountryCode
): MarketplaceDefinition[] {
  const country = getGlobalCountryConfig(countryCode);
  const ordered = country.marketplacePriority.filter((id) =>
    country.availableMarketplaces.includes(id)
  );

  const seen = new Set<string>();
  const result: MarketplaceDefinition[] = [];

  for (const id of ordered) {
    if (seen.has(id)) continue;
    const marketplace = getMarketplaceById(id);
    if (!marketplace) continue;
    if (!marketplace.supportedCountries.includes(countryCode) && countryCode !== "GLOBAL") {
      continue;
    }
    seen.add(id);
    result.push(marketplace);
  }

  // Include any available marketplaces not listed in priority
  for (const id of country.availableMarketplaces) {
    if (seen.has(id)) continue;
    const marketplace = getMarketplaceById(id);
    if (marketplace) {
      seen.add(id);
      result.push(marketplace);
    }
  }

  return result;
}

export function filterMarketplacesByCountry(
  marketplaceIds: string[],
  countryCode: CountryCode
): string[] {
  return marketplaceIds.filter((id) => isMarketplaceAvailableInCountry(id, countryCode));
}

export function getPrimaryMarketplaceForCountry(
  countryCode: CountryCode
): MarketplaceDefinition | null {
  const visible = getVisibleMarketplacesForCountry(countryCode);
  return visible[0] ?? null;
}

export function listAllMarketplacesForCountry(countryCode: CountryCode): MarketplaceDefinition[] {
  if (countryCode === "GLOBAL") return listMarketplaces();
  return listMarketplaces().filter((m) => m.supportedCountries.includes(countryCode));
}
