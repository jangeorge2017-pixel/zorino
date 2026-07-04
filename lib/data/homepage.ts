import { getCategories } from "@/services/categories";
import { getTopCoupons as fetchTopCoupons, getAllCoupons } from "@/services/coupons";
import { getActiveDeals, getFeaturedDeals } from "@/services/deals";
import { getPriceHistory, getCurrentPricesForProduct } from "@/services/prices";
import { getProducts, searchProducts } from "@/services/products";
import { getCatalogStats } from "@/services/stats";
import { getStores } from "@/services/stores";
import { normalizeProductImageUrl } from "@/lib/images/product-image";
import {
  getIntegratedDeals,
  getIntegratedSectionProducts,
  getIntegratedTrendingDeals,
} from "@/lib/integration/catalog-service";
import type { Deal, Product, Store } from "@/lib/types/entities";
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

const FLOATING_POSITIONS = HERO_ORBIT_POSITIONS;

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

function minutesSince(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.max(1, Math.round(diff / 60_000));
}

function formatStatCount(count: number): string {
  if (count >= 1_000_000) return `${Math.floor(count / 1_000_000)}M+`;
  if (count >= 1_000) return `${Math.floor(count / 1_000)}K+`;
  if (count >= 10) return `${count}+`;
  return String(count);
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

async function dealToCard(deal: Deal): Promise<TrendingDealCard | null> {
  const product = deal.product;
  const store = deal.store;

  if (product && store) {
    const historyResult = await getPriceHistory(product.id, { limit: 5 });
    const priceHistory =
      historyResult.data.length > 0
        ? historyResult.data.map((p) => p.price)
        : [deal.originalPrice, deal.price];

    return {
      id: deal.id,
      productId: deal.productId ?? product.id,
      name: product.name,
      imageSrc: normalizeProductImageUrl(product.imageUrl),
      emoji: product.emoji ?? "🛍️",
      discount: Number(deal.discount),
      rating: product.rating ?? 4.5,
      reviews: product.reviewCount,
      price: deal.price,
      originalPrice: deal.originalPrice,
      store: store.name,
      storeLogoSrc: store.logoUrl ?? `/stores/${store.slug}.png`,
      storeInitial: store.logoInitial ?? store.name.slice(0, 2),
      updatedMins: minutesSince(deal.startsAt),
      priceHistory,
    };
  }

  return {
    id: deal.id,
    name: deal.title,
    imageSrc: normalizeProductImageUrl(product?.imageUrl),
    emoji: product?.emoji ?? "🛍️",
    discount: Number(deal.discount),
    rating: product?.rating ?? 4.5,
    reviews: product?.reviewCount ?? 0,
    price: deal.price,
    originalPrice: deal.originalPrice,
    store: store?.name ?? "Store",
    storeLogoSrc: store?.logoUrl ?? `/stores/${store?.slug ?? "default"}.png`,
    storeInitial: store?.logoInitial ?? store?.name.slice(0, 2) ?? "?",
    updatedMins: minutesSince(deal.startsAt),
    priceHistory: [deal.originalPrice, deal.price],
  };
}

async function productToCard(product: Product, store?: Store): Promise<TrendingDealCard> {
  const prices = await getCurrentPricesForProduct(product.id);
  const lowest = prices.data[0];
  const price = lowest?.price ?? 0;
  const original = lowest?.originalPrice ?? price;
  const discount =
    original > 0 ? Math.max(0, Math.round(((original - price) / original) * 100)) : 0;

  return {
    id: product.id,
    productId: product.id,
    name: product.name,
    imageSrc: normalizeProductImageUrl(product.imageUrl),
    emoji: product.emoji ?? "🛍️",
    discount,
    rating: product.rating ?? 4.5,
    reviews: product.reviewCount,
    price,
    originalPrice: original || price,
    store: store?.name ?? lowest?.store?.name ?? "Zorino",
    storeLogoSrc:
      store?.logoUrl ??
      lowest?.store?.logoUrl ??
      `/stores/${store?.slug ?? lowest?.store?.slug ?? "default"}.png`,
    storeInitial:
      store?.logoInitial ??
      lowest?.store?.logoInitial ??
      store?.name.slice(0, 2) ??
      "?",
    updatedMins: 5,
    priceHistory: original > price ? [original, price] : [price],
  };
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

const SECTION_LIMIT = 4;

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
  return cards.map((card) => ({
    ...card,
    id: `${prefix}-${card.id}`,
  }));
}

function mergeSectionProducts(
  primary: HomepageSectionProducts,
  fallback: HomepageSectionProducts,
): HomepageSectionProducts {
  return {
    flash: primary.flash.length > 0 ? primary.flash : fallback.flash,
    priceDrops: primary.priceDrops.length > 0 ? primary.priceDrops : fallback.priceDrops,
    newArrivals: primary.newArrivals.length > 0 ? primary.newArrivals : fallback.newArrivals,
    topRated: primary.topRated.length > 0 ? primary.topRated : fallback.topRated,
    editorsPicks: primary.editorsPicks.length > 0 ? primary.editorsPicks : fallback.editorsPicks,
  };
}

/** Product grids below Trending Deals / Top Coupons on the homepage. */
export async function getHomepageSectionProducts(): Promise<HomepageSectionProducts> {
  const pool: TrendingDealCard[] = [];
  const usedProductIds = new Set<string>();

  const featured = await getFeaturedDeals(SECTION_LIMIT * 6);
  for (const deal of featured.data) {
    const card = await dealToCard(deal);
    if (!card) continue;
    const key = String(card.productId ?? card.id);
    if (usedProductIds.has(key)) continue;
    pool.push(card);
    if (deal.productId) usedProductIds.add(deal.productId);
  }

  if (pool.length < SECTION_LIMIT * 5) {
    const active = await getActiveDeals(SECTION_LIMIT * 8);
    for (const deal of active.data) {
      if (pool.length >= SECTION_LIMIT * 6) break;
      const card = await dealToCard(deal);
      if (!card) continue;
      const key = String(card.productId ?? card.id);
      if (usedProductIds.has(key)) continue;
      pool.push(card);
      if (deal.productId) usedProductIds.add(deal.productId);
    }
  }

  if (pool.length < SECTION_LIMIT * 5) {
    const products = await getProducts({ limit: SECTION_LIMIT * 8, importedOnly: true });
    for (const product of products.data) {
      if (pool.length >= SECTION_LIMIT * 6) break;
      if (usedProductIds.has(product.id)) continue;
      pool.push(await productToCard(product));
      usedProductIds.add(product.id);
    }
  }

  const cards = uniqueCards(pool);
  const byDiscount = [...cards].sort((a, b) => b.discount - a.discount);
  const priceDrops = cards
    .filter((card) => card.originalPrice > card.price)
    .sort((a, b) => b.discount - a.discount);
  const byRating = [...cards].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  const byRecent = [...cards].sort((a, b) => a.updatedMins - b.updatedMins);

  const fromDb = {
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

  if (cards.length >= SECTION_LIMIT * 3) {
    return fromDb;
  }

  const integrated = await getIntegratedSectionProducts();
  return mergeSectionProducts(fromDb, integrated);
}

/** Homepage trending deals — active deals first, then active products. */
export async function getTrendingDeals(limit = 4): Promise<TrendingDealCard[]> {
  const cards: TrendingDealCard[] = [];
  const usedProductIds = new Set<string>();

  const featured = await getFeaturedDeals(limit);
  for (const deal of featured.data) {
    const card = await dealToCard(deal);
    if (card) {
      cards.push(card);
      if (deal.productId) usedProductIds.add(deal.productId);
    }
  }

  if (cards.length < limit) {
    const active = await getActiveDeals(limit * 2);
    for (const deal of active.data) {
      if (cards.length >= limit) break;
      if (cards.some((c) => c.id === deal.id)) continue;
      const card = await dealToCard(deal);
      if (card) {
        cards.push(card);
        if (deal.productId) usedProductIds.add(deal.productId);
      }
    }
  }

  if (cards.length < limit) {
    const products = await getProducts({ limit: limit * 2, importedOnly: true });
    for (const product of products.data) {
      if (cards.length >= limit) break;
      if (usedProductIds.has(product.id)) continue;
      cards.push(await productToCard(product));
    }
  }

  if (cards.length < limit) {
    const integrated = await getIntegratedTrendingDeals(limit);
    for (const card of integrated) {
      if (cards.length >= limit) break;
      const key = String(card.productId ?? card.id);
      if (usedProductIds.has(key) || cards.some((c) => c.id === card.id)) continue;
      cards.push(card);
    }
  }

  return cards.slice(0, limit);
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

/** Hero orbit — five circular product cards in the upper half around the Z logo. */
export async function getHeroFloatingProducts(): Promise<FloatingProductCard[]> {
  const deals = await getTrendingDeals(4);
  const positions = HERO_ORBIT_POSITIONS;

  if (deals.length === 0) {
    return positions.map((position) => ({
      imageSrc: normalizeProductImageUrl(null),
      discount: "",
      price: "",
      original: "",
      position,
    }));
  }

  return positions.map((position, index) => {
    const deal = deals[index % deals.length];
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

/** Popular searches from product catalog. */
export async function getPopularSearches(): Promise<string[]> {
  const { data, error } = await getProducts({ limit: 6, importedOnly: true });
  if (error || data.length === 0) return [];
  return data.map((product) => product.name);
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

/** Active deals for /deals page — Supabase first, then live AliExpress/eBay. */
export async function getDealsForPage() {
  const { data, error } = await getActiveDeals(48);
  if (!error && data.length > 0) return data;
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

/** Product search for /search page — live AliExpress first, then catalog, then mock. */
export async function getSearchResults(query: string): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { searchAliExpressLive } = await import("@/services/aliexpress/search");
  const live = await searchAliExpressLive(trimmed, 24);
  if (live.length > 0) return live;

  const { data, error } = await searchProducts(trimmed, 24, { importedOnly: true });
  if (!error && data.length > 0) {
    const results: SearchResultItem[] = [];
    for (const product of data) {
      const prices = await getCurrentPricesForProduct(product.id);
      const lowest = prices.data[0];
      const price = lowest?.price ?? 0;
      const original = lowest?.originalPrice ?? price;
      const discount =
        original > 0 ? Math.max(0, Math.round(((original - price) / original) * 100)) : 0;

      results.push({
        id: product.id,
        name: product.name,
        imageSrc: normalizeProductImageUrl(product.imageUrl),
        emoji: product.emoji ?? "🛍️",
        price,
        originalPrice: original || price,
        discount,
        store: lowest?.store?.name ?? "Zorino",
        storeSlug: lowest?.store?.slug ?? "",
        rating: product.rating ?? 4.5,
        reviewCount: product.reviewCount,
        salesCount: product.reviewCount,
        inStock: product.inStock,
        category: product.categorySlug ?? "General",
      });
    }
    return results;
  }

  const { getMockSearchResults } = await import("@/lib/mock/page-data");
  return getMockSearchResults(trimmed);
}

/** Filter options for search page. */
export async function getSearchFilters() {
  const [categoriesResult, storesResult] = await Promise.all([getCategories(), getStores()]);
  return {
    categories: categoriesResult.data.map((c) => ({ value: c.slug, label: c.name })),
    stores: storesResult.data.map((s) => ({ value: s.slug, label: s.name })),
  };
}

// Back-compat alias used by CouponSectionContainer
export { getTopCouponsForHomepage as getTopCoupons };
