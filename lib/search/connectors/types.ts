import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import type { SearchQueryIntent } from "@/lib/search/query-intent";

export type ConnectorSearchOptions = {
  pageSize?: number;
  maxPages?: number;
  minFetch?: number;
  targetFetch?: number;
  currency?: string;
  countryCode?: string;
  /**
   * Opt-in: connectors may adapt the query to their catalog for device-intent
   * searches (category narrowing, generic family keyword expansion). Only the
   * /search surface sets this; when absent every connector keeps its legacy
   * behaviour byte-for-byte so the homepage catalog and Compare Prices are
   * unaffected.
   */
  optimizeForDeviceIntent?: boolean;
  /** Precomputed intent from lib/search/query-intent; connectors recompute if absent. */
  intent?: SearchQueryIntent;
};

/** Contract every marketplace search connector must implement. */
export interface SearchConnector {
  readonly id: SearchProviderId;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]>;
}
