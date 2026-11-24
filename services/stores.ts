import { mapStore } from "@/lib/database/mappers";
import type { StoreRow } from "@/lib/database/types";
import {
  isAdmittedMerchantName,
  isBlendedStoreSlug,
} from "@/lib/integration/admitted-network";
import {
  PRODUCTION_PROVIDER_IDS,
  type ProductionProviderId,
} from "@/lib/integration/constants";
import { getConfiguredProductionProviders } from "@/lib/integration/provider-config";
import {
  getRealMerchantStores,
  isRealDataStore,
} from "@/lib/integration/real-stores";
import { getProviderConfig, getProviderStoreMeta } from "@/lib/providers/registry";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { Store, ServiceResult } from "@/lib/types/entities";

const PROVIDER_STORE_SLUGS = new Set<string>(PRODUCTION_PROVIDER_IDS);
const PROVIDER_INTEGRATION_TYPES = new Set([
  "amazon",
  "amazon-eg",
  "aliexpress",
  "cjdropshipping",
  "ebay",
  "temu",
  "shopify",
  "noon",
  "walmart",
  "bestbuy",
  "jumia",
  "custom",
  "partner",
]);
const STORE_SELECT =
  "id, name, name_ar, slug, logo_url, logo_initial, website, integration_type, affiliate_program, commission_rate, supported_regions, supported_currencies, external_store_id, admitted_network, admitted_campaign_id, is_active";
const MAX_STORE_LIMIT = 100;

function providerStoreFromId(providerId: ProductionProviderId): Store | null {
  const meta = getProviderStoreMeta(providerId);
  if (!meta) return null;
  return {
    id: meta.id,
    name: meta.name,
    slug: meta.slug,
    website: meta.website,
    logoInitial: meta.logoInitial,
    integrationType: PROVIDER_INTEGRATION_TYPES.has(providerId)
      ? (providerId as Store["integrationType"])
      : "custom",
    commissionRate: 0,
    supportedRegions: ["EG"],
    supportedCurrencies: ["EGP"],
    isActive: true,
  };
}

function configuredProviderStores(): Store[] {
  const registryStores = PRODUCTION_PROVIDER_IDS.filter((id) => {
    const status = getProviderConfig(id)?.status;
    return status === "active" || status === "configured";
  })
    .map(providerStoreFromId)
    .filter((store): store is Store => store !== null);
  const credentialStores = getConfiguredProductionProviders()
    .map(providerStoreFromId)
    .filter((store): store is Store => store !== null);
  return [...new Map([...registryStores, ...credentialStores].map((store) => [store.slug, store])).values()];
}

async function loadMerchantStores(): Promise<Store[]> {
  try {
    return await getRealMerchantStores();
  } catch {
    return [];
  }
}

function isProviderStoreSlug(slug: string): boolean {
  return PROVIDER_STORE_SLUGS.has(slug);
}

export async function getStores(options?: {
  integrationType?: StoreRow["integration_type"];
  region?: string;
  limit?: number;
}): Promise<ServiceResult<Store[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: configuredProviderStores(), error: "Supabase not configured" };
  }

  const limit = Math.min(Math.max(options?.limit ?? MAX_STORE_LIMIT, 1), MAX_STORE_LIMIT);

  const { data, error } = await supabase
    .from("stores")
    .select(STORE_SELECT)
    .eq("is_active", true)
    .order("name")
    .limit(limit);

  if (error) {
    return { data: configuredProviderStores(), error: error.message };
  }

  const rows = ((data as unknown as StoreRow[] | null) ?? []).filter((row) => {
    const isProvider = isProviderStoreSlug(row.slug);
    const isAdmitad = row.admitted_network === "admitad" || row.slug.startsWith("admitad-");
    return isProvider || isAdmitad || isBlendedStoreSlug(row.slug);
  });

  const dbStores = rows.map(mapStore);
  const dbSlugs = new Set(dbStores.map((store) => store.slug));
  const synthesized = configuredProviderStores().filter((store) => !dbSlugs.has(store.slug));
  const stores = [...dbStores, ...synthesized];
  const region = options?.region;
  const filtered = stores.filter((store) => {
    if (options?.integrationType && store.integrationType !== options.integrationType) {
      return false;
    }
    if (region && store.supportedRegions.length && !store.supportedRegions.includes(region)) {
      return false;
    }
    return true;
  });
  return { data: filtered.slice(0, limit), error: null };
}

export async function getStoreBySlug(slug: string): Promise<ServiceResult<Store | null>> {
  const supabase = createSupabaseAnonClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("stores")
      .select(STORE_SELECT)
      .eq("slug", slug)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    const row = data as unknown as StoreRow | null;
    if (row) {
      if (isBlendedStoreSlug(row.slug) || isProviderStoreSlug(row.slug)) {
        return { data: mapStore(row), error: null };
      }
      if (row.admitted_network === "admitad" || row.slug.startsWith("admitad-")) {
        if (await isRealDataStore(row)) {
          return { data: mapStore(row), error: null };
        }
      } else if (await isRealDataStore(row)) {
        return { data: mapStore(row), error: null };
      }
    }
  }

  if (slug.startsWith("admitad-")) {
    const merchants = await loadMerchantStores();
    const found = merchants.find((m) => m.slug === slug) ?? null;
    if (!found) return { data: null, error: "Store not found" };
    const admitted = await isAdmittedMerchantName(found.name);
    return {
      data: admitted ? found : null,
      error: admitted ? null : "Store not found",
    };
  }

  const providerStore = configuredProviderStores().find((store) => store.slug === slug);
  if (providerStore) {
    return { data: providerStore, error: null };
  }

  if (PROVIDER_STORE_SLUGS.has(slug)) {
    return { data: null, error: "Store not found" };
  }

  return { data: null, error: "Store not found" };
}

export async function getStoreById(id: string): Promise<ServiceResult<Store | null>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return { data: null, error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("stores")
    .select(STORE_SELECT)
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data ? mapStore(data) : null, error: null };
}