import { normalizeProductImageUrl } from "@/lib/images/product-image";
import type { NormalizedCatalogItem, ProviderOffer } from "@/lib/integration/catalog-types";
import type { ProductionProviderId } from "@/lib/integration/constants";
import { getProviderStoreMeta } from "@/lib/integration/provider-context";
import type { ExternalProduct } from "@/lib/sync/types";
import type { Deal, Product, Store, TrendingDealCard } from "@/lib/types/entities";

export function computeDiscountPercent(price: number, originalPrice: number): number {
  if (originalPrice <= 0 || price >= originalPrice) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

function storeForProvider(providerId: ProductionProviderId): Store {
  const meta = getProviderStoreMeta(providerId);
  return {
    id: meta.storeId,
    name: meta.name,
    slug: meta.storeSlug,
    logoUrl: `/stores/${meta.storeSlug}.png`,
    logoInitial: meta.name.slice(0, 2),
    website: `https://www.${meta.storeSlug}.com`,
    integrationType: meta.integrationType,
    commissionRate: 0,
    supportedRegions: ["US"],
    supportedCurrencies: ["USD"],
    isActive: true,
  };
}

export function externalProductToOffer(
  providerId: ProductionProviderId,
  product: ExternalProduct,
): ProviderOffer {
  const meta = getProviderStoreMeta(providerId);
  const originalPrice = product.originalPrice ?? product.price;
  return {
    providerId,
    storeSlug: meta.storeSlug,
    storeName: meta.name,
    externalId: product.externalId,
    price: product.price,
    originalPrice,
    currency: product.currency,
    countryCode: product.countryCode,
    productUrl: product.productUrl,
    affiliateUrl: product.affiliateUrl,
    inStock: product.inStock,
  };
}

export function externalProductToCatalogItem(
  providerId: ProductionProviderId,
  product: ExternalProduct,
): NormalizedCatalogItem {
  const offer = externalProductToOffer(providerId, product);
  const originalPrice = offer.originalPrice;
  const discount = product.discount ?? computeDiscountPercent(offer.price, originalPrice);

  return {
    id: `${providerId}-${product.externalId}`,
    slug: product.slug,
    title: product.title,
    imageUrl: normalizeProductImageUrl(product.imageUrl),
    emoji: product.emoji ?? "🛍️",
    categorySlug: product.categorySlug,
    rating: product.rating ?? 4.5,
    reviewCount: product.reviewCount ?? 0,
    countryCode: product.countryCode,
    currency: product.currency,
    price: offer.price,
    originalPrice,
    discount,
    discountType: product.discountType ?? "percentage",
    offers: [offer],
    providerIds: [providerId],
    fetchedAt: new Date().toISOString(),
  };
}

export function catalogItemToTrendingDealCard(
  item: NormalizedCatalogItem,
  options?: { idPrefix?: string; updatedMins?: number },
): TrendingDealCard {
  const bestOffer = item.offers[0];
  const store = bestOffer
    ? storeForProvider(bestOffer.providerId)
    : storeForProvider(item.providerIds[0] ?? "aliexpress");

  return {
    id: options?.idPrefix ? `${options.idPrefix}-${item.id}` : item.id,
    productId: item.id,
    name: item.title,
    imageSrc: item.imageUrl,
    emoji: item.emoji,
    discount: item.discount,
    rating: item.rating,
    reviews: item.reviewCount,
    price: item.price,
    originalPrice: item.originalPrice,
    store: store.name,
    storeLogoSrc: store.logoUrl ?? `/stores/${store.slug}.png`,
    storeInitial: store.logoInitial ?? store.name.slice(0, 2),
    updatedMins: options?.updatedMins ?? 5,
    priceHistory:
      item.originalPrice > item.price
        ? [item.originalPrice, item.price]
        : [item.price],
    badge: item.discount >= 20 ? "hot" : item.discount > 0 ? "price_drop" : undefined,
  };
}

export function catalogItemToDeal(item: NormalizedCatalogItem, index = 0): Deal {
  const bestOffer = item.offers[0];
  const providerId = bestOffer?.providerId ?? item.providerIds[0] ?? "aliexpress";
  const store = storeForProvider(providerId);
  const now = Date.now();
  const endsAt = new Date(now + 7 * 86_400_000).toISOString();
  const startsAt = new Date(now - 30 * 60_000).toISOString();

  const product: Product = {
    id: item.id,
    name: item.title,
    slug: item.slug,
    imageUrl: item.imageUrl,
    emoji: item.emoji,
    categorySlug: item.categorySlug,
    rating: item.rating,
    reviewCount: item.reviewCount,
    currency: item.currency,
    countryCode: item.countryCode,
    inStock: bestOffer?.inStock ?? true,
    tags: item.providerIds,
    isActive: true,
  };

  return {
    id: `deal-${item.id}`,
    productId: item.id,
    storeId: store.id,
    title: item.title,
    discount: item.discount,
    discountType: item.discountType,
    price: item.price,
    originalPrice: item.originalPrice,
    currency: item.currency,
    countryCode: item.countryCode,
    isFeatured: item.discount >= 20 || index < 4,
    isActive: true,
    sortOrder: index,
    startsAt,
    endsAt,
    product,
    store,
  };
}

export function externalProductsToCatalogItems(
  providerId: ProductionProviderId,
  products: ExternalProduct[],
): NormalizedCatalogItem[] {
  return products
    .map((product) => externalProductToCatalogItem(providerId, product))
    .filter((item) => item.price > 0 && item.imageUrl);
}
