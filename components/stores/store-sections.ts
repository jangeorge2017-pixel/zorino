import type { Store } from "@/lib/types/entities";

export type StoreSectionId = "featured" | "marketplaces" | "partners" | "global";

export type StoreSection = {
  id: StoreSectionId;
  stores: Store[];
};

const MARKETPLACE_TYPES = new Set([
  "amazon",
  "ebay",
  "aliexpress",
  "walmart",
  "noon",
  "jumia",
  "temu",
  "carrefour",
  "btech",
  "twob",
  "dubaiphone",
  "raneen",
  "eldokan",
  "bestbuy",
  "admitad",
  "cjdropshipping",
]);

function topStores(pool: Store[]): Store[] {
  return [...pool];
}

function isGlobalStore(store: Store): boolean {
  return (
    store.supportedRegions.includes("GLOBAL") ||
    store.supportedRegions.length >= 3
  );
}

export function buildStoreSections(stores: Store[]): StoreSection[] {
  const active = stores.filter((store) => store.isActive);

  const featured = topStores(
    [...active].sort((a, b) => b.commissionRate - a.commissionRate),
  );

  const marketplaces = topStores(
    [...active].filter((store) => MARKETPLACE_TYPES.has(store.integrationType)),
  );

  const partners = topStores(
    [...active]
      .filter((store) => store.integrationType === "partner")
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const globalStores = topStores(
    [...active]
      .filter((store) => isGlobalStore(store))
      .sort((a, b) => b.supportedRegions.length - a.supportedRegions.length),
  );

  const sections: StoreSection[] = [
    { id: "featured", stores: featured },
    { id: "marketplaces", stores: marketplaces },
    { id: "partners", stores: partners },
    { id: "global", stores: globalStores },
  ];

  return sections.filter((section) => section.stores.length > 0);
}
