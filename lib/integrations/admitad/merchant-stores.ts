/**
 * Admitad merchant → Zorino `stores` rows.
 *
 * The Admitad network carries many real merchants under one affiliate
 * account. This module surfaces each merchant that ACTUALLY yielded real
 * products in an ingestion run as its own active `stores` row, so the
 * homepage / /stores counts reflect real merchants instead of collapsing the
 * whole network into a single "admitad" store.
 *
 * Rows are derived exclusively from real Admitad Publisher-API discovery
 * data (campaign id, merchant name, site URL, geo restrictions, currency).
 * No placeholder, seed, or synthetic values are ever written.
 */

import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { AdmitadMerchantProgram } from "./merchant-discovery";

export type MerchantStoreRow = {
  name: string;
  slug: string;
  website: string;
  integration_type: "partner";
  logo_initial: string | null;
  supported_regions: string[];
  supported_currencies: string[];
  external_store_id: string;
  is_active: true;
};

function initials(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "");
  return (letters.slice(0, 2) || "AR").toUpperCase();
}

/**
 * Pure computation of the real merchant store rows for the catalog items an
 * ingestion run produced. Uses the campaign id embedded in each item id
 * ("admitad-<campaignId>-<offerId>") to look up the official Admitad program
 * metadata. Merchants without a real site URL are skipped (no fabricated
 * websites).
 */
export function deriveMerchantStoreRows(
  items: NormalizedCatalogItem[],
  programs: AdmitadMerchantProgram[],
): MerchantStoreRow[] {
  const programById = new Map<number, AdmitadMerchantProgram>(
    programs
      .filter((p) => Number.isFinite(p.campaignId))
      .map((p) => [p.campaignId, p]),
  );

  const rows = new Map<string, MerchantStoreRow>();

  for (const item of items) {
    const offer = item.offers[0];
    if (!offer || offer.providerId !== "admitad") continue;

    const campaignId = Number(item.id.split("-")[1]);
    if (!Number.isFinite(campaignId)) continue;
    const program = programById.get(campaignId);
    if (!program) continue;

    const website = program.siteUrl?.trim();
    if (!website || !/^https?:\/\//i.test(website)) continue;

    const slug = `admitad-${campaignId}`;
    if (rows.has(slug)) continue;

    rows.set(slug, {
      name: program.merchantName.trim(),
      slug,
      website,
      integration_type: "partner",
      logo_initial: initials(program.merchantName),
      supported_regions:
        program.geoRestrictions.length > 0 ? program.geoRestrictions : ["US"],
      supported_currencies: program.currency ? [program.currency] : ["USD"],
      external_store_id: String(campaignId),
      is_active: true,
    });
  }

  return Array.from(rows.values());
}

/**
 * Persist the merchant store rows with the service-role client.
 * Returns the number of rows written (0 = nothing to write / not configured).
 */
export async function syncMerchantStores(
  items: NormalizedCatalogItem[],
  programs: AdmitadMerchantProgram[],
): Promise<number> {
  const rows = deriveMerchantStoreRows(items, programs);
  if (rows.length === 0) return 0;

  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.warn("[admitad-merchant-stores] Supabase not configured, skipping store sync");
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { error } = await db
    .from("stores")
    .upsert(rows, { onConflict: "slug", ignoreDuplicates: false });

  if (error) {
    console.error("[admitad-merchant-stores] upsert failed:", error.message);
    return 0;
  }

  console.log(`[admitad-merchant-stores] synced ${rows.length} real merchant stores`);
  return rows.length;
}