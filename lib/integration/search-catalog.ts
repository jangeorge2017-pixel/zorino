import type { SearchResultItem } from "@/lib/data/homepage";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { ProductionProviderId } from "@/lib/integration/constants";
import { getProviderStoreMeta } from "@/lib/integration/provider-context";
import { normalizeProductImageUrl } from "@/lib/images/product-image";

/** Curated queries that feed homepage widgets from the same search engine as /search. */
export const HOMEPAGE_SEARCH_QUERIES = [
  "iphone",
  "samsung",
  "laptop",
  "monitor",
  "earbuds",
  "keyboard",
  "smartwatch",
  "camera",
] as const;

function providerFromStoreSlug(storeSlug: string): ProductionProviderId {
  const slug = storeSlug.trim().toLowerCase();
  if (slug === "ebay") return "ebay";
  if (slug === "amazon") return "amazon";
  if (slug === "walmart") return "walmart";
  if (slug === "temu") return "temu";
  return "aliexpress";
}

/** Map a search-engine card into the homepage catalog schema (keeps affiliate URL). */
export function searchResultToCatalogItem(item: SearchResultItem): NormalizedCatalogItem {
  const providerId = providerFromStoreSlug(item.storeSlug || item.store);
  const meta = getProviderStoreMeta(providerId);
  const externalId = item.id.replace(new RegExp(`^${providerId}-`), "");
  const productUrl = item.affiliateUrl || "";

  return {
    id: item.id,
    slug: externalId || item.id,
    title: item.name,
    imageUrl: normalizeProductImageUrl(item.imageSrc),
    emoji: item.emoji || "🛍️",
    categorySlug: (item.category || "electronics").toLowerCase().replace(/\s+/g, "-"),
    rating: item.rating,
    reviewCount: item.reviewCount,
    countryCode: "US",
    currency: "USD",
    price: item.price,
    originalPrice: item.originalPrice,
    discount: item.discount,
    discountType: "percentage",
    offers: [
      {
        providerId,
        storeSlug: meta.storeSlug,
        storeName: meta.name,
        externalId: externalId || item.id,
        price: item.price,
        originalPrice: item.originalPrice,
        currency: "USD",
        countryCode: "US",
        productUrl,
        affiliateUrl: item.affiliateUrl,
        inStock: item.inStock,
      },
    ],
    providerIds: [providerId],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Homepage / deals catalog sourced from the production search engine
 * (same connectors, ranking, fair mix, and affiliate URLs as /search).
 */
export async function fetchCatalogFromSearchEngine(): Promise<NormalizedCatalogItem[]> {
  const { searchProducts } = await import("@/lib/search/engine");
  const perQuery = 12;

  const batches = await Promise.all(
    HOMEPAGE_SEARCH_QUERIES.map(async (query) => {
      try {
        return await searchProducts(query, perQuery);
      } catch (error) {
        console.error(
          "[search-catalog]",
          query,
          error instanceof Error ? error.message : "search failed",
        );
        return [] as SearchResultItem[];
      }
    }),
  );

  const seen = new Set<string>();
  const items: NormalizedCatalogItem[] = [];

  for (const batch of batches) {
    for (const row of batch) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      items.push(searchResultToCatalogItem(row));
    }
  }

  return items;
}
