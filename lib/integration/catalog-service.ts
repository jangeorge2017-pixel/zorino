import { unstable_cache } from "next/cache";
import { cache as reactCache } from "react";
import type { HomepageSectionProducts } from "@/lib/data/homepage";
import { fetchMergedCatalog } from "@/lib/integration/comparison-engine";
import { HOMEPAGE_LIVE_FETCH_ENABLED } from "@/lib/integration/homepage-fetch-profile";
import {
  catalogItemToDeal,
  catalogItemToTrendingDealCard,
} from "@/lib/integration/normalize";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import { balanceFlatMarketplaceList } from "@/lib/search/marketplace-balance";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";
import type { Deal, TrendingDealCard } from "@/lib/types/entities";

/** How long a merged live-catalog snapshot stays fresh (seconds). */
const CATALOG_REVALIDATE_SECONDS = 5 * 60;

/** Normalise a product title for deduplication across live search and database. */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join(" ")
    .trim();
}

function isDuplicate(a: NormalizedCatalogItem, b: NormalizedCatalogItem): boolean {
  const na = normalizeTitle(a.title);
  const nb = normalizeTitle(b.title);
  if (!na || !nb) return false;
  return na === nb;
}

const loadMergedCatalogItems = unstable_cache(
  async (): Promise<NormalizedCatalogItem[]> => {
    try {
      const { fetchCatalogFromSearchEngine } = await import(
        "@/lib/integration/search-catalog"
      );
      const { getCatalogItemsFromDatabase } = await import(
        "@/lib/integration/database-catalog"
      );
      const { getIngestedCatalogItems } = await import(
        "@/lib/integration/affiliate-ingestion"
      );

      const [fromSearch, fromDb, fromIngestion, admitadFeeds] = await Promise.all([
        fetchCatalogFromSearchEngine().catch(() => [] as NormalizedCatalogItem[]),
        getCatalogItemsFromDatabase().catch(() => [] as NormalizedCatalogItem[]),
        getIngestedCatalogItems().catch(() => [] as NormalizedCatalogItem[]),
        // Pre-warm Admitad feed cache so the search connector activates
        Promise.race([
          import("@/lib/integrations/admitad/feed-fetcher").then((m) => m.fetchAdmitadFeedProducts()),
          new Promise<{ offers: import("@/lib/integrations/admitad/types").AdmitadFeedOffer[]; feedName: string; feedSlug: string }[]>((resolve) =>
            setTimeout(() => resolve([]), 30_000),
          ),
        ])
          .then((feeds) => feeds ?? [])
          .catch(() => [] as { offers: import("@/lib/integrations/admitad/types").AdmitadFeedOffer[]; feedName: string; feedSlug: string }[]),
      ]);

      const { admitadFeedsToCatalogItems } = await import("@/lib/integrations/admitad");
      const fromAdmitad: NormalizedCatalogItem[] = admitadFeedsToCatalogItems(admitadFeeds);

      const merged = [...fromSearch];

      for (const dbItem of fromDb) {
        if (!merged.some((live) => isDuplicate(live, dbItem))) {
          merged.push(dbItem);
        }
      }

      for (const ingested of fromIngestion) {
        if (!merged.some((live) => isDuplicate(live, ingested))) {
          merged.push(ingested);
        }
      }

      for (const admitadItem of fromAdmitad) {
        if (!merged.some((live) => isDuplicate(live, admitadItem))) {
          merged.push(admitadItem);
        }
      }

      if (merged.length > 0) {
        return balanceFlatMarketplaceList(
          merged,
          (item) => item.providerIds[0] ?? item.offers[0]?.providerId ?? "unknown",
          merged.length,
        );
      }

      const { items } = await fetchMergedCatalog();
      return items;
    } catch (error) {
      console.error("[catalog] merged fetch failed:", error);
      return [];
    }
  },
  ["homepage:merged-catalog-v13-image-fix"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["homepage-catalog"] },
);

const getCatalogItems = reactCache(async (): Promise<NormalizedCatalogItem[]> => {
  if (!HOMEPAGE_LIVE_FETCH_ENABLED) return [];

  const { isAnyProductionProviderConfigured } = await import(
    "@/lib/integration/comparison-engine"
  );
  if (!isAnyProductionProviderConfigured()) {
    const { getCatalogItemsFromDatabase } = await import(
      "@/lib/integration/database-catalog"
    );
    return getCatalogItemsFromDatabase().catch(() => []);
  }

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

function providerIdFromCatalogItem(item: NormalizedCatalogItem): string {
  return resolveMarketplaceId(
    item.providerIds[0] ?? item.offers[0]?.providerId ?? item.offers[0]?.storeSlug ?? "unknown",
  );
}

function providerIdFromCard(card: TrendingDealCard): string {
  const fromId = resolveMarketplaceId(String(card.productId ?? card.id));
  if (fromId !== "unknown") return fromId;
  return resolveMarketplaceId(card.store || "unknown");
}

/** Mix catalog items fairly across whatever marketplaces are present. */
function balanceCatalogItems(
  items: NormalizedCatalogItem[],
  limit: number,
  compare?: (a: NormalizedCatalogItem, b: NormalizedCatalogItem) => number,
): NormalizedCatalogItem[] {
  return balanceFlatMarketplaceList(items, providerIdFromCatalogItem, limit, compare);
}

function balanceCards(
  cards: TrendingDealCard[],
  limit: number,
  compare?: (a: TrendingDealCard, b: TrendingDealCard) => number,
): TrendingDealCard[] {
  return balanceFlatMarketplaceList(cards, providerIdFromCard, limit, compare);
}

/** Live trending deals — multi-marketplace balanced. */
export async function getIntegratedTrendingDeals(limit = 8): Promise<TrendingDealCard[]> {
  const items = await getCatalogItems();
  if (items.length === 0) return [];

  const byDiscount = [...items].sort((a, b) => b.discount - a.discount);
  const balanced = balanceCatalogItems(byDiscount, limit, (a, b) => b.discount - a.discount);
  return itemsToCards(balanced);
}

/** Live deals for /deals page — multi-marketplace balanced. */
export async function getIntegratedDeals(limit = 48): Promise<Deal[]> {
  const items = await getCatalogItems();
  if (items.length === 0) return [];

  const sorted = [...items].sort(
    (a, b) => b.discount - a.discount || b.reviewCount - a.reviewCount,
  );
  const balanced = balanceCatalogItems(
    sorted,
    limit,
    (a, b) => b.discount - a.discount || b.reviewCount - a.reviewCount,
  );
  return balanced.map((item, index) => catalogItemToDeal(item, index));
}

/** Live homepage section buckets — each section mixes all enabled marketplaces. */
export async function getIntegratedSectionProducts(): Promise<HomepageSectionProducts> {
  const items = await getCatalogItems();
  if (items.length === 0) {
    return { flash: [], priceDrops: [], newArrivals: [], topRated: [], editorsPicks: [] };
  }
  const cards = uniqueCards(itemsToCards(items));
  const byDiscount = [...cards].sort((a, b) => b.discount - a.discount);
  const priceDrops = cards
    .filter((card) => card.originalPrice > card.price)
    .sort((a, b) => b.discount - a.discount);
  const byRating = [...cards].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  const byRecent = [...cards].sort((a, b) => a.updatedMins - b.updatedMins);

  return {
    flash: prefixCards(
      balanceCards(byDiscount, SECTION_LIMIT, (a, b) => b.discount - a.discount),
      "flash",
    ),
    priceDrops: prefixCards(
      balanceCards(
        priceDrops.length > 0 ? priceDrops : byDiscount,
        SECTION_LIMIT,
        (a, b) => b.discount - a.discount,
      ),
      "drop",
    ),
    newArrivals: prefixCards(
      balanceCards(byRecent, SECTION_LIMIT, (a, b) => a.updatedMins - b.updatedMins),
      "new",
    ),
    topRated: prefixCards(
      balanceCards(byRating, SECTION_LIMIT, (a, b) => b.rating - a.rating || b.reviews - a.reviews),
      "rated",
    ),
    editorsPicks: prefixCards(
      balanceCards(
        byRating.slice(SECTION_LIMIT).length > 0 ? byRating.slice(SECTION_LIMIT) : cards,
        SECTION_LIMIT,
        (a, b) => b.rating - a.rating || b.reviews - a.reviews,
      ),
      "pick",
    ),
  };
}

export {
  isAnyProductionProviderConfigured,
  getConfiguredProductionProvidersList as getConfiguredProductionProviders,
} from "@/lib/integration/comparison-engine";

/** Expose the merged catalog for downstream consumers (e.g. homepage stats). */
export { getCatalogItems as getMergedCatalogItems };
