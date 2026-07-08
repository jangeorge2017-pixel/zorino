import { unstable_cache } from "next/cache";
import { cache as reactCache } from "react";
import type { HomepageSectionProducts } from "@/lib/data/homepage";
import { fetchMergedCatalog } from "@/lib/integration/comparison-engine";
import {
  catalogItemToDeal,
  catalogItemToTrendingDealCard,
} from "@/lib/integration/normalize";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { Deal, TrendingDealCard } from "@/lib/types/entities";

/** How long a merged live-catalog snapshot stays fresh (seconds). */
const CATALOG_REVALIDATE_SECONDS = 5 * 60;

/**
 * Persist the expensive multi-provider live fetch in Next's Data Cache so it is
 * shared across requests and serverless instances (the previous in-memory cache
 * was lost on every cold start). Time-based revalidation serves the cached
 * snapshot instantly while refreshing in the background, so no visitor waits on
 * the live marketplace APIs.
 */
const loadMergedCatalogItems = unstable_cache(
  async (): Promise<NormalizedCatalogItem[]> => {
    const { items } = await fetchMergedCatalog();
    return items;
  },
  ["homepage:merged-catalog"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["homepage-catalog"] },
);

/**
 * Deduplicate the catalog read within a single render pass so the trending
 * deals, hero artwork, product sections and /deals grid all share one lookup.
 */
const getCatalogItems = reactCache(async (): Promise<NormalizedCatalogItem[]> => {
  const { isAnyProductionProviderConfigured } = await import(
    "@/lib/integration/comparison-engine"
  );
  if (!isAnyProductionProviderConfigured()) return [];

  return loadMergedCatalogItems();
});

function uniqueCards(cards: TrendingDealCard[]): TrendingDealCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = String(card.productId ?? card.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function prefixCards(cards: TrendingDealCard[], prefix: string): TrendingDealCard[] {
  return cards.map((card) => ({ ...card, id: `${prefix}-${card.id}` }));
}

const SECTION_LIMIT = 4;

function itemsToCards(items: NormalizedCatalogItem[]): TrendingDealCard[] {
  return items.map((item) => catalogItemToTrendingDealCard(item));
}

/** Live trending deals from configured AliExpress/eBay providers. */
export async function getIntegratedTrendingDeals(limit = 8): Promise<TrendingDealCard[]> {
  const items = await getCatalogItems();
  if (items.length === 0) return [];

  const byDiscount = [...items].sort((a, b) => b.discount - a.discount);
  return itemsToCards(byDiscount).slice(0, limit);
}

/** Live deals for /deals page from integrated providers. */
export async function getIntegratedDeals(limit = 48): Promise<Deal[]> {
  const items = await getCatalogItems();
  if (items.length === 0) return [];

  const sorted = [...items].sort(
    (a, b) => b.discount - a.discount || b.reviewCount - a.reviewCount,
  );
  return sorted.slice(0, limit).map((item, index) => catalogItemToDeal(item, index));
}

/** Live homepage section buckets from integrated catalog. */
export async function getIntegratedSectionProducts(): Promise<HomepageSectionProducts> {
  const items = await getCatalogItems();
  if (items.length === 0) {
    return {
      flash: [],
      priceDrops: [],
      newArrivals: [],
      topRated: [],
      editorsPicks: [],
    };
  }

  const cards = uniqueCards(itemsToCards(items));
  const byDiscount = [...cards].sort((a, b) => b.discount - a.discount);
  const priceDrops = cards
    .filter((card) => card.originalPrice > card.price)
    .sort((a, b) => b.discount - a.discount);
  const byRating = [...cards].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  const byRecent = [...cards].sort((a, b) => a.updatedMins - b.updatedMins);

  return {
    flash: prefixCards(byDiscount.slice(0, SECTION_LIMIT), "flash"),
    priceDrops: prefixCards(
      (priceDrops.length > 0 ? priceDrops : byDiscount).slice(0, SECTION_LIMIT),
      "drop",
    ),
    newArrivals: prefixCards(byRecent.slice(0, SECTION_LIMIT), "new"),
    topRated: prefixCards(byRating.slice(0, SECTION_LIMIT), "rated"),
    editorsPicks: prefixCards(
      byRating.slice(SECTION_LIMIT, SECTION_LIMIT * 2).length > 0
        ? byRating.slice(SECTION_LIMIT, SECTION_LIMIT * 2)
        : cards.slice(0, SECTION_LIMIT),
      "pick",
    ),
  };
}

export {
  isAnyProductionProviderConfigured,
  getConfiguredProductionProvidersList as getConfiguredProductionProviders,
} from "@/lib/integration/comparison-engine";
