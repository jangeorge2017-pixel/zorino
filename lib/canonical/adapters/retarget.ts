/**
 * Adapter retarget — Phase 2.
 *
 * Maps the CURRENT production listing shapes into the canonical RawOffer, so
 * the canonical spine can consume exactly what production already produces.
 * Pure, deterministic, never throws, never fabricates data.
 *
 * Sources retargeted:
 *  1. RawProviderListing / NormalizedSearchListing  (lib/search/types.ts)
 *     — the unified shape every search connector normalizer already emits.
 *  2. NormalizedCatalogItem + ProviderOffer           (lib/integration/catalog-types.ts)
 *     — the homepage/catalog shape.
 *  3. ExternalProduct                                (lib/sync/types.ts)
 *     — the sync-layer payload before DB persistence.
 *
 * The point: the adapters do NOT filter or change semantics. Missing fields
 * (brand, model, identifiers, ...) stay undefined — canonical validation is
 * the ONLY authority on acceptance, exactly as in the approved architecture.
 */

import type { RawOffer } from "@/lib/canonical/types";
import { providerAcquisitionMode } from "@/lib/canonical/registry";
import type { RawProviderListing } from "@/lib/search/types";
import type {
  NormalizedCatalogItem,
  ProviderOffer,
} from "@/lib/integration/catalog-types";
import type { ExternalProduct } from "@/lib/sync/types";

/** Core field mapping shared by all retarget sources. */
interface RetargetCore {
  providerId: string;
  externalId: string;
  title: string;
  price: number;
  currency: string;
  imageUrl?: string;
  productUrl: string;
  inStock: boolean;
  originalPrice?: number;
  affiliateUrl?: string;
  category?: string;
  storeName?: string;
  countryCode?: string;
  brand?: string;
  attributes?: Record<string, string>;
  fetchedAt?: string;
}

/**
 * Convert the neutral core fields into a canonical RawOffer.
 * `merchantName` is set ONLY for indirect networks where the feed's merchant
 * (not the network) is the store shown to users (e.g. Admitad feeds).
 */
function retargetCore(core: RetargetCore): RawOffer {
  const providerId = core.providerId;
  const acquisition = providerAcquisitionMode(providerId);
  const isIndirect = acquisition === "indirect";

  const originalPrice =
    core.originalPrice != null && Number.isFinite(core.originalPrice) &&
    core.originalPrice > core.price && core.originalPrice - core.price > 1e-9
      ? core.originalPrice
      : undefined;

  return {
    providerId,
    externalOfferId: core.externalId.trim() || String(core.externalId),
    acquisition,
    title: core.title,
    price: core.price,
    currency: core.currency,
    originalPrice,
    images: core.imageUrl ? [{ url: core.imageUrl }] : [],
    productUrl: core.productUrl,
    // Indirect feeds hand us the affiliate deep-link directly — stating it is
    // trackable is a property of the network link channel, not invented data.
    affiliateUrl: core.affiliateUrl,
    affiliateTrackable: isIndirect
      ? Boolean(core.affiliateUrl)
      : undefined,
    availability: core.inStock ? "in_stock" : "out_of_stock",
    category: core.category,
    countryCode: core.countryCode,
    brand: core.brand,
    attributes: core.attributes,
    fetchedAt: core.fetchedAt,
    merchantName: isIndirect ? core.storeName : undefined,
  };
}

/**
 * Retarget a RawProviderListing (or NormalizedSearchListing) into a RawOffer.
 * The listing's fields map 1:1; storeName becomes merchantName only for
 * indirect network providers, otherwise store identity comes from the registry.
 */
export function retargetSearchListing(
  listing: RawProviderListing,
): RawOffer {
  return retargetCore({
    providerId: listing.providerId,
    externalId: listing.externalId,
    title: listing.title,
    price: listing.price,
    currency: listing.currency,
    imageUrl: listing.imageUrl,
    productUrl: listing.productUrl,
    inStock: listing.inStock,
    originalPrice: listing.originalPrice,
    affiliateUrl: listing.affiliateUrl,
    category: listing.category,
    storeName: listing.storeName,
    countryCode: listing.countryCode,
  });
}

/**
 * Retarget one ProviderOffer embedded in a NormalizedCatalogItem into a
 * RawOffer. Item-level fields (title/images/category/fetchedAt) come from the
 * parent item; price/identity fields come from the offer.
 */
export function retargetCatalogOffer(
  item: NormalizedCatalogItem,
  offer: ProviderOffer,
): RawOffer {
  return retargetCore({
    providerId: offer.providerId,
    externalId: offer.externalId,
    title: item.title,
    price: offer.price,
    currency: offer.currency,
    imageUrl: item.imageUrl,
    productUrl: offer.productUrl,
    inStock: offer.inStock,
    originalPrice: offer.originalPrice,
    affiliateUrl: offer.affiliateUrl,
    category: item.categorySlug,
    storeName: offer.storeName,
    countryCode: offer.countryCode,
    fetchedAt: item.fetchedAt,
  });
}

/**
 * Retarget a sync-layer ExternalProduct into a RawOffer. The provider id is
 * supplied by the caller (the sync connector that produced the product).
 */
export function retargetExternalProduct(
  product: ExternalProduct,
  providerId: string,
): RawOffer {
  return retargetCore({
    providerId,
    externalId: product.externalId,
    title: product.title,
    price: product.price,
    currency: product.currency,
    imageUrl: product.imageUrl,
    productUrl: product.affiliateUrl ?? product.productUrl,
    inStock: product.inStock,
    originalPrice: product.originalPrice,
    affiliateUrl: product.affiliateUrl,
    category: product.categorySlug,
    countryCode: product.countryCode,
    brand: product.brand,
    attributes: product.specifications,
  });
}