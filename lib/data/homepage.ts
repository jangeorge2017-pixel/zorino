import { unstable_cache } from "next/cache";
import { getCategories } from "@/services/categories";
import { getTopCoupons as fetchTopCoupons, getAllCoupons } from "@/services/coupons";
import { getCatalogStats } from "@/services/stats";
import { getStores } from "@/services/stores";
import { normalizeProductImageUrl } from "@/lib/images/product-image";
import {
  getIntegratedDeals,
  getIntegratedSectionProducts,
  getIntegratedTrendingDeals,
} from "@/lib/integration/catalog-service";
import { HOMEPAGE_LIVE_FETCH_ENABLED } from "@/lib/integration/homepage-fetch-profile";
import { ZH_POPULAR_SEARCHES } from "@/lib/zorino-home/content";
import {
  withFallbackCategories,
  withFallbackCoupons,
  withFallbackFooterStats,
  withFallbackHeroStats,
  withFallbackPopularSearches,
} from "@/lib/zorino-home/presentation";
import type {
  FloatingProductCard,
  FooterStatItem,
  HeroStatItem,
  HomepageCategoryItem,
  TopCouponCard,
  TrendingDealCard,
} from "@/lib/types/entities";

/**
 * Homepage data is global (not per-visitor), so the underlying Supabase reads
 * and the live "popular searches" call are cached in Next's Data Cache. Entries
 * are shared across requests/instances and revalidated in the background, so the
 * homepage render is no longer gated on database round-trips or a live API call.
 */
const loadCatalogStatsCached = unstable_cache(
  () => getCatalogStats(),
  ["homepage:catalog-stats"],
  { revalidate: 600, tags: ["homepage-stats"] },
);

const loadCategoriesCached = unstable_cache(
  () => getCategories(),
  ["homepage:categories"],
  { revalidate: 3600, tags: ["homepage-categories"] },
);

const loadTopCouponsCached = unstable_cache(
  (limit: number) => fetchTopCoupons(limit),
  ["homepage:top-coupons"],
  { revalidate: 600, tags: ["homepage-coupons"] },
);

const loadPopularSearchesCached = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const { searchProducts } = await import("@/lib/search/engine");
      const items = await searchProducts("electronics", 12);
      const names = items.map((item) => item.name).filter(Boolean);
      return names.slice(0, 8);
    } catch (error) {
      console.error("[homepage] popular searches fetch failed:", error);
      return [];
    }
  },
  ["homepage:popular-searches-v2"],
  { revalidate: 900, tags: ["homepage-popular-searches"] },
);
const HERO_ORBIT_POSITIONS = [
  "orbit-top",
  "orbit-upper-left",
  "orbit-upper-right",
  "orbit-lower-right",
] as const;

const CATEGORY_ACCENTS: Record<string, string | null> = {
  phones: "blue",
  laptops: "cyan",
  gaming: "purple",
  tvs: "orange",
  home: "green",
  wearables: "pink",
  fashion: "indigo",
  electronics: "yellow",
  audio: "cyan",
  beauty: "pink",
  sports: "orange",
};

function formatStatCount(count: number): string {
  if (count >= 1_000_000) return `${Math.floor(count / 1_000_000)}M+`;
  if (count >= 1_000) return `${Math.floor(count / 1_000)}K+`;
  if (count >= 10) return `${count}+`;
  return String(count);
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function couponToCard(coupon: Awaited<ReturnType<typeof fetchTopCoupons>>["data"][number]): TopCouponCard {
  const store = coupon.store;
  return {
    id: coupon.id,
    store: store?.name ?? "Store",
    storeLogoSrc: store?.logoUrl ?? `/stores/${store?.slug ?? "default"}.svg`,
    storeInitial: store?.logoInitial ?? store?.name.slice(0, 2) ?? "?",
    offer: coupon.offer,
    minSpend: coupon.minSpend ?? "No minimum",
    code: coupon.code,
    usedTimes: coupon.usedTimes,
    verified: coupon.verified,
  };
}

export type HomepageSectionProducts = {
  flash: TrendingDealCard[];
  priceDrops: TrendingDealCard[];
  newArrivals: TrendingDealCard[];
  topRated: TrendingDealCard[];
  editorsPicks: TrendingDealCard[];
};

/** Product grids below Trending Deals / Top Coupons — live multi-marketplace search. */
export async function getHomepageSectionProducts(): Promise<HomepageSectionProducts> {
  return getIntegratedSectionProducts();
}

/** Homepage trending deals — live multi-marketplace search. */
export async function getTrendingDeals(limit = 4): Promise<TrendingDealCard[]> {
  return getIntegratedTrendingDeals(limit);
}

/** Top coupons for homepage. */
export async function getTopCouponsForHomepage(limit = 4): Promise<TopCouponCard[]> {
  if (!HOMEPAGE_LIVE_FETCH_ENABLED) {
    return withFallbackCoupons([]).slice(0, limit);
  }

  const { data, error } = await loadTopCouponsCached(limit);
  if (error) return withFallbackCoupons([]).slice(0, limit);
  return data.map(couponToCard);
}
/** All active coupons (coupons listing page). */
export async function getCouponsForPage() {
  const { data, error } = await getAllCoupons();
  if (error) return [];
  return data.map(couponToCard);
}

/** Hero orbit — live marketplace products (empty slots when APIs have no data). */
export async function getHeroFloatingProducts(): Promise<FloatingProductCard[]> {
  const deals = await getTrendingDeals(4);
  const positions = HERO_ORBIT_POSITIONS;

  return positions.map((position, index) => {
    const deal = deals[index];
    if (!deal) {
      return {
        imageSrc: normalizeProductImageUrl(null),
        discount: "",
        price: "",
        original: "",
        position,
      };
    }
    return {
      imageSrc: deal.imageSrc,
      discount: deal.discount > 0 ? `-${Math.round(deal.discount)}%` : "",
      price: formatCurrency(deal.price),
      original: formatCurrency(deal.originalPrice),
      position,
    };
  });
}

/** Category grid from Supabase. */
export async function getHomepageCategories(): Promise<HomepageCategoryItem[]> {
  if (!HOMEPAGE_LIVE_FETCH_ENABLED) {
    return withFallbackCategories([]);
  }

  const { data, error } = await loadCategoriesCached();
  if (error || data.length === 0) return withFallbackCategories([]);

  return withFallbackCategories(
    data.map((category, index) => ({
      slug: category.slug,
      label: category.name,
      active: index === 2,
      accent: CATEGORY_ACCENTS[category.slug] ?? null,
    })),
  );
}
/** Popular searches — static chips on the critical path; live terms stream in. */
export function getPopularSearchesStatic(): string[] {
  return ZH_POPULAR_SEARCHES;
}

/** Popular searches — short keyword chips for the search dropdown. */
export async function getPopularSearchesLive(): Promise<string[]> {
  // Prefer curated short chips so the dropdown never overflows with product titles.
  // Marketplace enablement is unrelated to chip text — search engine still fans out dynamically.
  return ZH_POPULAR_SEARCHES;
}

/** @deprecated Use getPopularSearchesStatic + getPopularSearchesLive */
export async function getPopularSearches(): Promise<string[]> {
  return getPopularSearchesLive();
}
/** Live catalog stats for hero + footer. */
export async function getHomepageStats(): Promise<{
  hero: HeroStatItem[];
  footer: FooterStatItem[];
}> {
  if (!HOMEPAGE_LIVE_FETCH_ENABLED) {
    return {
      hero: withFallbackHeroStats([]),
      footer: withFallbackFooterStats([]),
    };
  }

  const { data, error } = await loadCatalogStatsCached();
  if (error || !data) {
    return {
      hero: withFallbackHeroStats([]),
      footer: withFallbackFooterStats([]),
    };
  }

  return {
    hero: withFallbackHeroStats([
      { key: "stores", value: formatStatCount(data.stores), label: "Stores", tone: "purple" },
      { key: "products", value: formatStatCount(data.products), label: "Products", tone: "blue" },
      { key: "coupons", value: formatStatCount(data.coupons), label: "Coupons", tone: "green" },
      { key: "tracking", value: "Real-time", label: "Price Tracking", tone: "violet" },
    ]),
    footer: withFallbackFooterStats([
      { key: "stores", value: formatStatCount(data.stores), label: "Stores" },
      { key: "products", value: formatStatCount(data.products), label: "Products" },
      { key: "coupons", value: formatStatCount(data.coupons), label: "Coupons" },
      {
        key: "users",
        value: data.users > 0 ? formatStatCount(data.users) : "0",
        label: "Happy Users",
      },
    ]),
  };
}
/** Active stores for /stores page. */
export async function getStoresForPage() {
  const { data, error } = await getStores();
  if (error) return [];
  return data;
}

/** Active categories for /categories page. */
export async function getCategoriesForPage() {
  const { data, error } = await getCategories();
  if (error) return [];
  return data;
}

/** Active deals for /deals page — live multi-marketplace search. */
export async function getDealsForPage() {
  return getIntegratedDeals(48);
}

export type SearchResultItem = {
  id: string;
  name: string;
  imageSrc: string;
  emoji: string;
  price: number;
  originalPrice: number;
  discount: number;
  store: string;
  storeSlug: string;
  rating: number;
  reviewCount: number;
  /** Sales / order volume when provided by the marketplace API. */
  salesCount?: number;
  /** Shipping / delivery summary when provided by the marketplace API. */
  shipping?: string;
  inStock: boolean;
  category: string;
  /** Outbound affiliate or product URL (live marketplace results). */
  affiliateUrl?: string;
};

/**
 * Product search for /search page — ZORINO Global Search Engine.
 * Fans out to configured providers (AliExpress, eBay, …), ranks, dedupes, compares.
 */
export async function getSearchResults(query: string): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { searchProducts } = await import("@/lib/search/engine");
  const { SEARCH_ENGINE_DEFAULTS } = await import("@/lib/search/types");
  return searchProducts(trimmed, SEARCH_ENGINE_DEFAULTS.DEFAULT_LIMIT);
}

/** Filter options for search page — AliExpress only. */
export async function getSearchFilters(results: SearchResultItem[] = []) {
  const { filtersFromSearchResults, ALIEXPRESS_SEARCH_FILTERS } = await import(
    "@/services/aliexpress/search"
  );
  if (results.length > 0) return filtersFromSearchResults(results);
  return ALIEXPRESS_SEARCH_FILTERS;
}

// Back-compat alias used by CouponSectionContainer
export { getTopCouponsForHomepage as getTopCoupons };
