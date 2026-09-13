/**
 * Resolve marketplace / provider ids without hardcoded share maps.
 * Unknown ids pass through so newly registered marketplaces keep working.
 *
 * The canonical resolver lives in the provider registry
 * (lib/providers/registry.ts) — this module is just the search-layer view,
 * so provider identity is maintained in exactly one place.
 */

import { resolveProviderId } from "@/lib/providers/registry";

/**
 * Map a store slug, store name, product id prefix, or raw provider id
 * onto a marketplace id. Falls back to the normalized input — never forces
 * a default marketplace like AliExpress.
 */
export function resolveMarketplaceId(raw: string | null | undefined): string {
  return resolveProviderId(raw);
}
