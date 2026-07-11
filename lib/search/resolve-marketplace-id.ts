/**
 * Resolve marketplace / provider ids without hardcoded share maps.
 * Unknown ids pass through so newly registered marketplaces keep working.
 */

import { SEARCH_PROVIDER_IDS } from "@/lib/search/types";

const KNOWN_IDS = SEARCH_PROVIDER_IDS as readonly string[];

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Map a store slug, store name, product id prefix, or raw provider id
 * onto a marketplace id. Falls back to the normalized input — never forces
 * a default marketplace like AliExpress.
 */
export function resolveMarketplaceId(raw: string | null | undefined): string {
  const input = (raw ?? "").trim().toLowerCase();
  if (!input) return "unknown";

  const slug = input.replace(/\s+/g, "-");
  const packed = compact(input);

  for (const id of KNOWN_IDS) {
    if (slug === id || packed === compact(id)) return id;
  }

  for (const id of KNOWN_IDS) {
    if (slug.includes(id) || packed.includes(compact(id))) return id;
  }

  // Ids like "flash-ebay-123" / "pick-amazon-abc"
  const parts = slug.split("-").filter(Boolean);
  for (const part of parts) {
    for (const id of KNOWN_IDS) {
      if (part === id || compact(part) === compact(id)) return id;
    }
  }

  return slug || packed || "unknown";
}
