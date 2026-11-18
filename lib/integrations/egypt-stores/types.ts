import type { ConnectorSearchOptions } from "@/lib/search/connectors/types";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";

export type StoreSearchAdapter = {
  readonly id: SearchProviderId;
  readonly name: string;
  search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]>;
};

export function maxPagesFor(options: ConnectorSearchOptions | undefined, cap: number): number {
  const requested = options?.maxPages ?? 1;
  if (!Number.isFinite(requested)) return 1;
  return Math.min(Math.max(1, Math.trunc(requested)), cap);
}
