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

/**
 * Global marketplace giants that stay visible alongside the approved Admitad
 * merchant network. These providers are real, live integrations with their own
 * product data and must never be filtered out by the Admitad allowlist.
 */
export const BLENDED_PROVIDER_IDS: ReadonlySet<string> = new Set([
  "amazon",
  "amazon-eg",
  "ebay",
  "aliexpress",
]);

/**
 * Store directory rows for the blended providers. `amazon-eg` is a marketplace
 * variant of Amazon and shares the canonical `amazon` storefront identity.
 */
export const BLENDED_STORE_SLUGS: readonly string[] = [
  "aliexpress",
  "ebay",
  "amazon",
];

const BLENDED_STORE_SLUG_SET: ReadonlySet<string> = new Set(BLENDED_STORE_SLUGS);

/** Whether a raw provider id resolves to one of the blended giants. */
export function isBlendedProviderId(providerId: string | null | undefined): boolean {
  return BLENDED_PROVIDER_IDS.has(resolveMarketplaceId(providerId));
}

/** Whether a store slug belongs to one of the blended giants. */
export function isBlendedStoreSlug(slug: string | null | undefined): boolean {
  return Boolean(slug && BLENDED_STORE_SLUG_SET.has(slug.trim().toLowerCase()));
}

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

/** An offer is allowed when it is an approved Admitad merchant or a blended giant. */
export function isAllowedCatalogOffer(
  offer: NormalizedCatalogItem["offers"][number],
  names: Set<string>,
): boolean {
  return isBlendedProviderId(offer.providerId) || offerBelongsToAdmittedMerchant(offer, names);
}

/**
 * Blended view filter: the 82 approved Admitad merchants plus Amazon, eBay,
 * and AliExpress. Offers from other/unapproved sources are removed; an item
 * with no allowed offer is dropped entirely.
 */
export async function filterAdmittedCatalogItems(
  items: readonly NormalizedCatalogItem[],
): Promise<NormalizedCatalogItem[]> {
  const { names } = await getAdmittedMerchantRegistry();

  const filtered: NormalizedCatalogItem[] = [];
  for (const item of items) {
    const offers = item.offers.filter((offer) => isAllowedCatalogOffer(offer, names));
    if (offers.length === 0) continue;

    const providerIds = item.providerIds.filter((providerId) => {
      const resolved = resolveMarketplaceId(providerId);
      return resolved === "admitad" || BLENDED_PROVIDER_IDS.has(resolved);
    });
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
