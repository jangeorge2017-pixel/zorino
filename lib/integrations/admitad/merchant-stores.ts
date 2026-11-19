/**
 * Admitad merchant -> Zorino `stores` rows.
 *
 * Surfaces active discovered Admitad merchant programs as real `stores` rows
 * so all active campaigns are visible in store/home surfaces with valid
 * affiliate destinations (merchant site URLs) and metadata.
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
  admitted_network: "admitad";
  admitted_campaign_id: string;
  is_active: true;
};

function initials(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "");
  return (letters.slice(0, 2) || "AR").toUpperCase();
}

export function deriveMerchantStoreRowsFromPrograms(
  programs: AdmitadMerchantProgram[],
): MerchantStoreRow[] {
  const rows = new Map<string, MerchantStoreRow>();

  for (const program of programs) {
    if (!Number.isFinite(program.campaignId)) continue;
    const website = program.siteUrl?.trim();
    if (!website || !/^https?:\/\//i.test(website)) continue;
    const name = program.merchantName?.trim();
    if (!name) continue;

    const slug = `admitad-${program.campaignId}`;
    if (rows.has(slug)) continue;

    rows.set(slug, {
      name,
      slug,
      website,
      integration_type: "partner",
      logo_initial: initials(name),
      supported_regions:
        Array.isArray(program.geoRestrictions) && program.geoRestrictions.length > 0
          ? program.geoRestrictions
          : ["US"],
      supported_currencies: program.currency ? [program.currency] : ["USD"],
      external_store_id: String(program.campaignId),
      admitted_network: "admitad",
      admitted_campaign_id: String(program.campaignId),
      is_active: true,
    });
  }

  return Array.from(rows.values());
}

/**
 * Backward-compatible derivation from ingested items; now returns store rows for
 * all programs that have valid metadata (campaign coverage is driven by active
 * discovered programs passed in).
 */
export function deriveMerchantStoreRows(
  _items: NormalizedCatalogItem[],
  programs: AdmitadMerchantProgram[],
): MerchantStoreRow[] {
  return deriveMerchantStoreRowsFromPrograms(programs);
}

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