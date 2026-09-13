/**
 * ProviderAdapter — the unified abstraction for every marketplace provider.
 *
 * Each adapter wraps a provider's data-fetching (SearchConnector) and
 * normalization logic into a single cohesive interface. The search engine,
 * homepage, and comparison engine consume ONLY this interface — never
 * provider-specific types.
 *
 * This interface is purely additive in Phase 1. Existing SearchConnector
 * code continues to work unchanged. Adapters are wired to existing
 * connectors via createConnectorAdapter() in adapter-registry.ts.
 *
 * In later phases, adapters will replace SearchConnector as the canonical
 * data-access layer.
 */

import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import type { ConnectorSearchOptions } from "@/lib/search/connectors/types";
import type { ProductDetail } from "@/lib/data/product-detail";

// ─── Search Result ──────────────────────────────────────────────────────────

/**
 * Typed result from a provider search. Wraps raw listings with provider
 * identity so callers never need to guess which provider produced what.
 */
export type ProviderSearchResult = {
  providerId: SearchProviderId;
  listings: RawProviderListing[];
  durationMs: number;
};

// ─── ProviderAdapter Interface ──────────────────────────────────────────────

/**
 * The contract every provider adapter must implement.
 *
 * Generics:
 *   TRaw — the provider's native API response item type.
 *          Used only inside the adapter; never leaks to callers.
 */
export interface ProviderAdapter<TRaw = unknown> {
  /** Provider ID matching PROVIDER_REGISTRY and SearchProviderId. */
  readonly id: SearchProviderId;

  /** Human-readable provider name. */
  readonly name: string;

  /**
   * Runtime availability check. Returns true when the provider has valid
   * credentials and can serve requests. The search engine uses this to
   * skip unavailable providers without blocking.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Normalize a single raw API item into the pipeline's internal format.
   * Returns null when the item is invalid and should be silently dropped.
   */
  normalize(raw: TRaw): RawProviderListing | null;

  /**
   * Normalize a batch of raw API items. Filters out nulls automatically.
   * Override when the provider benefits from batch-level deduplication
   * or transformation.
   */
  normalizeBatch(raws: TRaw[]): RawProviderListing[];

  /**
   * Full search pipeline: fetch from the provider, normalize results,
   * return typed ProviderSearchResult.
   *
   * Default implementation delegates to the underlying SearchConnector
   * (injected at construction time via createConnectorAdapter).
   * Providers can override for custom pagination, query expansion, or
   * multi-keyword strategies.
   */
  search(query: string, options?: ConnectorSearchOptions): Promise<ProviderSearchResult>;

  /**
   * Resolve a single product's detail (product-detail page) by its provider
   * external id. OPTIONAL — only providers with a real detail source implement
   * it. Returns null when the provider has no resolver, lacks credentials, or
   * the product cannot be found. Consumer code must use
   * resolveProviderProductDetail() from adapter-registry.ts rather than
   * reading provider-specific services directly.
   */
  getProductDetail?(externalId: string): Promise<ProductDetail | null>;
}

// ─── Utility Types ──────────────────────────────────────────────────────────

/**
 * Configuration for creating a ProviderAdapter via the registry.
 * Explicitly typed adapters (e.g. AliExpress) pass the raw type.
 * Bridge adapters (wrapping SearchConnector) pass unknown.
 */
export type AdapterConfig<TRaw = unknown> = {
  providerId: SearchProviderId;
  name: string;
  /** If provided, used as the normalize function instead of connector delegate. */
  normalizeFn?: (raw: TRaw) => RawProviderListing | null;
};

// ─── Default Batch Normalizer ───────────────────────────────────────────────

/**
 * Default batch normalization: calls normalize on each item, filters out nulls.
 * Used by createConnectorAdapter and createStubAdapter so each adapter doesn't
 * need to reimplement this common pattern.
 */
export function defaultNormalizeBatch<T>(
  items: T[],
  normalize: (item: T) => RawProviderListing | null,
): RawProviderListing[] {
  const out: RawProviderListing[] = [];
  for (const item of items) {
    const normalized = normalize(item);
    if (normalized) out.push(normalized);
  }
  return out;
}
