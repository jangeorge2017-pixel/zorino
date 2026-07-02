/**
 * Homepage content from public/reference/zorino-final-design.png
 */
import {
  DEAL_PRODUCT_IMAGES,
  STORE_LOGOS,
} from "@/lib/assets";

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
  accent?: "pink" | "blue" | "green" | "purple" | "gray" | "cyan" | "orange" | "indigo";
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

export const ZH_HERO_STATS: ZhHeroStat[] = [
  { icon: "stores", value: "50+", label: "Stores", tone: "purple" },
  { icon: "products", value: "10M+", label: "Products", tone: "blue" },
  { icon: "coupons", value: "100K+", label: "Coupons", tone: "green" },
  { icon: "tracking", value: "Real-time", label: "Price Tracking", tone: "violet" },
];

export const ZH_ORBIT_CARDS: ZhOrbitCard[] = [
  {
    slot: "top",
    imageSrc: "/comparison/cal-headphones-96.png",
    discount: "-25%",
    price: "$249",
    original: "$329",
  },
  {
    slot: "left",
    imageSrc: "/comparison/cal-laptop-104.png",
    discount: "-18%",
    price: "$899",
    original: "$1,099",
  },
  {
    slot: "upper-right",
    imageSrc: "/comparison/cal-phone-96.png",
    discount: "-15%",
    price: "$999",
    original: "$1,199",
  },
  {
    slot: "right",
    imageSrc: "/comparison/cal-controller-96.png",
    discount: "-20%",
    price: "$59",
    original: "$74",
  },
];

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
  { slug: "more", label: "More", accent: "gray" },
];

export const ZH_TRENDING_DEALS: ZhDeal[] = [
  {
    id: "airpods",
    name: "Apple AirPods Pro 2nd Gen",
    imageSrc: "/comparison/cal-headphones-116.png",
    discount: 12,
    rating: 4.8,
    reviews: 2847,
    price: 219,
    originalPrice: 249,
    store: "Amazon",
    storeLogoSrc: STORE_LOGOS.amazon,
    storeInitial: "a",
    updatedMins: 2,
    priceHistory: [249, 235, 228, 219],
  },
  {
    id: "galaxy",
    name: "Samsung Galaxy S24 Ultra",
    imageSrc: DEAL_PRODUCT_IMAGES.iphone,
    discount: 8,
    rating: 4.7,
    reviews: 1523,
    price: 1099,
    originalPrice: 1199,
    store: "Best Buy",
    storeLogoSrc: STORE_LOGOS.bestBuy,
    storeInitial: "BB",
    updatedMins: 5,
    priceHistory: [1199, 1150, 1120, 1099],
  },
  {
    id: "macbook",
    name: "MacBook Air M3 13-inch",
    imageSrc: DEAL_PRODUCT_IMAGES.macbook,
    discount: 10,
    rating: 4.9,
    reviews: 892,
    price: 999,
    originalPrice: 1099,
    store: "Apple",
    storeLogoSrc: STORE_LOGOS.amazon,
    storeInitial: "AP",
    updatedMins: 8,
    priceHistory: [1099, 1050, 1020, 999],
  },
  {
    id: "ps5",
    name: "PlayStation 5 Console",
    imageSrc: DEAL_PRODUCT_IMAGES.ps5,
    discount: 15,
    rating: 4.6,
    reviews: 3421,
    price: 449,
    originalPrice: 499,
    store: "Walmart",
    storeLogoSrc: STORE_LOGOS.walmart,
    storeInitial: "W",
    updatedMins: 12,
    priceHistory: [499, 479, 460, 449],
  },
  {
    id: "sony-xm5",
    name: "Sony WH-1000XM5 Headphones",
    imageSrc: "/comparison/cal-headphones-96.png",
    discount: 18,
    rating: 4.85,
    reviews: 2104,
    price: 328,
    originalPrice: 399,
    store: "Amazon",
    storeLogoSrc: STORE_LOGOS.amazon,
    storeInitial: "a",
    updatedMins: 4,
    priceHistory: [399, 365, 340, 328],
  },
  {
    id: "switch-oled",
    name: "Nintendo Switch OLED Model",
    imageSrc: "/comparison/cal-controller-96.png",
    discount: 11,
    rating: 4.7,
    reviews: 1876,
    price: 309,
    originalPrice: 349,
    store: "Best Buy",
    storeLogoSrc: STORE_LOGOS.bestBuy,
    storeInitial: "BB",
    updatedMins: 15,
    priceHistory: [349, 335, 320, 309],
  },
  {
    id: "nike-air",
    name: "Nike Air Max 90 Sneakers",
    imageSrc: DEAL_PRODUCT_IMAGES.nike,
    discount: 22,
    rating: 4.5,
    reviews: 934,
    price: 89,
    originalPrice: 115,
    store: "Foot Locker",
    storeLogoSrc: STORE_LOGOS.footLocker,
    storeInitial: "FL",
    updatedMins: 6,
    priceHistory: [115, 105, 95, 89],
  },
  {
    id: "dyson-v15",
    name: "Dyson V15 Detect Vacuum",
    imageSrc: "/comparison/cal-laptop-104.png",
    discount: 14,
    rating: 4.8,
    reviews: 612,
    price: 599,
    originalPrice: 699,
    store: "Noon",
    storeLogoSrc: STORE_LOGOS.noon,
    storeInitial: "N",
    updatedMins: 3,
    priceHistory: [699, 650, 620, 599],
  },
];

export const ZH_TOP_COUPONS: ZhCoupon[] = [
  {
    id: "amazon",
    store: "Amazon",
    storeLogoSrc: STORE_LOGOS.amazon,
    storeInitial: "a",
    offer: "10% OFF Sitewide",
    minSpend: "Min spend $50",
    code: "SAVE10",
    usedTimes: 1240,
    verified: true,
  },
  {
    id: "noon",
    store: "Noon",
    storeLogoSrc: STORE_LOGOS.noon,
    storeInitial: "N",
    offer: "15% OFF Electronics",
    minSpend: "Min spend $100",
    code: "NOON15",
    usedTimes: 856,
    verified: true,
  },
  {
    id: "aliexpress",
    store: "AliExpress",
    storeLogoSrc: STORE_LOGOS.aliExpress,
    storeInitial: "AE",
    offer: "20% OFF First Order",
    minSpend: "Min spend $30",
    code: "AE20",
    usedTimes: 2341,
    verified: true,
  },
  {
    id: "nike",
    store: "Nike",
    storeLogoSrc: STORE_LOGOS.nike,
    storeInitial: "N",
    offer: "25% OFF Sportswear",
    minSpend: "Min spend $75",
    code: "NIKE25",
    usedTimes: 567,
    verified: true,
  },
];

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

export const ZH_FOOTER_STATS: ZhFooterStat[] = [
  { icon: "stores", value: "50+", label: "Stores" },
  { icon: "products", value: "10M+", label: "Products" },
  { icon: "coupons", value: "100K+", label: "Coupons" },
  { icon: "users", value: "5M+", label: "Happy Users" },
];
