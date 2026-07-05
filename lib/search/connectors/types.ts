import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";

export type ConnectorSearchOptions = {
  pageSize?: number;
  maxPages?: number;
  minFetch?: number;
  targetFetch?: number;
  currency?: string;
  countryCode?: string;
};

/** Contract every marketplace search connector must implement. */
export interface SearchConnector {
  readonly id: SearchProviderId;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]>;
}
