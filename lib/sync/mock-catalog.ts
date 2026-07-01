/**
 * Mock catalog mirroring homepage static data — used when partner API keys are not set.
 * Uses high-resolution external images (not local placeholders).
 */

import type { ExternalDeal, ExternalProduct } from "@/lib/sync/types";

type MockEntry = ExternalProduct & { storeSlug: string; isFeatured?: boolean; sortOrder?: number };

const IMG = {
  iphone:
    "https://images.unsplash.com/photo-1718223483120-8131e57f948b?w=1200&auto=format&fit=crop&q=80",
  macbook:
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200&auto=format&fit=crop&q=80",
  ps5: "https://images.unsplash.com/photo-1606813907293-d86efa9b94ea?w=1200&auto=format&fit=crop&q=80",
  nike: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&auto=format&fit=crop&q=80",
};

const MOCK_CATALOG: MockEntry[] = [
  {
    externalId: "amazon-B0CHX1W1XY",
    storeSlug: "amazon",
    slug: "iphone-15-pro-max",
    title: "iPhone 15 Pro Max",
    description:
      "Apple iPhone 15 Pro Max with A17 Pro chip, titanium design, and advanced camera system.",
    categorySlug: "phones",
    brand: "Apple",
    imageUrl: IMG.iphone,
    imageUrls: [IMG.iphone],
    emoji: "📱",
    price: 899,
    originalPrice: 1029,
    currency: "USD",
    countryCode: "US",
    rating: 4.8,
    reviewCount: 2847,
    inStock: true,
    productUrl: "https://www.amazon.com/dp/B0CHX1W1XY",
    discount: 12,
    discountType: "percentage",
    isFeatured: true,
    sortOrder: 1,
  },
  {
    externalId: "ae-1005006123456789",
    storeSlug: "aliexpress",
    slug: "wireless-bluetooth-earbuds-pro",
    title: "Wireless Bluetooth Earbuds Pro",
    description:
      "Active noise cancelling TWS earbuds with charging case, 30h battery life, and IPX5 water resistance.",
    categorySlug: "wearables",
    brand: "AliExpress",
    imageUrl:
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=1200&auto=format&fit=crop&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=1200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=1200&auto=format&fit=crop&q=80",
    ],
    emoji: "🎧",
    price: 24.99,
    originalPrice: 49.99,
    currency: "USD",
    countryCode: "US",
    rating: 4.6,
    reviewCount: 8420,
    inStock: true,
    productUrl: "https://www.aliexpress.com/item/1005006123456789.html",
    discount: 50,
    discountType: "percentage",
  },
  {
    externalId: "cj-CJAB123456",
    storeSlug: "cjdropshipping",
    slug: "smart-home-led-strip-lights",
    title: "Smart Home LED Strip Lights",
    description:
      "RGB WiFi LED strip lights with app control, music sync, and 16 million colors for home decor.",
    categorySlug: "home",
    brand: "CJdropshipping",
    imageUrl:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&auto=format&fit=crop&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&auto=format&fit=crop&q=80",
    ],
    emoji: "💡",
    price: 18.5,
    originalPrice: 29.99,
    currency: "USD",
    countryCode: "US",
    rating: 4.5,
    reviewCount: 1200,
    inStock: true,
    productUrl: "https://cjdropshipping.com/product/CJAB123456.html",
    discount: 38,
    discountType: "percentage",
  },
  {
    externalId: "ebay-256789012345",
    storeSlug: "ebay",
    slug: "apple-iphone-15-pro-max-256gb",
    title: "Apple iPhone 15 Pro Max 256GB Unlocked",
    description:
      "Factory unlocked iPhone 15 Pro Max 256GB in excellent condition with fast shipping from verified seller.",
    categorySlug: "phones",
    brand: "Apple",
    imageUrl: IMG.iphone,
    imageUrls: [IMG.iphone],
    emoji: "📱",
    price: 919,
    originalPrice: 1049,
    currency: "USD",
    countryCode: "US",
    rating: 4.75,
    reviewCount: 3100,
    inStock: true,
    productUrl: "https://www.ebay.com/itm/256789012345",
    discount: 12,
    discountType: "percentage",
  },
  {
    externalId: "bestbuy-6534601",
    storeSlug: "best-buy",
    slug: "macbook-air-m3",
    title: "MacBook Air M3",
    description: "Apple MacBook Air with M3 chip, 13-inch Liquid Retina display, and all-day battery life.",
    categorySlug: "laptops",
    brand: "Apple",
    imageUrl: IMG.macbook,
    imageUrls: [IMG.macbook],
    emoji: "💻",
    price: 1099,
    originalPrice: 1299,
    currency: "USD",
    countryCode: "US",
    rating: 4.9,
    reviewCount: 1523,
    inStock: true,
    productUrl: "https://www.bestbuy.com/site/apple-macbook-air-m3",
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
    description: "Sony PlayStation 5 console with ultra-high speed SSD and DualSense wireless controller.",
    categorySlug: "gaming",
    brand: "Sony",
    imageUrl: IMG.ps5,
    imageUrls: [IMG.ps5],
    emoji: "🎮",
    price: 449,
    originalPrice: 499,
    currency: "USD",
    countryCode: "US",
    rating: 4.9,
    reviewCount: 8901,
    inStock: true,
    productUrl: "https://www.walmart.com/ip/playstation-5",
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
    description: "Classic Nike Air Jordan 1 high-top sneakers with premium leather upper and iconic silhouette.",
    categorySlug: "fashion",
    brand: "Nike",
    imageUrl: IMG.nike,
    imageUrls: [IMG.nike],
    emoji: "👟",
    price: 129,
    originalPrice: 160,
    currency: "USD",
    countryCode: "US",
    rating: 4.6,
    reviewCount: 4210,
    inStock: true,
    productUrl: "https://www.footlocker.com/product/nike-air-jordan-1",
    discount: 20,
    discountType: "percentage",
    isFeatured: true,
    sortOrder: 4,
  },
];

/** Price history points per product slug (sparkline data). */
export const MOCK_PRICE_HISTORY: Record<string, number[]> = {
  "iphone-15-pro-max": [980, 960, 940, 920, 899],
  "wireless-bluetooth-earbuds-pro": [45, 40, 35, 30, 24.99],
  "smart-home-led-strip-lights": [28, 25, 22, 20, 18.5],
  "apple-iphone-15-pro-max-256gb": [980, 960, 940, 920, 919],
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
