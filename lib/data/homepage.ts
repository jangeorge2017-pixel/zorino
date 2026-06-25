import { getCategories } from "@/services/categories";
import { getTopCoupons as fetchTopCoupons, getAllCoupons } from "@/services/coupons";
import { getActiveDeals, getFeaturedDeals } from "@/services/deals";
import { getPriceHistory, getCurrentPricesForProduct } from "@/services/prices";
import { getProducts, searchProducts } from "@/services/products";
import { getCatalogStats } from "@/services/stats";
import { getStores } from "@/services/stores";
import type { Deal, Product, Store } from "@/lib/types/entities";
import type {
  FloatingProductCard,
  FooterStatItem,
  HeroStatItem,
  HomepageCategoryItem,
  TopCouponCard,
  TrendingDealCard,
} from "@/lib/types/entities";

const FLOATING_POSITIONS = ["card-1", "card-2", "card-3", "card-4"] as const;

const CATEGORY_ACCENTS: Record<string, string | null> = {
  phones: "pink",
  laptops: "blue",
  gaming: "green",
  tvs: null,
  home: "yellow",
  wearables: null,
  fashion: null,
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
      imageSrc: product.imageUrl,
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
    imageSrc: product?.imageUrl ?? "/products/deal-iphone.png",
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
    imageSrc: product.imageUrl,
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
    const products = await getProducts({ limit: limit * 2 });
    for (const product of products.data) {
      if (cards.length >= limit) break;
      if (usedProductIds.has(product.id)) continue;
      cards.push(await productToCard(product));
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

/** Hero floating cards from trending deals/products. */
export async function getHeroFloatingProducts(): Promise<FloatingProductCard[]> {
  const deals = await getTrendingDeals(4);
  if (deals.length === 0) return [];

  return deals.map((deal, index) => ({
    imageSrc: deal.imageSrc,
    discount: `-${Math.round(deal.discount)}%`,
    price: formatCurrency(deal.price),
    original: formatCurrency(deal.originalPrice),
    position: FLOATING_POSITIONS[index] ?? FLOATING_POSITIONS[0],
  }));
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
    { slug: "more", label: "More", active: false, accent: null },
  ];
}

/** Popular searches from product catalog. */
export async function getPopularSearches(): Promise<string[]> {
  const { data, error } = await getProducts({ limit: 6 });
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

/** Active deals for /deals page. */
export async function getDealsForPage() {
  const { data, error } = await getActiveDeals(48);
  if (error) return [];
  return data;
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
  inStock: boolean;
  category: string;
};

/** Product search for /search page. */
export async function getSearchResults(query: string): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await searchProducts(trimmed, 24);
  if (error || data.length === 0) return [];

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
      imageSrc: product.imageUrl,
      emoji: product.emoji ?? "🛍️",
      price,
      originalPrice: original || price,
      discount,
      store: lowest?.store?.name ?? "Zorino",
      storeSlug: lowest?.store?.slug ?? "",
      rating: product.rating ?? 4.5,
      reviewCount: product.reviewCount,
      inStock: product.inStock,
      category: product.categorySlug ?? "General",
    });
  }

  return results;
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
