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
import type {
  FloatingProductCard,
  FooterStatItem,
  HeroStatItem,
  HomepageCategoryItem,
  TopCouponCard,
  TrendingDealCard,
} from "@/lib/types/entities";

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
  more: "gray",
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
    storeLogoSrc: store?.logoUrl ?? `/stores/${store?.slug ?? "default"}.png`,
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

/** Product grids below Trending Deals / Top Coupons — live AliExpress only. */
export async function getHomepageSectionProducts(): Promise<HomepageSectionProducts> {
  return getIntegratedSectionProducts();
}

/** Homepage trending deals — live AliExpress only. */
export async function getTrendingDeals(limit = 4): Promise<TrendingDealCard[]> {
  return getIntegratedTrendingDeals(limit);
}

/** Top coupons for homepage. */
export async function getTopCouponsForHomepage(limit = 4): Promise<TopCouponCard[]> {
  const { data, error } = await fetchTopCoupons(limit);
  if (error) return [];
  return data.map(couponToCard);
}

/** All active coupons (coupons listing page). */
export async function getCouponsForPage() {
  const { data, error } = await getAllCoupons();
  if (error) return [];
  return data.map(couponToCard);
}

/** Hero orbit — live AliExpress products only (empty slots when API has no data). */
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
  const { data, error } = await getCategories();
  if (error || data.length === 0) return [];

  return [
    ...data.map((category, index) => ({
      slug: category.slug,
      label: category.name,
      active: index === 2,
      accent: CATEGORY_ACCENTS[category.slug] ?? null,
    })),
    { slug: "more", label: "More", active: false, accent: "gray" },
  ];
}

/** Popular searches from live AliExpress catalog. */
export async function getPopularSearches(): Promise<string[]> {
  const { browseAliExpressLive } = await import("@/services/aliexpress/search");
  const items = await browseAliExpressLive(6);
  return items.map((item) => item.name);
}

/** Live catalog stats for hero + footer. */
export async function getHomepageStats(): Promise<{
  hero: HeroStatItem[];
  footer: FooterStatItem[];
}> {
  const { data, error } = await getCatalogStats();
  if (error || !data) {
    return {
      hero: [
        { key: "stores", value: "0", label: "Stores", tone: "purple" },
        { key: "products", value: "0", label: "Products", tone: "blue" },
        { key: "coupons", value: "0", label: "Coupons", tone: "green" },
        { key: "tracking", value: "Real-time", label: "Price Tracking", tone: "violet" },
      ],
      footer: [
        { key: "stores", value: "0", label: "Stores" },
        { key: "products", value: "0", label: "Products" },
        { key: "coupons", value: "0", label: "Coupons" },
        { key: "users", value: "0", label: "Happy Users" },
      ],
    };
  }

  return {
    hero: [
      { key: "stores", value: formatStatCount(data.stores), label: "Stores", tone: "purple" },
      { key: "products", value: formatStatCount(data.products), label: "Products", tone: "blue" },
      { key: "coupons", value: formatStatCount(data.coupons), label: "Coupons", tone: "green" },
      { key: "tracking", value: "Real-time", label: "Price Tracking", tone: "violet" },
    ],
    footer: [
      { key: "stores", value: formatStatCount(data.stores), label: "Stores" },
      { key: "products", value: formatStatCount(data.products), label: "Products" },
      { key: "coupons", value: formatStatCount(data.coupons), label: "Coupons" },
      {
        key: "users",
        value: data.users > 0 ? formatStatCount(data.users) : "0",
        label: "Happy Users",
      },
    ],
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

/** Active deals for /deals page — live AliExpress only. */
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
  inStock: boolean;
  category: string;
  /** Outbound affiliate or product URL (live marketplace results). */
  affiliateUrl?: string;
};

/**
 * Product search for /search page — live AliExpress Affiliates API only.
 * Returns [] on API error or zero results (UI shows "No products found").
 */
export async function getSearchResults(query: string): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { searchAliExpressLive } = await import("@/services/aliexpress/search");
  return searchAliExpressLive(trimmed, 24);
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
