/**
 * Store Registry + Provider Registry integration (Phase 1).
 *
 * Resolves the separate concepts that the current runtime conflates:
 *  - provider  = the acquisition channel (registered in the Provider Registry)
 *  - store     = the merchant/seller brand the user sees, resolved here
 *
 * This module is the single source for canonical store identity. It minimizes
 * the "Admitad == Alibaba store" problem by exposing:
 *   resolveStoreId(providerId, merchantName?) -> stable store id
 *   getCanonicalStoreName(providerId, merchantName?) -> display name
 *
 * It REUSES the existing Provider Registry (lib/providers/registry.ts) — it does
 * not duplicate provider metadata. Store display metadata also reuses
 * PROVIDER_STORE_META where available, and admits per-merchant names for
 * indirect networks (e.g. Admitad merchants) that the display registry cannot
 * enumerate in advance.
 *
 * Pure functions — no I/O.
 */

import {
  getAllProviderIds,
  getProviderConfig,
  getProviderDisplayName,
  getProviderStoreMeta,
  isRegisteredProvider,
  type ProviderId,
} from "@/lib/providers/registry";

export interface CanonicalStore {
  storeId: string;
  slug: string;
  name: string;
  providerId: string;
  /** true when the store is an individual merchant inside a provider network. */
  isMerchant: boolean;
  /** source of the display name for observability. */
  nameSource: "registry" | "merchant" | "provider";
}

/**
 * Build a stable, deterministic store id.
 * For a provider-network merchant (e.g. Admitad -> "Alibaba"), storeId is
 * derived from the merchant slug so different merchants stay distinct.
 */
function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  );
}

/**
 * Resolve the canonical store identity for a provider + optional merchant name.
 *  - providerId is validated against the Provider Registry.
 *  - merchantName (e.g. an Admitad feed/merchant) is used when provided and is
 *    NOT a provider-registry store; otherwise the provider's own store is used.
 */
export function resolveCanonicalStore(
  providerId: string,
  merchantName?: string,
): CanonicalStore {
  const provider = getProviderConfig(providerId);
  if (!provider) {
    return {
      storeId: `store-${slugify(providerId)}`,
      slug: slugify(providerId),
      name: providerId,
      providerId,
      isMerchant: false,
      nameSource: "provider",
    };
  }

  const registryMeta = getProviderStoreMeta(providerId);
  const merchant = merchantName?.trim();

  if (merchant) {
    const merchantSlug = slugify(merchant);
    return {
      storeId: `merchant-${merchantSlug}`,
      slug: merchantSlug,
      name: merchant,
      providerId,
      isMerchant: true,
      nameSource: "merchant",
    };
  }

  return {
    storeId: `store-${slugify(provider.id)}`,
    slug: registryMeta?.slug ?? slugify(provider.id),
    name: registryMeta?.name ?? provider.name,
    providerId: provider.id,
    isMerchant: false,
    nameSource: "registry",
  };
}

/**
 * Convenience: canonical display name for a provider (+merchant).
 */
export function getCanonicalStoreName(providerId: string, merchantName?: string): string {
  return resolveCanonicalStore(providerId, merchantName).name;
}

/**
 * Convenience: canonical display name for a provider (falls back to registry).
 * Replaces scattered getProviderDisplayName usages at the UI edge.
 */
export function getProviderLabel(id: string): string {
  return getProviderDisplayName(id);
}

/**
 * The set of provider IDs known to the canonical spine. Derived from the
 * single source of truth (Provider Registry) — never a hardcoded list.
 */
export const CANONICAL_PROVIDER_IDS: readonly string[] = getAllProviderIds();

/** True when a provider is registered (mirrors isRegisteredProvider). */
export function isRegisteredProviderId(id: string): boolean {
  return isRegisteredProvider(id);
}

/** Re-export ProviderId for convenience. */
export type { ProviderId };

/** Provider acquisition availability derivation (config status, not "works"). */
export function providerAcquisitionMode(providerId: string): "direct" | "indirect" {
  // Direct API providers vs link-based providers (indirect).
  const INDIRECT_PROVIDER_IDS: ReadonlySet<string> = new Set(["admitad"]);
  return INDIRECT_PROVIDER_IDS.has(providerId) ? "indirect" : "direct";
}

/** Map a provider id to supported currencies from the registry (undefined-safe). */
export function providerSupportedCurrencies(providerId: string): string[] | undefined {
  return getProviderConfig(providerId)?.supportedCurrencies;
}