/**
 * Canonical consumption kernel — Phase 4.
 *
 * The convergence point where production-shaped data re-enters the canonical
 * spine for consumption: every surface's data passes through canonical
 * validation (lib/canonical) and identity formation, and the PUBLISHED shapes
 * are preserved exactly for the contracts the UI already consumes. When a
 * surface gate is OFF the surface functions bypass this kernel entirely.
 *
 * Note on parity: canonicalization never re-orders or re-labels published
 * data. It validates offers through the canonical gate (G1–G4) and groups
 * accepted offers into canonical products (identity/telemetry). Every field
 * the UI reads keeps its legacy bytes. The parity harness in this package
 * asserts that on curated inputs.
 */

import type { NormalizedSearchListing } from "@/lib/search/types";
import type {
  NormalizedCatalogItem,
  ProviderOffer,
} from "@/lib/integration/catalog-types";
import type { ProductDetail } from "@/lib/data/product-detail";
import type { CompareOffer } from "@/services/compare";
import type { CanonicalProduct, RawOffer } from "@/lib/canonical/types";
import { retargetCatalogOffer, retargetSearchListing } from "@/lib/canonical/adapters";
import { canonicalizeOffer, groupOffersIntoProducts } from "@/lib/canonical/pipeline";
import { providerAcquisitionMode } from "@/lib/canonical/registry";
import type { ValidationRejectionReason } from "@/lib/canonical/types";

export interface CanonicalSearchOutcome {
  accepted: NormalizedSearchListing[];
  rejected: { listing: NormalizedSearchListing; codes: ValidationRejectionReason[] }[];
  products: CanonicalProduct[];
  /** canonicalProductId → the listing it was formed from (id → product id). */
  productByOffer: Map<string, string>;
  /** how many raw offers were consumed (equal to listings.length). */
  acquired: number;
}

/**
 * Converge search listings through the canonical spine. Accepted listings keep
 * their exact published bytes; invalid ones are removed with their reason
 * codes. Accepted offers are grouped into canonical products (identity).
 */
export function canonicalizeSearchListings(
  listings: readonly NormalizedSearchListing[],
): CanonicalSearchOutcome {
  const accepted: NormalizedSearchListing[] = [];
  const rejected: CanonicalSearchOutcome["rejected"] = [];
  const productByOffer = new Map<string, string>();
  const canonicalOffers: import("@/lib/canonical/types").CanonicalOffer[] = [];

  for (const listing of listings) {
    const raw: RawOffer = retargetSearchListing(listing);
    const outcome = canonicalizeOffer(raw, {
      strategy: `search:${listing.providerId}:${providerAcquisitionMode(listing.providerId)}`,
    });
    if (outcome.offer) {
      accepted.push(listing);
      canonicalOffers.push(outcome.offer);
    } else {
      rejected.push({ listing, codes: outcome.validation.rejectedCodes as ValidationRejectionReason[] });
    }
  }

  const products = groupOffersIntoProducts(canonicalOffers);
  for (const product of products) {
    for (const offer of product.offers) {
      const listing = accepted.find(
        (l) => l.providerId === offer.providerId && l.externalId === offer.externalOfferId,
      );
      if (listing) {
        productByOffer.set(listing.id, product.canonicalProductId);
      }
    }
  }

  return {
    accepted,
    rejected,
    products,
    productByOffer,
    acquired: listings.length,
  };
}

export interface CatalogItemOutcome {
  items: NormalizedCatalogItem[];
  droppedItems: number;
  rejectedOffers: number;
  productsFormed: number;
}

/**
 * Converge homepage catalog items through the canonical spine. Each offer is
 * validated; offers failing validate → dropped. If at least one offer survives
 * the item is kept (offers narrowed, item aggregates recomputed to match DB
 * emit semantics). If none survive the whole item is dropped.
 */
export function canonicalizeCatalogItems(
  items: readonly NormalizedCatalogItem[],
): CatalogItemOutcome {
  let droppedItems = 0;
  let rejectedOffers = 0;
  const productsFormed = new Set<string>();
  const canonicalOffers: import("@/lib/canonical/types").CanonicalOffer[] = [];
  const out: NormalizedCatalogItem[] = [];

  for (const item of items) {
    const kept: ProviderOffer[] = [];
    for (const offer of item.offers) {
      const outcome = canonicalizeOffer(
        retargetCatalogOffer(item, offer),
        { strategy: `catalog:${offer.providerId}` },
      );
      if (outcome.offer) {
        kept.push(offer);
        canonicalOffers.push(outcome.offer);
      } else {
        rejectedOffers += 1;
      }
    }

    if (kept.length === 0) {
      droppedItems += 1;
      continue;
    }

    if (kept.length === item.offers.length) {
      // Everything survived — publish the item byte-for-byte.
      out.push(item);
      continue;
    }

    // Narrow the offers and recompute aggregates the way the DB path emits.
    const lowest = Math.min(...kept.map((o) => o.price));
    const originals = kept
      .map((o) => o.originalPrice)
      .filter((p): p is number => typeof p === "number" && p > lowest && Number.isFinite(p));
    const originalPrice = originals.length > 0 ? Math.min(...originals) : lowest;
    const discount =
      originalPrice > lowest
        ? Math.round(((originalPrice - lowest) / originalPrice) * 100)
        : item.discount;

    out.push({
      ...item,
      price: lowest,
      originalPrice,
      discount,
      discountType: item.discountType,
      offers: kept,
    });
  }

  const products = groupOffersIntoProducts(canonicalOffers);
  for (const product of products) productsFormed.add(product.canonicalProductId);

  return {
    items: out,
    droppedItems,
    rejectedOffers,
    productsFormed: productsFormed.size,
  };
}

export interface ProductDetailOutcome {
  detail: ProductDetail;
  rejectedOfferIds: string[];
  offersKept: number;
  offersTotal: number;
  changed: boolean;
}

/**
 * Converge a resolved ProductDetail's comparison offers through the canonical
 * spine. Valid offers keep their exact bytes; invalid offers are removed and
 * the comparison summary is recomputed with the same statistics used by the
 * legacy compare pipeline (lib/compare/merge.ts). When nothing is filtered the
 * detail object is returned unchanged.
 */
export function canonicalizeProductDetail(detail: ProductDetail): ProductDetailOutcome {
  const offers = detail.comparison?.offers ?? [];
  if (offers.length === 0) {
    return { detail, rejectedOfferIds: [], offersKept: 0, offersTotal: 0, changed: false };
  }

  const rejectedOfferIds: string[] = [];
  const kept: CompareOffer[] = [];

  for (const offer of offers) {
    // Skip offers that carry no provable identity rings — the canonical gate
    // has nothing to validate and never fabricates a rejection.
    const providerId = offer.store?.id ?? offer.provider;
    const externalOfferId = offer.externalProductId ?? offer.id;
    if (!providerId || providerId === "unknown" || !externalOfferId) {
      kept.push(offer);
      continue;
    }

    const raw: RawOffer = {
      providerId,
      externalOfferId,
      acquisition: providerAcquisitionMode(providerId),
      title: detail.product?.name ?? "",
      price: offer.price,
      currency: offer.currency,
      originalPrice: offer.originalPrice && offer.originalPrice > offer.price ? offer.originalPrice : undefined,
      images: detail.product?.imageUrl ? [{ url: detail.product.imageUrl }] : [],
      productUrl: offer.externalUrl ?? "",
      inStock: offer.inStock ?? true,
      countryCode: offer.countryCode ?? undefined,
    };

    const outcome = canonicalizeOffer(raw, { strategy: `pdp:${providerId}` });
    if (outcome.offer) {
      kept.push(offer);
    } else {
      rejectedOfferIds.push(offer.id);
    }
  }

  if (rejectedOfferIds.length === 0) {
    return {
      detail,
      rejectedOfferIds,
      offersKept: offers.length,
      offersTotal: offers.length,
      changed: false,
    };
  }

  const comparison = rebuildCompareResult(detail, kept);

  return {
    detail: { ...detail, comparison },
    rejectedOfferIds,
    offersKept: kept.length,
    offersTotal: offers.length,
    changed: true,
  };
}

function rebuildCompareResult(
  detail: ProductDetail,
  kept: CompareOffer[],
): ProductDetail["comparison"] {
  const prev = detail.comparison;
  const offers = [...kept].sort((a, b) => a.price - b.price);
  const stats = computeCompareStatsShim(offers);

  const storeNameOf = (offer: CompareOffer | undefined): string => {
    if (!offer) return "";
    return offer.store?.name ?? offer.provider ?? "";
  };

  const providers = new Set(
    offers.map((o) => (o.store?.id ?? o.provider ?? "unknown")).filter((id) => id !== "unknown"),
  );

  return {
    ...prev,
    offers,
    lowestPrice: stats.lowestPrice,
    highestPrice: stats.highestPrice,
    highestDiscount: stats.highestDiscount,
    savingsVsHighest: stats.savingsVsHighest,
    savingsPercent: stats.savingsPercent,
    providerCount: providers.size,
    cheapestStoreName: storeNameOf(offers[stats.cheapestIndex]),
    highestDiscountStoreName: storeNameOf(
      offers[stats.highestDiscountIndexes[0]],
    ),
  };
}

interface ComputedStats {
  lowestPrice: number;
  highestPrice: number;
  highestDiscount: number;
  savingsVsHighest: number;
  savingsPercent: number;
  cheapestIndex: number;
  highestDiscountIndexes: number[];
}

/** Mirrors lib/compare/merge.ts computeCompareStats without importing it. */
function computeCompareStatsShim(offers: CompareOffer[]): ComputedStats {
  const sorted = [...offers].sort((a, b) => a.price - b.price);
  if (sorted.length === 0) {
    return {
      lowestPrice: 0,
      highestPrice: 0,
      highestDiscount: 0,
      savingsVsHighest: 0,
      savingsPercent: 0,
      cheapestIndex: -1,
      highestDiscountIndexes: [],
    };
  }
  const lowestPrice = sorted[0].price;
  const highestPrice = sorted[sorted.length - 1].price;
  let highestDiscount = 0;
  for (const offer of sorted) {
    if (offer.discountPercent > highestDiscount) highestDiscount = offer.discountPercent;
  }
  const highestDiscountIndexes: number[] = [];
  if (highestDiscount > 0) {
    sorted.forEach((offer, index) => {
      if (offer.discountPercent === highestDiscount) highestDiscountIndexes.push(index);
    });
  }
  return {
    lowestPrice,
    highestPrice,
    highestDiscount,
    savingsVsHighest: Math.max(0, highestPrice - lowestPrice),
    savingsPercent:
      highestPrice > lowestPrice && lowestPrice > 0
        ? Math.round(((highestPrice - lowestPrice) / highestPrice) * 10000) / 100
        : 0,
    cheapestIndex: 0,
    highestDiscountIndexes,
  };
}