/**
 * Homepage content from public/reference/zorino-final-design.png
 */

export type ZhHeroStat = {
  icon: "stores" | "products" | "coupons" | "tracking";
  value: string;
  label: string;
  tone: "purple" | "blue" | "green" | "violet";
};

export type ZhOrbitCard = {
  slot: "top" | "left" | "upper-right" | "right";
  imageSrc: string;
  discount: string;
  price: string;
  original: string;
};

export type ZhCategory = {
  slug: string;
  label: string;
  accent?: "pink" | "blue" | "green" | "purple" | "gray" | "cyan" | "orange" | "indigo" | "yellow";
  highlighted?: boolean;
};

export type ZhDeal = {
  id: string;
  name: string;
  imageSrc: string;
  discount: number;
  rating: number;
  reviews: number;
  price: number;
  originalPrice: number;
  store: string;
  storeLogoSrc: string;
  storeInitial: string;
  updatedMins: number;
  priceHistory: number[];
};

export type ZhCoupon = {
  id: string;
  store: string;
  storeLogoSrc: string;
  storeInitial: string;
  offer: string;
  minSpend: string;
  code: string;
  usedTimes: number;
  verified: boolean;
};

export type ZhFeature = {
  icon: string;
  title: string;
  text: string;
  accent: "purple" | "pink" | "green" | "blue";
};

export type ZhFooterStat = {
  icon: "stores" | "products" | "coupons" | "users";
  value: string;
  label: string;
};

/**
 * No fabricated stats. Zorino shows only real, data-backed counts computed from
 * the live catalog (see lib/data/homepage.ts loadHomepageStats). This legacy
 * static list is intentionally empty — it must never supply fake numbers.
 */
export const ZH_HERO_STATS: ZhHeroStat[] = [];

/**
 * No fabricated orbit/floating product cards. The hero shows only real
 * product cards; this static list is intentionally empty so it can never
 * supply invented prices/discounts.
 */
export const ZH_ORBIT_CARDS: ZhOrbitCard[] = [];

export const ZH_POPULAR_SEARCHES = [
  "iPhone 15 Pro Max",
  "MacBook Air M3",
  "Samsung Galaxy S24",
  "Sony WH-1000XM5",
  "Nintendo Switch OLED",
  "Dyson V15 Detect",
];

export const ZH_CATEGORIES: ZhCategory[] = [
  { slug: "phones", label: "Phones", accent: "blue" },
  { slug: "laptops", label: "Laptops", accent: "cyan" },
  { slug: "gaming", label: "Gaming", accent: "purple" },
  { slug: "tvs", label: "TVs", accent: "orange" },
  { slug: "home", label: "Home", accent: "green", highlighted: true },
  { slug: "wearables", label: "Wearables", accent: "pink" },
  { slug: "fashion", label: "Fashion", accent: "indigo" },
  /* Former “More” overflow — shown inline on desktop */
  { slug: "electronics", label: "Electronics", accent: "yellow" },
  { slug: "audio", label: "Audio", accent: "cyan" },
  { slug: "beauty", label: "Beauty", accent: "pink" },
  { slug: "sports", label: "Sports", accent: "orange" },
];

/**
 * No fabricated trending-deal cards. Zorino shows only real, data-backed deals
 * (fed by the live provider pipeline). This legacy static list is intentionally
 * empty so it can never supply invented products, prices, ratings, or reviews.
 */
export const ZH_TRENDING_DEALS: ZhDeal[] = [];

/**
 * No fabricated coupons. Zorino shows only real, verified coupon/offer source
 * data (none is connected yet — see services/coupons.ts hasRealCouponSource()).
 * This legacy static coupon list is intentionally empty: it must never supply
 * invented coupon codes, stores, or usage counts.
 */
export const ZH_TOP_COUPONS: ZhCoupon[] = [];

export const ZH_FEATURES: ZhFeature[] = [
  {
    icon: "/icons/feature-ai.svg",
    title: "AI Recommendations",
    text: "Smart AI suggests the best products and deals for you.",
    accent: "purple",
  },
  {
    icon: "/icons/feature-tracking.svg",
    title: "Real-time Price Tracking",
    text: "We track price changes 24/7 so you never overpay.",
    accent: "pink",
  },
  {
    icon: "/icons/feature-coupons.svg",
    title: "Verified Coupons",
    text: "Thousands of verified coupons updated daily.",
    accent: "green",
  },
  {
    icon: "/icons/feature-globe.svg",
    title: "Global Coverage",
    text: "Compare prices from 50+ countries and global stores.",
    accent: "blue",
  },
];

/**
 * No fabricated footer stats. See ZH_HERO_STATS comment — real counts only.
 */
export const ZH_FOOTER_STATS: ZhFooterStat[] = [];
