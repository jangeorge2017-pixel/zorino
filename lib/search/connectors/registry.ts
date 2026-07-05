import { aliExpressSearchConnector } from "@/lib/search/connectors/aliexpress";
import { ebaySearchConnector } from "@/lib/search/connectors/ebay";
import {
  amazonSearchConnector,
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

/** Connectors that are configured and ready to search. */
export async function getActiveSearchConnectors(
  providerIds?: SearchProviderId[]
): Promise<SearchConnector[]> {
  const ids = providerIds ?? [...SEARCH_PROVIDER_IDS];
  const connectors = ids
    .map((id) => CONNECTOR_MAP.get(id))
    .filter((c): c is SearchConnector => c !== undefined);

  const availability = await Promise.all(
    connectors.map(async (connector) => ({
      connector,
      available: await connector.isAvailable(),
    }))
  );

  return availability.filter((row) => row.available).map((row) => row.connector);
}
