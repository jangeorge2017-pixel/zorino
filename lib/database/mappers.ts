import type {
  CountryRow,
  CouponRow,
  CurrencyRow,
  DealRow,
  FavoriteRow,
  NotificationRow,
  PriceHistoryRow,
  PriceRow,
  ProductRow,
  ProfileRow,
  StoreRow,
} from "@/lib/database/types";
import type {
  Country,
  Coupon,
  Currency,
  Deal,
  Favorite,
  Notification,
  Price,
  PriceHistoryPoint,
  Product,
  Store,
  User,
} from "@/lib/types/entities";

export function mapCountry(row: CountryRow): Country {
  return {
    code: row.code,
    name: row.name,
    nameAr: row.name_ar,
    defaultCurrency: row.default_currency,
    isActive: row.is_active,
  };
}

export function mapCurrency(row: CurrencyRow): Currency {
  return {
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    decimalPlaces: row.decimal_places,
    isActive: row.is_active,
  };
}

export function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    locale: row.locale as "en" | "ar",
    countryCode: row.country_code,
    currency: row.currency,
    isVerified: row.is_verified,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

export function mapStore(row: StoreRow): Store {
  return {
    id: row.id,
    name: row.name,
    nameAr: row.name_ar,
    slug: row.slug,
    logoUrl: row.logo_url,
    logoInitial: row.logo_initial,
    website: row.website,
    integrationType: row.integration_type,
    affiliateProgram: row.affiliate_program,
    commissionRate: Number(row.commission_rate),
    supportedRegions: row.supported_regions,
    supportedCurrencies: row.supported_currencies,
    externalStoreId: row.external_store_id,
    isActive: row.is_active,
  };
}

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    nameAr: row.name_ar,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    emoji: row.emoji,
    categorySlug: row.category_slug,
    brand: row.brand,
    rating: row.rating != null ? Number(row.rating) : null,
    reviewCount: row.review_count,
    currency: row.currency,
    countryCode: row.country_code,
    inStock: row.in_stock,
    tags: row.tags,
    isActive: row.is_active,
    lastSyncedAt: row.last_synced_at,
  };
}

export function mapPrice(row: PriceRow, store?: Store): Price {
  return {
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    price: Number(row.price),
    originalPrice: row.original_price != null ? Number(row.original_price) : null,
    currency: row.currency,
    countryCode: row.country_code,
    externalUrl: row.external_url,
    externalProductId: row.external_product_id,
    inStock: row.in_stock,
    isCurrent: row.is_current,
    recordedAt: row.recorded_at,
    store,
  };
}

export function mapPriceHistory(row: PriceHistoryRow): PriceHistoryPoint {
  return {
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    price: Number(row.price),
    currency: row.currency,
    recordedAt: row.recorded_at,
  };
}

export function mapDeal(row: DealRow, product?: Product, store?: Store): Deal {
  return {
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    title: row.title,
    titleAr: row.title_ar,
    discount: Number(row.discount),
    discountType: row.discount_type,
    price: Number(row.price),
    originalPrice: Number(row.original_price),
    currency: row.currency,
    countryCode: row.country_code,
    isFeatured: row.is_featured,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    product,
    store,
  };
}

export function mapCoupon(row: CouponRow, store?: Store): Coupon {
  return {
    id: row.id,
    storeId: row.store_id,
    code: row.code,
    title: row.title,
    offer: row.offer,
    minSpend: row.min_spend,
    discount: Number(row.discount),
    discountType: row.discount_type,
    currency: row.currency,
    usedTimes: row.used_times,
    verified: row.verified,
    isActive: row.is_active,
    store,
  };
}

export function mapFavorite(row: FavoriteRow, product?: Product): Favorite {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    priceAlert: row.price_alert != null ? Number(row.price_alert) : null,
    currency: row.currency,
    createdAt: row.created_at,
    product,
  };
}

export function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    titleAr: row.title_ar,
    message: row.message,
    messageAr: row.message_ar,
    link: row.link,
    read: row.read,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}
