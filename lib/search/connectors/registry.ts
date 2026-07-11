import { aliExpressSearchConnector } from "@/lib/search/connectors/aliexpress";
import { amazonSearchConnector } from "@/lib/search/connectors/amazon";
import { ebaySearchConnector } from "@/lib/search/connectors/ebay";
import {
  bestBuySearchConnector,
  jumiaSearchConnector,
  noonSearchConnector,
  temuSearchConnector,
  walmartSearchConnector,
} from "@/lib/search/connectors/stubs";
import type { SearchConnector } from "@/lib/search/connectors/types";
import type { SearchProviderId } from "@/lib/search/types";
import { SEARCH_PROVIDER_IDS } from "@/lib/search/types";

const ALL_CONNECTORS: SearchConnector[] = [
  aliExpressSearchConnector,
  ebaySearchConnector,
  amazonSearchConnector,
  walmartSearchConnector,
  bestBuySearchConnector,
  temuSearchConnector,
  noonSearchConnector,
  jumiaSearchConnector,
];

const CONNECTOR_MAP = new Map<SearchProviderId, SearchConnector>(
  ALL_CONNECTORS.map((c) => [c.id, c])
);

export function getSearchConnector(id: SearchProviderId): SearchConnector | undefined {
  return CONNECTOR_MAP.get(id);
}

export function getAllSearchConnectors(): SearchConnector[] {
  return ALL_CONNECTORS;
}

/** All 8 marketplace connectors (availability checked separately). */
export function getRegisteredSearchConnectors(): SearchConnector[] {
  return SEARCH_PROVIDER_IDS.map((id) => CONNECTOR_MAP.get(id)).filter(
    (c): c is SearchConnector => c !== undefined
  );
}

/** Connectors that are configured and ready to search — never blocks on failures. */
export async function getActiveSearchConnectors(
  providerIds?: SearchProviderId[]
): Promise<SearchConnector[]> {
  // Single source of truth: registered connectors. Optional filter only.
  // New connectors added to ALL_CONNECTORS are included automatically.
  const connectors = (providerIds
    ? providerIds.map((id) => CONNECTOR_MAP.get(id)).filter((c): c is SearchConnector => c !== undefined)
    : [...ALL_CONNECTORS]);

  const availability = await Promise.all(
    connectors.map(async (connector) => ({
      connector,
      available: await connector.isAvailable(),
    }))
  );

  return availability.filter((row) => row.available).map((row) => row.connector);
}

/** Count of registered marketplace connectors (grows when connectors are added). */
export function getRegisteredProviderCount(): number {
  return ALL_CONNECTORS.length;
}
