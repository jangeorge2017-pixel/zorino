import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { getCategories } from "@/services/categories";
import {
  getTopCoupons as fetchTopCoupons,
  getAllCoupons,
  getActiveCouponCount,
} from "@/services/coupons";
import { getStores } from "@/services/stores";
import { isValidProductDestinationUrl } from "@/lib/affiliate/product-url";
import { normalizeProductImageUrl } from "@/lib/images/product-image";
import { hasOfficialStoreLogo, resolveStoreLogoSrc } from "@/lib/assets";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import {
  getIntegratedDeals,
  getIntegratedSectionProducts,
  getIntegratedTrendingDeals,
} from "@/lib/integration/catalog-service";
import { HOMEPAGE_LIVE_FETCH_ENABLED } from "@/lib/integration/homepage-fetch-profile";
import { ZH_POPULAR_SEARCHES } from "@/lib/zorino-home/content";
import {
  couponToFeaturedBrand,
  type FeaturedCouponBrand,
} from "@/lib/zorino-home/featured-coupon-brands";
import { withFallbackCategories } from "@/lib/zorino-home/presentation";
import { INTL_COOKIE_CURRENCY } from "@/lib/international/cookies";
import { isSupportedCurrency, type CurrencyCode } from "@/lib/international/config";
import { formatCurrency as formatCurrencyValue } from "@/lib/international/format";
import type { ListingCondition, ProductCard } from "@/lib/search/types";
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
  return String(count);
}

function formatExactCount(count: number): string {
  return count.toLocaleString("en-US");
}

/** Hero orbit cards are server-formatted — honor the visitor's currency cookie. */
async function getDisplayCurrencyCode(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const cookieCurrency = cookieStore.get(INTL_COOKIE_CURRENCY)?.value;
    if (cookieCurrency && isSupportedCurrency(cookieCurrency)) return cookieCurrency;
  } catch {
    // Cookies unavailable (e.g. during static generation) — fall back to USD.
  }
  return "USD";
}

async function formatCurrency(amount: number, currencyCode?: string): Promise<string> {
  const code = currencyCode ?? (await getDisplayCurrencyCode());
  return formatCurrencyValue(amount, code);
}

function couponToCard(coupon: Awaited<ReturnType<typeof fetchTopCoupons>>["data"][number]): TopCouponCard {
  const store = coupon.store;
  const localLogoSrc = hasOfficialStoreLogo(store?.slug)
    ? resolveStoreLogoSrc(store?.slug)
    : null;
  return {
    id: coupon.id,
    store: store?.name ?? "Store",
    storeSlug: store?.slug,
    storeLogoSrc:
      localLogoSrc ?? store?.logoUrl ?? resolveStoreLogoSrc(store?.slug ?? "default"),
    storeInitial: store?.logoInitial ?? store?.name.slice(0, 2) ?? "?",
    offer: coupon.offer,
    minSpend: coupon.minSpend ?? "No minimum",
    code: coupon.code,
    usedTimes: coupon.usedTimes,
    verified: coupon.verified,
    url: coupon.affiliateUrl ?? undefined,
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
  const { data, error } = await loadTopCouponsCached(limit);
  if (error || !data) return [];
  return data.map(couponToCard);
}

/**
 * Featured coupon brands for the homepage carousel — real DB coupons only.
 * The static brand list contributes visual styling (colors/logos), never
 * offers or codes. Returns an empty array when no live coupons exist.
 */
export async function getFeaturedCouponBrandsForHomepage(
  limit = 8,
): Promise<FeaturedCouponBrand[]> {
  const coupons = await getTopCouponsForHomepage(limit);
  return coupons.map(couponToFeaturedBrand);
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
  const currencyCode = await getDisplayCurrencyCode();

  return Promise.all(
    positions.map(async (position, index) => {
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
      const dealWithUrls = deal as TrendingDealCard & {
        productUrl?: string | null;
        product_url?: string | null;
        affiliate_url?: string | null;
        url?: string | null;
      };
      const destinationUrl =
        dealWithUrls.productUrl?.trim() ||
        dealWithUrls.product_url?.trim() ||
        deal.affiliateUrl?.trim() ||
        dealWithUrls.affiliate_url?.trim() ||
        dealWithUrls.url?.trim();
      const external = Boolean(destinationUrl && isValidProductDestinationUrl(destinationUrl));
      const href = external
        ? destinationUrl || ""
        : `/search?q=${encodeURIComponent(deal.name)}`;
      return {
        imageSrc: deal.imageSrc,
        discount: deal.discount > 0 ? `-${Math.round(deal.discount)}%` : "",
        price: await formatCurrency(deal.price, currencyCode),
        original: await formatCurrency(deal.originalPrice, currencyCode),
        position,
        href,
        external,
        label: `View ${deal.name} from ${deal.store}`,
      };
    }),
  );
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
/**
 * Live catalog stats for hero + footer.
 * Reads the Supabase catalog directly, independent of which affiliate
 * credentials this deployment currently holds.
 * Stores = active Supabase store rows.
 * Products = maintained/exact real catalog size.
 * Coupons = active Supabase coupon rows.
 */
async function countActiveSupabaseRows(
  table: "stores" | "coupons",
): Promise<number | null> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  return error ? null : (count ?? 0);
}

async function loadHomepageStats(): Promise<{
  hero: HeroStatItem[];
  footer: FooterStatItem[];
}> {
  const [storeCountResult, couponCountResult, productCountResult] = await Promise.all([
    countActiveSupabaseRows("stores").catch(() => null),
    countActiveSupabaseRows("coupons").catch(() => null),
    import("@/lib/integration/database-catalog")
      .then(({ getRealCatalogProductCount }) => getRealCatalogProductCount())
      .catch(() => 0),
  ]);

  let storeCount = storeCountResult ?? 0;
  if (storeCountResult === null) {
    try {
      const { data } = await getStores();
      storeCount = data?.length ?? 0;
    } catch {
      storeCount = 0;
    }
  }

  let couponCount = couponCountResult ?? 0;
  if (couponCountResult === null) {
    try {
      couponCount = await getActiveCouponCount();
    } catch {
      couponCount = 0;
    }
  }

  return {
    hero: [
      { key: "stores", value: formatExactCount(storeCount), label: "Stores", tone: "purple" },
      { key: "products", value: formatStatCount(productCountResult), label: "Products", tone: "blue" },
      { key: "coupons", value: formatExactCount(couponCount), label: "Coupons", tone: "green" },
      { key: "tracking", value: "Real-time", label: "Price Tracking", tone: "violet" },
    ],
    footer: [
      { key: "stores", value: formatExactCount(storeCount), label: "Stores" },
      { key: "products", value: formatStatCount(productCountResult), label: "Products" },
      { key: "coupons", value: formatExactCount(couponCount), label: "Coupons" },
      { key: "users", value: "0", label: "Happy Users" },
    ],
  };
}

/** Homepage stats — cached with the catalog so the exact product/store counts
 *  aren't recomputed (and the DB isn't hit) on every homepage render. */
export const getHomepageStats = unstable_cache(
  loadHomepageStats,
  ["homepage:stats-v5"],
  {
    revalidate: 300,
    tags: ["homepage-catalog", "homepage-stats", "homepage-stores", "homepage-coupons"],
  },
);

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
  /** Real currency code for this listing (provider source). Defaults are never assumed here. */
  currency?: string;
  /** Real country code for this listing (provider source). */
  countryCode?: string;
  /** Outbound affiliate or product URL (live marketplace results). */
  affiliateUrl?: string;
  /**
   * Listing condition class ("new" | "refurbished" | "used") — used by the
   * condition-diversity guardrail and New/Refurbished grouping. Absent rows
   * (e.g. DB-imported) are classified from the title by the guardrail.
   */
  condition?: ListingCondition;
  productCard?: ProductCard;
};

/**
 * Product search for /search page — ZORINO Global Search Engine.
 * Fans out to configured providers (AliExpress, eBay, …), ranks, dedupes, compares.
 */
export async function getSearchResults(
  query: string,
  sort?: "relevance" | "price",
  activeCurrency?: CurrencyCode,
  originalQuery?: string,
): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Detect and translate Arabic/Franco-Arab queries to English for searching
  const { translateSearchQuery } = await import("@/lib/search/query-translation");
  const { translatedQuery, wasTranslated, originalQuery: translatedOriginal } =
    await translateSearchQuery(trimmed);
  const searchQuery = translatedQuery || trimmed;

  const { searchProductsSurface } = await import("@/lib/canonical/consumption/search");
  return searchProductsSurface(
    searchQuery,
    undefined,
    sort,
    activeCurrency,
    wasTranslated,
    originalQuery || translatedOriginal || trimmed,
  );
}

/** Paged search results for the /search page "Load more" flow. */
export async function getSearchResultsPage(
  query: string,
  offset: number,
  limit: number,
  sort?: "relevance" | "price",
  activeCurrency?: CurrencyCode,
  originalQuery?: string,
) {
  // Detect and translate Arabic/Franco-Arab queries to English for searching
  const { translateSearchQuery } = await import("@/lib/search/query-translation");
  const { translatedQuery, wasTranslated, originalQuery: translatedOriginal } =
    await translateSearchQuery(query.trim());
  const searchQuery = translatedQuery || query.trim();

  const { searchResultsPagedSurface } = await import("@/lib/canonical/consumption/search");
  return searchResultsPagedSurface(
    searchQuery,
    offset,
    limit,
    sort,
    activeCurrency,
    wasTranslated,
    originalQuery || translatedOriginal || query.trim(),
  );
}

/** Filter options for search page — derived from live search results across all active providers. */
export async function getSearchFilters(results: SearchResultItem[] = []) {
  const { filtersFromSearchResults } = await import("@/services/aliexpress/search");
  if (results.length > 0) return filtersFromSearchResults(results);
  // Empty fallback — no hardcoded provider list. Filters are always derived from live results.
  return { categories: [] as { value: string; label: string }[], stores: [] as { value: string; label: string }[] };
}

// Back-compat alias used by CouponSectionContainer
export { getTopCouponsForHomepage as getTopCoupons };
