import manifest from "@/data/admitted-network.json";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

type ManifestProgram = {
  id: string;
  name: string;
  slug: string;
  siteUrl: string;
  logoUrl: string | null;
};

type ManifestShape = {
  programCount: number;
  programs: ManifestProgram[];
};

const admittedManifest = manifest as ManifestShape;

export function normalizeMerchantName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function fallbackNames(): Set<string> {
  return new Set(
    admittedManifest.programs
      .map((program) => normalizeMerchantName(program.name))
      .filter(Boolean),
  );
}

export type AdmittedMerchantRegistry = {
  names: Set<string>;
  programs: ManifestProgram[];
  source: "database" | "manifest";
};

const REGISTRY_TTL_MS = 5 * 60 * 1000;
let cached: { at: number; value: AdmittedMerchantRegistry } | null = null;
let inflight: Promise<AdmittedMerchantRegistry> | null = null;

/**
 * Approved Admitad merchant allowlist.
 *
 * The database is authoritative after `import:admitted` has run. The committed
 * manifest is the build-time fallback so the app can render before/without the
 * ingestion columns and never falls back to an unrestricted provider catalog.
 */
export async function getAdmittedMerchantRegistry(): Promise<AdmittedMerchantRegistry> {
  if (cached && Date.now() - cached.at < REGISTRY_TTL_MS) return cached.value;
  if (inflight) return inflight;

  inflight = (async () => {
    const manifestRegistry: AdmittedMerchantRegistry = {
      names: fallbackNames(),
      programs: admittedManifest.programs,
      source: "manifest",
    };

    const supabase = createSupabaseAnonClient();
    if (!supabase) return manifestRegistry;

    const { data, error } = await supabase
      .from("stores")
      .select("name, slug, admitted_campaign_id, logo_url, website")
      .eq("admitted_network", "admitad")
      .eq("is_active", true);

    if (error || !data || data.length === 0) {
      if (error && !error.message.includes("admitted_network")) {
        console.warn("[admitted-network] registry lookup failed:", error.message);
      }
      return manifestRegistry;
    }

    const rows = data as Array<{
      name: string;
      slug: string;
      admitted_campaign_id: string | null;
      logo_url: string | null;
      website: string;
    }>;

    return {
      names: new Set(rows.map((row) => normalizeMerchantName(row.name)).filter(Boolean)),
      programs: rows.map((row) => ({
        id: row.admitted_campaign_id ?? row.slug,
        name: row.name,
        slug: row.slug,
        siteUrl: row.website,
        logoUrl: row.logo_url,
      })),
      source: "database" as const,
    };
  })()
    .then((value) => {
      cached = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export async function isAdmittedMerchantName(name: string | null | undefined): Promise<boolean> {
  if (!name) return false;
  const { names } = await getAdmittedMerchantRegistry();
  return names.has(normalizeMerchantName(name));
}

export function offerBelongsToAdmittedMerchant(
  offer: NormalizedCatalogItem["offers"][number],
  names: Set<string>,
): boolean {
  if (resolveMarketplaceId(offer.providerId) !== "admitad") return false;
  return names.has(normalizeMerchantName(offer.storeName));
}

/**
 * Strict view filter: only Admitad offers from the 82 approved merchants.
 * An item that has no approved offer is dropped entirely. Non-Admitad offers
 * are removed even when they are attached to an otherwise approved item.
 */
export async function filterAdmittedCatalogItems(
  items: readonly NormalizedCatalogItem[],
): Promise<NormalizedCatalogItem[]> {
  const { names } = await getAdmittedMerchantRegistry();
  if (names.size === 0) return [];

  const filtered: NormalizedCatalogItem[] = [];
  for (const item of items) {
    const offers = item.offers.filter((offer) =>
      offerBelongsToAdmittedMerchant(offer, names),
    );
    if (offers.length === 0) continue;

    const providerIds = item.providerIds.filter(
      (providerId) => resolveMarketplaceId(providerId) === "admitad",
    );
    filtered.push({
      ...item,
      offers,
      providerIds: providerIds.length > 0 ? providerIds : [offers[0].providerId],
    });
  }

  return filtered;
}

export function getAdmittedManifestPrograms(): ManifestProgram[] {
  return admittedManifest.programs;
}
