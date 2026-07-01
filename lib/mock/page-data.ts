import type { ProductDetail } from "@/lib/data/product-detail";
import type { CompareProductResult } from "@/services/compare";
import type { SearchResultItem } from "@/lib/data/homepage";
import type { Deal, Coupon, Store, Category } from "@/lib/types/entities";
import type { TopCouponCard } from "@/lib/types/entities";
import type { MockBlogPost, MockCategoryDetail, MockStoreDetail, MockWishlistItem } from "@/lib/mock/types";
import { sortCategoriesForCountry } from "@/lib/international/categories";
import { filterStoresByCountry } from "@/lib/international/stores";
import type { CountryCode } from "@/lib/international/config";
import {
  MOCK_BLOG_POSTS,
  MOCK_CATEGORIES,
  MOCK_COUPONS,
  MOCK_DEALS,
  MOCK_PRODUCTS,
  MOCK_SEARCH_ITEMS,
  MOCK_STORES,
  MOCK_WISHLIST_ITEMS,
  getBlogPostBySlug,
  getCategoryBySlug,
  getProductById,
  getProductsByCategory,
  getProductsByStore,
  getStoreBySlug,
  searchMockProducts,
} from "@/lib/mock/sample-data";

function buildCompareResult(productId: string): CompareProductResult | null {
  const product = getProductById(productId);
  if (!product) return null;

  const searchItem = MOCK_SEARCH_ITEMS.find((i) => i.id === productId);
  const basePrice = searchItem?.price ?? 99;
  const baseOriginal = searchItem?.originalPrice ?? basePrice;

  const offerConfigs = [
    { storeSlug: "amazon", price: basePrice, original: baseOriginal },
    { storeSlug: "best-buy", price: basePrice + 30, original: baseOriginal + 40 },
    { storeSlug: "walmart", price: basePrice + 15, original: baseOriginal + 20 },
    { storeSlug: "ebay", price: basePrice - 10, original: baseOriginal },
  ];

  const offers = offerConfigs
    .map((cfg, index) => {
      const store = getStoreBySlug(cfg.storeSlug);
      if (!store) return null;
      const discountPercent =
        cfg.original > cfg.price
          ? Math.round(((cfg.original - cfg.price) / cfg.original) * 10000) / 100
          : 0;
      return {
        id: `price-${productId}-${index}`,
        productId: product.id,
        storeId: store.id,
        price: cfg.price,
        originalPrice: cfg.original,
        currency: "USD",
        countryCode: "US",
        inStock: true,
        isCurrent: true,
        recordedAt: new Date().toISOString(),
        store,
        provider: store.integrationType,
        discountPercent,
        isLowest: cfg.price === Math.min(...offerConfigs.map((o) => o.price)),
        isHighestDiscount: discountPercent === Math.max(...offerConfigs.map((o) =>
          o.original > o.price ? ((o.original - o.price) / o.original) * 100 : 0
        )),
      };
    })
    .filter(Boolean) as CompareProductResult["offers"];

  const lowest = Math.min(...offers.map((o) => o.price));
  const highest = Math.max(...offers.map((o) => o.price));
  const cheapest = offers.find((o) => o.price === lowest);
  const bestDiscount = offers.reduce((best, o) => (o.discountPercent > best.discountPercent ? o : best), offers[0]);

  return {
    product,
    offers,
    lowestPrice: lowest,
    highestPrice: highest,
    highestDiscount: bestDiscount?.discountPercent ?? 0,
    savingsVsHighest: highest - lowest,
    savingsPercent: highest > 0 ? Math.round(((highest - lowest) / highest) * 100) : 0,
    providerCount: offers.length,
    cheapestStoreName: cheapest?.store?.name ?? "Store",
    highestDiscountStoreName: bestDiscount?.store?.name ?? "Store",
  };
}

export function getMockDealsForPage(): Deal[] {
  return MOCK_DEALS;
}

export function getMockCouponsForPage(): TopCouponCard[] {
  return MOCK_COUPONS.map((coupon) => ({
    id: coupon.id,
    store: coupon.store?.name ?? "Store",
    storeLogoSrc: coupon.store?.logoUrl ?? `/stores/${coupon.store?.slug ?? "default"}.png`,
    storeInitial: coupon.store?.logoInitial ?? coupon.store?.name.slice(0, 2) ?? "?",
    offer: coupon.offer,
    minSpend: coupon.minSpend ?? "No minimum",
    code: coupon.code,
    usedTimes: coupon.usedTimes,
    verified: coupon.verified,
  }));
}

export function getMockStoresForPage(countryCode?: CountryCode): Store[] {
  if (!countryCode) return MOCK_STORES;
  return filterStoresByCountry(MOCK_STORES, countryCode);
}

export function getMockCategoriesForPage(countryCode?: CountryCode): Category[] {
  if (!countryCode) return MOCK_CATEGORIES;
  return sortCategoriesForCountry(MOCK_CATEGORIES, countryCode);
}

export function getMockComparePageProducts(limit = 6): CompareProductResult[] {
  return MOCK_PRODUCTS.slice(0, limit)
    .map((p) => buildCompareResult(p.id))
    .filter((r): r is CompareProductResult => r !== null);
}

export function getMockSearchResults(query: string): SearchResultItem[] {
  return searchMockProducts(query);
}

export function getMockSearchFilters() {
  return {
    categories: MOCK_CATEGORIES.map((c) => ({ value: c.slug, label: c.name })),
    stores: MOCK_STORES.map((s) => ({ value: s.slug, label: s.name })),
  };
}

export function getMockProductDetail(id: string): ProductDetail | null {
  const comparison = buildCompareResult(id);
  if (!comparison) return null;

  const category = comparison.product.categorySlug
    ? getCategoryBySlug(comparison.product.categorySlug)
    : undefined;

  return {
    product: comparison.product,
    categoryName: category?.name ?? "General",
    comparison,
    images: [comparison.product.imageUrl],
    specifications: {
      Brand: comparison.product.brand ?? "—",
      Category: category?.name ?? "General",
      Rating: `${comparison.product.rating ?? 4.5} / 5`,
      Reviews: String(comparison.product.reviewCount),
      Availability: comparison.product.inStock ? "In Stock" : "Out of Stock",
    },
    variants: [],
    priceHistory: [
      { id: "ph-1", productId: id, price: comparison.lowestPrice + 80, currency: "USD", recordedAt: "2026-03-01T00:00:00.000Z" },
      { id: "ph-2", productId: id, price: comparison.lowestPrice + 50, currency: "USD", recordedAt: "2026-04-01T00:00:00.000Z" },
      { id: "ph-3", productId: id, price: comparison.lowestPrice + 20, currency: "USD", recordedAt: "2026-05-01T00:00:00.000Z" },
      { id: "ph-4", productId: id, price: comparison.lowestPrice, currency: "USD", recordedAt: "2026-06-01T00:00:00.000Z" },
    ],
  };
}

export function getMockStoreDetail(slug: string): MockStoreDetail | null {
  const store = getStoreBySlug(slug);
  if (!store) return null;

  const products = getProductsByStore(slug);
  const dealsCount = MOCK_DEALS.filter((d) => d.store?.slug === slug).length;
  const couponsCount = MOCK_COUPONS.filter((c) => c.store?.slug === slug).length;

  return {
    store,
    description: `${store.name} is a verified Zorino partner store with competitive prices, tracked deals, and verified coupons across ${store.supportedRegions.join(", ")}.`,
    productCount: products.length || 24,
    avgRating: 4.6,
    dealsCount: dealsCount || 3,
    couponsCount: couponsCount || 2,
    products: products.length > 0 ? products : MOCK_SEARCH_ITEMS.slice(0, 4),
  };
}

export function getMockCategoryDetail(slug: string): MockCategoryDetail | null {
  const category = getCategoryBySlug(slug);
  if (!category) return null;

  const products = getProductsByCategory(slug);

  return {
    category,
    description: `Browse the best ${category.name.toLowerCase()} deals, price drops, and coupons from top stores — updated daily on Zorino.`,
    products: products.length > 0 ? products : MOCK_SEARCH_ITEMS.slice(0, 4),
  };
}

export function getMockBlogPosts(): MockBlogPost[] {
  return MOCK_BLOG_POSTS;
}

export function getMockBlogPost(slug: string): MockBlogPost | null {
  return getBlogPostBySlug(slug) ?? null;
}

export function getMockWishlistItems(): MockWishlistItem[] {
  return MOCK_WISHLIST_ITEMS;
}

export function getMockRelatedBlogPosts(slug: string, limit = 3): MockBlogPost[] {
  const current = getBlogPostBySlug(slug);
  if (!current) return MOCK_BLOG_POSTS.slice(0, limit);
  return MOCK_BLOG_POSTS.filter((p) => p.slug !== slug && p.categorySlug === current.categorySlug).slice(0, limit);
}
