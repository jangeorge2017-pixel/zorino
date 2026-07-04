import type { DiscountType } from "@/lib/types/entities";
import type { ProductionProviderId } from "@/lib/integration/constants";

/** Per-provider listing attached to a normalized catalog item. */
export type ProviderOffer = {
  providerId: ProductionProviderId;
  storeSlug: string;
  storeName: string;
  externalId: string;
  price: number;
  originalPrice: number;
  currency: string;
  countryCode: string;
  productUrl: string;
  affiliateUrl?: string;
  inStock: boolean;
};

/**
 * Unified catalog schema — products from AliExpress and eBay normalized
 * for homepage sections, deals page, and cross-provider comparison.
 */
export type NormalizedCatalogItem = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string;
  emoji: string;
  categorySlug: string;
  rating: number;
  reviewCount: number;
  countryCode: string;
  currency: string;
  price: number;
  originalPrice: number;
  discount: number;
  discountType: DiscountType;
  offers: ProviderOffer[];
  providerIds: ProductionProviderId[];
  fetchedAt: string;
};

export type CatalogFetchResult = {
  items: NormalizedCatalogItem[];
  providers: Partial<Record<ProductionProviderId, { count: number; error?: string }>>;
};
