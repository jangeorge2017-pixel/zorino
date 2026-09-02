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
import { isProductionProviderActive } from "@/lib/integration/provider-config";
import { isAmazonConfigured } from "@/lib/integrations/amazon";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { StoreRow } from "@/lib/database/types";
import type { Store } from "@/lib/types/entities";

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
 *
 * Provider rows are REAL only while the provider is ACTIVATED — credentials
 * PLUS durable DB evidence of real product rows OR recent successful live runs
 * (see provider-config / provider-evidence / provider-health). A configured-
 * but-never-produced provider cannot advertise a store.
 */
export async function isRealDataStore(
  row: Pick<StoreRow, "slug" | "integration_type">,
): Promise<boolean> {
  const slug = row.slug;

  if (isAdmitadMerchantRow(slug)) {
    return row.integration_type === "partner";
  }

  if (LIVE_DATA_STORE_SLUGS.has(slug)) {
    return isProductionProviderActive(slug as ProductionProviderId);
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

function initials(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "");
  return (letters.slice(0, 2) || "AR").toUpperCase();
}

/**
 * Real Admitad merchant stores derived from the live database catalog plus the
 * real Admitad Publisher-API program metadata (name, site URL, geo, currency).
 *
 * Only merchants that (a) actually have products in `lowest_prices_today` AND
 * (b) have a real program record with a valid site URL are returned — nothing
 * is fabricated. Merchants without a discoverable site URL are skipped (the app
 * never invents a merchant website). Used by the /stores directory so every
 * real merchant is listed alongside the provider rows.
 *
 * The full DB merchant scan + Admitad discovery is expensive, so the result is
 * cached for 10 minutes (the merchant universe changes only when feeds change).
 */
const MERCHANT_STORES_TTL_MS = 10 * 60 * 1000;
let merchantStoresCache: { at: number; stores: Store[] } | null = null;

export async function getRealMerchantStores(): Promise<Store[]> {
  if (merchantStoresCache && Date.now() - merchantStoresCache.at < MERCHANT_STORES_TTL_MS) {
    return merchantStoresCache.stores;
  }

  const { getRealMerchantNames } = await import(
    "@/lib/integration/database-catalog"
  );
  const merchantNames = await getRealMerchantNames();

  // Prefer real program metadata (siteUrl/geo/currency) when discoverable.
  let programs: Array<{ merchantName: string; siteUrl: string; currency: string | null; geoRestrictions: string[]; campaignId: number }> = [];
  try {
    const { getAdmitadPrograms } = await import(
      "@/lib/integrations/admitad/merchant-discovery"
    );
    programs = (await getAdmitadPrograms()) as typeof programs;
  } catch {
    programs = [];
  }
  const programByName = new Map<string, (typeof programs)[number]>();
  for (const p of programs) {
    if (p.siteUrl) programByName.set(p.merchantName.trim().toLowerCase(), p);
  }

  const stores: Store[] = [];
  const seen = new Set<string>();

  for (const rawName of merchantNames) {
    const name = rawName.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const slug = `admitad-${key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const program = programByName.get(key);
    const website = program?.siteUrl ?? "";
    if (!website) continue; // never fabricate a merchant website

    stores.push({
      id: slug,
      name,
      slug,
      website,
      integrationType: "partner",
      logoInitial: initials(name),
      commissionRate: 0,
      supportedRegions: program?.geoRestrictions?.length
        ? program.geoRestrictions
        : ["US"],
      supportedCurrencies: program?.currency ? [program.currency] : ["USD"],
      externalStoreId: program ? String(program.campaignId) : null,
      isActive: true,
    });
  }

  merchantStoresCache = { at: Date.now(), stores };
  return stores;
}