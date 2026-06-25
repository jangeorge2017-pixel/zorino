/**
 * Application-level entity interfaces for Zorino.
 * Maps to Supabase tables — see lib/database/types.ts for row shapes.
 */

export type Locale = "en" | "ar";
export type DiscountType = "percentage" | "fixed";
export type StoreIntegrationType =
  | "amazon"
  | "aliexpress"
  | "cjdropshipping"
  | "ebay"
  | "temu"
  | "shopify"
  | "noon"
  | "walmart"
  | "custom"
  | "partner";
export type NotificationType =
  | "price_drop"
  | "coupon"
  | "deal"
  | "system"
  | "review"
  | "alert"
  | "trending"
  | "affiliate";

export interface Country {
  code: string;
  name: string;
  nameAr?: string | null;
  defaultCurrency: string;
  isActive: boolean;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  locale: Locale;
  countryCode?: string | null;
  currency: string;
  isVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface Store {
  id: string;
  name: string;
  nameAr?: string | null;
  slug: string;
  logoUrl?: string | null;
  logoInitial?: string | null;
  website: string;
  integrationType: StoreIntegrationType;
  affiliateProgram?: string | null;
  commissionRate: number;
  supportedRegions: string[];
  supportedCurrencies: string[];
  externalStoreId?: string | null;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  nameAr?: string | null;
  slug: string;
  description?: string | null;
  imageUrl: string;
  emoji?: string | null;
  categorySlug?: string | null;
  brand?: string | null;
  rating?: number | null;
  reviewCount: number;
  currency: string;
  countryCode?: string | null;
  inStock: boolean;
  tags: string[];
  isActive: boolean;
  lastSyncedAt?: string | null;
}

export interface Price {
  id: string;
  productId: string;
  storeId: string;
  price: number;
  originalPrice?: number | null;
  currency: string;
  countryCode?: string | null;
  externalUrl?: string | null;
  externalProductId?: string | null;
  inStock: boolean;
  isCurrent: boolean;
  recordedAt: string;
  store?: Store;
}

export interface PriceHistoryPoint {
  id: string;
  productId: string;
  storeId?: string | null;
  price: number;
  currency: string;
  recordedAt: string;
}

export interface Deal {
  id: string;
  productId?: string | null;
  storeId?: string | null;
  title: string;
  titleAr?: string | null;
  discount: number;
  discountType: DiscountType;
  price: number;
  originalPrice: number;
  currency: string;
  countryCode?: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  startsAt: string;
  endsAt: string;
  product?: Product;
  store?: Store;
}

export interface Coupon {
  id: string;
  storeId: string;
  code: string;
  title: string;
  offer: string;
  minSpend?: string | null;
  discount: number;
  discountType: DiscountType;
  currency: string;
  usedTimes: number;
  verified: boolean;
  isActive: boolean;
  store?: Store;
}

export interface Favorite {
  id: string;
  userId: string;
  productId: string;
  priceAlert?: number | null;
  currency?: string | null;
  createdAt: string;
  product?: Product;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  titleAr?: string | null;
  message: string;
  messageAr?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  nameAr?: string | null;
  icon?: string | null;
  parentId?: string | null;
  sortOrder: number;
  productCount: number;
  isActive: boolean;
}

export type SyncJobType = "products" | "prices" | "deals" | "images" | "full";
export type SyncRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface SyncJob {
  id: string;
  storeId?: string | null;
  jobType: SyncJobType;
  countryCode?: string | null;
  currency?: string | null;
  intervalMinutes: number;
  isEnabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
}

export interface SyncRun {
  id: string;
  syncJobId?: string | null;
  storeId?: string | null;
  jobType: SyncJobType;
  status: SyncRunStatus;
  itemsFetched: number;
  itemsUpdated: number;
  itemsFailed: number;
  startedAt: string;
  finishedAt?: string | null;
  errorMessage?: string | null;
}

/** Homepage trending deal card shape (UI-compatible) */
export interface TrendingDealCard {
  id: number | string;
  productId?: string;
  name: string;
  imageSrc: string;
  emoji: string;
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
  badge?: TrendingBadge | null;
  providerCount?: number;
  rankingScore?: number;
}

export type TrendingRankingType =
  | "trending_today"
  | "best_sellers"
  | "hot_deals"
  | "biggest_drops"
  | "popular_country";

export type TrendingBadge =
  | "trending"
  | "bestseller"
  | "hot"
  | "price_drop"
  | "popular";

export type ProductEngagementEventType = "view" | "click" | "favorite" | "purchase";

export type LowestPriceSort = "lowest_price" | "biggest_discount" | "new_lowest";

export interface LowestPriceTodayItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl: string;
  emoji: string;
  lowestPrice: number;
  originalPrice: number;
  discountPercent: number;
  savingsAmount: number;
  storeName: string;
  provider: string;
  affiliateUrl: string;
  externalUrl: string;
  isNewLow: boolean;
  priceRecordedAt: string | null;
  countryCode: string;
  currency: string;
}

export interface TrendingProductCard extends TrendingDealCard {
  slug: string;
  rankingType: TrendingRankingType;
  rank: number;
  countryCode: string;
}

export interface CatalogStats {
  stores: number;
  products: number;
  coupons: number;
  deals: number;
  users: number;
}

export interface HeroStatItem {
  key: "stores" | "products" | "coupons" | "tracking";
  value: string;
  label: string;
  tone: "purple" | "blue" | "green" | "violet";
}

export interface FooterStatItem {
  key: "stores" | "products" | "coupons" | "users";
  value: string;
  label: string;
}

export interface FloatingProductCard {
  imageSrc: string;
  discount: string;
  price: string;
  original: string;
  position: string;
}

export interface HomepageCategoryItem {
  slug: string;
  label: string;
  active: boolean;
  accent?: string | null;
}

/** Homepage coupon card shape (UI-compatible) */
export interface TopCouponCard {
  id: number | string;
  store: string;
  storeLogoSrc: string;
  storeInitial: string;
  offer: string;
  minSpend: string;
  code: string;
  usedTimes: number;
  verified: boolean;
}

export interface ServiceResult<T> {
  data: T;
  error: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
