/**
 * Real, data-backed store identity rules shared by the homepage stats and the
 * /stores directory.
 *
 * Only stores that actually produce real product data are considered "real":
 *   - live configured providers (aliExpress, eBay, Admitad, CJdropshipping)
 *   - Admitad merchant rows (slug "admitad-<campaignId>") — created by the
 *     ingestion pipeline ONLY for merchants whose feeds yielded real products
 *   - Amazon / Amazon-EG when real Creators credentials are configured
 *
 * Stubbed / seed / static store rows (walmart, temu, bestbuy, noon, jumia,
 * nike, foot-locker, …) are never reported here, so they can neither appear
 * in the directory nor inflate the homepage store counter.
 */

import type { ProductionProviderId } from "@/lib/integration/constants";
import { isProductionProviderConfigured } from "@/lib/integration/provider-config";
import { isAmazonConfigured } from "@/lib/integrations/amazon";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { StoreRow } from "@/lib/database/types";

/**
 * Provider store slugs that map to a real, live, product-producing
 * integration when the provider is configured.
 */
export const LIVE_DATA_STORE_SLUGS: ReadonlySet<string> = new Set([
  "aliexpress",
  "ebay",
  "admitad",
  "cjdropshipping",
]);

/** Admitad merchant rows created by the ingestion pipeline (real products only). */
function isAdmitadMerchantRow(slug: string): boolean {
  return slug.startsWith("admitad-");
}

/**
 * Whether a `stores` row represents a real store that has (or can produce)
 * real product data. Used to filter the /stores directory and any count that
 * derives from the `stores` table.
 */
export function isRealDataStore(
  row: Pick<StoreRow, "slug" | "integration_type">,
): boolean {
  const slug = row.slug;

  if (isAdmitadMerchantRow(slug)) {
    return row.integration_type === "partner";
  }

  if (LIVE_DATA_STORE_SLUGS.has(slug)) {
    return isProductionProviderConfigured(slug as ProductionProviderId);
  }

  if (slug === "amazon" || slug === "amazon-eg") {
    return isAmazonConfigured();
  }

  return false;
}

/**
 * Count the distinct REAL store identities present in a catalog snapshot:
 * one identity per unique Admitad merchant (offer storeName) plus one per
 * other live provider. Unknown/unmappable items are ignored so a broken row
 * can never inflate the count.
 */
export function countRealStoresFromCatalog(items: NormalizedCatalogItem[]): number {
  const identities = new Set<string>();

  for (const item of items) {
    const offer = item.offers[0];
    const providerId = item.providerIds[0] ?? offer?.providerId ?? "unknown";

    if (providerId === "admitad") {
      const merchant = offer?.storeName?.trim();
      if (merchant) identities.add(`admitad:${merchant}`);
    } else {
      identities.add(providerId);
    }
  }

  return identities.size;
}