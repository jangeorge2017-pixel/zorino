/**
 * Mock catalog mirroring homepage static data — used by sync connectors until real APIs connect.
 * Images and card layout stay identical to data/home.ts (UI unchanged).
 */

import type { ExternalDeal, ExternalProduct } from "@/lib/sync/types";

type MockEntry = ExternalProduct & { storeSlug: string; isFeatured?: boolean; sortOrder?: number };

const MOCK_CATALOG: MockEntry[] = [
  {
    externalId: "amazon-B0CHX1W1XY",
    storeSlug: "amazon",
    slug: "iphone-15-pro-max",
    title: "iPhone 15 Pro Max",
    categorySlug: "phones",
    brand: "Apple",
    imageUrl: "/products/deal-iphone.png",
    emoji: "📱",
    price: 899,
    originalPrice: 1029,
    currency: "USD",
    countryCode: "US",
    rating: 4.8,
    reviewCount: 2847,
    inStock: true,
    productUrl: "https://amazon.com/dp/mock-iphone",
    discount: 12,
    discountType: "percentage",
    isFeatured: true,
    sortOrder: 1,
  },
  {
    externalId: "ae-iphone-15-pro-max",
    storeSlug: "aliexpress",
    slug: "iphone-15-pro-max",
    title: "iPhone 15 Pro Max",
    categorySlug: "phones",
    brand: "Apple",
    imageUrl: "/products/deal-iphone.png",
    emoji: "📱",
    price: 879,
    originalPrice: 999,
    currency: "USD",
    countryCode: "US",
    rating: 4.7,
    reviewCount: 1920,
    inStock: true,
    productUrl: "https://aliexpress.com/item/mock-iphone",
    discount: 12,
    discountType: "percentage",
  },
  {
    externalId: "cj-iphone-15-pro-max",
    storeSlug: "cjdropshipping",
    slug: "iphone-15-pro-max",
    title: "iPhone 15 Pro Max",
    categorySlug: "phones",
    brand: "Apple",
    imageUrl: "/products/deal-iphone.png",
    emoji: "📱",
    price: 849,
    originalPrice: 979,
    currency: "USD",
    countryCode: "US",
    rating: 4.6,
    reviewCount: 890,
    inStock: true,
    productUrl: "https://cjdropshipping.com/product/mock-iphone",
    discount: 13,
    discountType: "percentage",
  },
  {
    externalId: "ebay-iphone-15-pro-max",
    storeSlug: "ebay",
    slug: "iphone-15-pro-max",
    title: "iPhone 15 Pro Max 256GB",
    categorySlug: "phones",
    brand: "Apple",
    imageUrl: "/products/deal-iphone.png",
    emoji: "📱",
    price: 919,
    originalPrice: 1049,
    currency: "USD",
    countryCode: "US",
    rating: 4.75,
    reviewCount: 3100,
    inStock: true,
    productUrl: "https://ebay.com/itm/mock-iphone",
    discount: 12,
    discountType: "percentage",
  },
  {
    externalId: "bestbuy-6534601",
    storeSlug: "best-buy",
    slug: "macbook-air-m3",
    title: "MacBook Air M3",
    categorySlug: "laptops",
    brand: "Apple",
    imageUrl: "/products/deal-macbook.png",
    emoji: "💻",
    price: 1099,
    originalPrice: 1299,
    currency: "USD",
    countryCode: "US",
    rating: 4.9,
    reviewCount: 1523,
    inStock: true,
    productUrl: "https://bestbuy.com/site/mock-macbook",
    discount: 15,
    discountType: "percentage",
    isFeatured: true,
    sortOrder: 2,
  },
  {
    externalId: "walmart-PS5-2024",
    storeSlug: "walmart",
    slug: "playstation-5",
    title: "PlayStation 5",
    categorySlug: "gaming",
    brand: "Sony",
    imageUrl: "/products/deal-ps5.png",
    emoji: "🎮",
    price: 449,
    originalPrice: 499,
    currency: "USD",
    countryCode: "US",
    rating: 4.9,
    reviewCount: 8901,
    inStock: true,
    productUrl: "https://walmart.com/ip/mock-ps5",
    discount: 10,
    discountType: "percentage",
    isFeatured: true,
    sortOrder: 3,
  },
  {
    externalId: "footlocker-AJ1-555088",
    storeSlug: "foot-locker",
    slug: "nike-air-jordan-1",
    title: "Nike Air Jordan 1",
    categorySlug: "fashion",
    brand: "Nike",
    imageUrl: "/products/deal-nike.png",
    emoji: "👟",
    price: 129,
    originalPrice: 160,
    currency: "USD",
    countryCode: "US",
    rating: 4.6,
    reviewCount: 4210,
    inStock: true,
    productUrl: "https://footlocker.com/product/mock-aj1",
    discount: 20,
    discountType: "percentage",
    isFeatured: true,
    sortOrder: 4,
  },
];

/** Price history points per product slug (sparkline data). */
export const MOCK_PRICE_HISTORY: Record<string, number[]> = {
  "iphone-15-pro-max": [980, 960, 940, 920, 899],
  "macbook-air-m3": [1250, 1200, 1150, 1120, 1099],
  "playstation-5": [490, 480, 470, 460, 449],
  "nike-air-jordan-1": [155, 148, 140, 135, 129],
};

export function getMockProductsForStore(storeSlug: string): ExternalProduct[] {
  return MOCK_CATALOG.filter((p) => p.storeSlug === storeSlug).map(stripStoreSlug);
}

export function getAllMockProducts(): ExternalProduct[] {
  return MOCK_CATALOG.map(stripStoreSlug);
}

export function getMockDealsForStore(storeSlug: string): ExternalDeal[] {
  return MOCK_CATALOG.filter((p) => p.storeSlug === storeSlug && p.isFeatured).map((p) => ({
    externalProductId: p.externalId,
    title: p.title,
    discount: p.discount ?? 0,
    discountType: p.discountType ?? "percentage",
    price: p.price,
    originalPrice: p.originalPrice ?? p.price,
    currency: p.currency,
    countryCode: p.countryCode,
    imageUrl: p.imageUrl,
    productUrl: p.productUrl,
    isFeatured: p.isFeatured,
    sortOrder: p.sortOrder,
  }));
}

export function getMockProductByExternalId(externalId: string): ExternalProduct | undefined {
  const entry = MOCK_CATALOG.find((p) => p.externalId === externalId);
  return entry ? stripStoreSlug(entry) : undefined;
}

function stripStoreSlug(entry: MockEntry): ExternalProduct {
  const { storeSlug: _storeSlug, isFeatured: _f, sortOrder: _s, ...product } = entry;
  return product;
}
