/**
 * Canonicalization pipeline (Phase 1).
 *
 * RawOffer → validate → CanonicalOffer → (group/matching) → CanonicalProduct.
 *
 * Both DIRECT and INDIRECT acquisition converge here: this module is mode-
 * agnostic. It computes stable ids, carries through real data only, and never
 * fabricates missing fields (brand/model/rating/etc. stay undefined).
 *
 * This is the shared convergence point the architecture requires. No runtime
 * code calls it yet (ARCH_CANONICAL default off).
 */

import type {
  CanonicalOffer,
  CanonicalProduct,
  IdentityMatch,
  RawOffer,
} from "@/lib/canonical/types";
import type { ValidationProfile } from "@/lib/canonical/validation";
import { matchOffers, variantFingerprint } from "@/lib/canonical/matching";
import {
  qualityScoreFromValidation,
  summarizeValidation,
  validateOffer,
} from "@/lib/canonical/validation";
import { resolveCanonicalStore } from "@/lib/canonical/registry";
import { computeDiscountPercent } from "@/lib/marketplace-engine/utils";

export interface CanonicalizeParams {
  profile?: ValidationProfile;
  /** strategy label to record on the offer's acquisition block. */
  strategy?: string;
}

export interface CanonicalizeOutcome {
  offer?: CanonicalOffer;
  validation: import("@/lib/canonical/types").OfferValidationResult;
}

function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Stable canonical offer id: po:<providerId>:<externalOfferId> */
export function buildCanonicalOfferId(providerId: string, externalOfferId: string): string {
  return `po:${providerId}:${externalOfferId}`;
}

/** Stable canonical product id fallback (hash of key). */
export function buildCanonicalProductId(key: string): string {
  return `canon:${stableHash(key)}:${stableHash(normalizeForHash(key)).slice(0, 8)}`;
}

function normalizeForHash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Canonicalize a RawOffer into a CanonicalOffer. Returns undefined when the
 * offer fails validation. Never throws.
 */
export function canonicalizeOffer(
  raw: RawOffer,
  params: CanonicalizeParams = {},
): CanonicalizeOutcome {
  const validation = validateOffer(raw, params.profile);

  if (validation.status === "rejected") {
    return { validation };
  }

  // Narrow the required fields — validation already rejected any missing one,
  // so these are guaranteed present (kept as locals so TS narrows without
  // non-null assertions).
  const title = raw.title?.trim() ?? "";
  const price = raw.price;
  const currency = raw.currency;
  const externalOfferId = raw.externalOfferId?.trim();
  const productUrl = raw.productUrl;
  if (!title || typeof price !== "number" || !Number.isFinite(price) || price <= 0 || !currency || !externalOfferId || !productUrl) {
    // Defensive: unreachable via validation, but never emit a partial offer.
    return { validation };
  }

  const store = resolveCanonicalStore(raw.providerId, raw.merchantName);
  // sourceRef stays a telemetry/source trace on the acquisition block; the
  // merchant name (when present) drives store identity for indirect networks.

  const now = raw.fetchedAt && !Number.isNaN(Date.parse(raw.fetchedAt))
    ? raw.fetchedAt
    : new Date().toISOString();

  const originalPrice =
    raw.originalPrice != null && raw.originalPrice > price ? raw.originalPrice : undefined;
  const discount =
    originalPrice != null && Number.isFinite(originalPrice)
      ? { amount: Math.round((originalPrice - price) * 100) / 100,
          percentage: computeDiscountPercent(price, originalPrice) }
      : undefined;

  const offer: CanonicalOffer = {
    canonicalOfferId: buildCanonicalOfferId(raw.providerId, externalOfferId),
    providerId: raw.providerId,
    storeId: store.storeId,
    storeName: store.name,
    externalOfferId,
    canonicalProductId: "", // set by grouping/matching
    acquisition: {
      mode: raw.acquisition,
      strategy: params.strategy ?? (raw.acquisition === "indirect" ? "link" : "api"),
      sourceRef: raw.sourceRef,
    },
    title,
    brand: raw.brand,
    model: raw.model,
    variant: raw.variant,
    sku: raw.sku,
    identifiers: raw.identifiers ?? [],
    images: (raw.images ?? []).map((img, i) => ({
      url: img.url,
      width: img.width,
      height: img.height,
      isPrimary: i === 0,
    })),
    price,
    originalPrice,
    currency,
    discount,
    availability:
      raw.availability ?? (raw.inStock === false ? "out_of_stock" : "unknown"),
    shipping: raw.shipping,
    productUrl,
    affiliateUrl: raw.affiliateUrl,
    affiliateTrackable: raw.affiliateTrackable,
    category: raw.category,
    attributes: raw.attributes,
    countryCode: raw.countryCode,
    qualityScore: qualityScoreFromValidation(validation),
    validation: {
      status: validation.status,
      warnings: validation.warnedCodes,
    },
    source: {
      fetchedAt: now,
      rawProvider: raw.providerId,
      confidence: qualityScoreFromValidation(validation),
    },
  };

  return { offer, validation };
}

// ─── Grouping into CanonicalProduct ─────────────────────────────────────────

interface OfferLikeForMatch {
  providerId: string;
  externalOfferId?: string;
  brand?: string;
  model?: string;
  title: string;
  identifiers?: import("@/lib/canonical/types").OfferIdentifier[];
  attributes?: Record<string, string>;
}

function asMatchable(offer: CanonicalOffer): OfferLikeForMatch {
  return {
    providerId: offer.providerId,
    externalOfferId: offer.externalOfferId,
    brand: offer.brand,
    model: offer.model,
    title: offer.title,
    identifiers: offer.identifiers,
    attributes: offer.attributes,
  };
}

/**
 * Group an array of canonical offers into canonical products, deterministically.
 *
 * Two offers belong to the same product when `matchOffers` returns
 * exact/strong. "suggested"/"weak" matches are NOT merged automatically —
 * they stay as separate products (the UI/after-layer may surface suggestions).
 */
export function groupOffersIntoProducts(offers: CanonicalOffer[]): CanonicalProduct[] {
  const products: CanonicalProduct[] = [];

  for (const offer of offers) {
    let placed = false;
    for (const product of products) {
      // Compare against the representative offer of the product (first one).
      const rep = product.offers[0];
      const match: IdentityMatch = matchOffers(asMatchable(offer), asMatchable(rep));
      if (match.confidence === "exact" || match.confidence === "strong") {
        // only merge when it's the same variant OR we're not variant-sensitive
        // (grouping by product family; variant split can be layered later).
        offer.canonicalProductId = product.canonicalProductId;
        product.offers.push(offer);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const id = buildCanonicalProductId(
        offer.brand && offer.model
          ? `bm:${offer.brand}|${offer.model}`
          : `title:${offer.title}`,
      );
      offer.canonicalProductId = id;
      products.push({
        canonicalProductId: id,
        title: offer.title,
        brand: offer.brand,
        model: offer.model,
        identifiers: offer.identifiers,
        category: offer.category,
        attributesHash: variantFingerprint(offer.attributes),
        images: offer.images.map((i) => i.url),
        offers: [offer],
        lowestPrice: offer.price,
        highestPrice: offer.price,
        offerCount: 1,
        currency: offer.currency,
        matchConfidence: "exact", // first offer defines the product
        updatedAt: offer.source.fetchedAt,
      });
    }
  }

  recomputeProductAggregates(products);
  return products;
}

/** Recompute lowest/highest/offerCount/currency for each product. */
function recomputeProductAggregates(products: CanonicalProduct[]): void {
  for (const product of products) {
    const offers = product.offers;
    const lowest = offers.reduce((best, o) => (o.price < best.price ? o : best));
    const highest = offers.reduce((best, o) => (o.price > best.price ? o : best));
    product.lowestPrice = lowest.price;
    product.highestPrice = highest.price;
    product.offerCount = offers.length;
    product.currency = lowest.currency;
    // images: dedupe primary URLs preserving order
    const seen = new Set<string>();
    product.images = offers
      .flatMap((o) => o.images.map((i) => i.url))
      .filter((url) => (seen.has(url) ? false : (seen.add(url), true)));
    product.updatedAt = offers.map((o) => o.source.fetchedAt).sort().at(-1) ?? product.updatedAt;
  }
}

/**
 * Deterministically merge multiple already-grouped product batches
 * (e.g. from parallel provider fan-out). Only exact/strong matches cross.
 */
export function mergeProductBatches(batches: CanonicalProduct[][]): CanonicalProduct[] {
  const combined: CanonicalProduct[] = [];
  for (const batch of batches) {
    for (const product of batch) {
      let placed = false;
      for (const target of combined) {
        const match = matchOffers(
          asMatchable(product.offers[0]),
          asMatchable(target.offers[0]),
        );
        if (match.confidence === "exact" || match.confidence === "strong") {
          // merge offers into target
          for (const offer of product.offers) {
            offer.canonicalProductId = target.canonicalProductId;
            target.offers.push(offer);
          }
          placed = true;
          break;
        }
      }
      if (!placed) combined.push(product);
    }
  }
  recomputeProductAggregates(combined);
  return combined;
}

/** Summary helper used for onboarding/acceptance reports. */
export function summarizeCanonicalize(outcome: CanonicalizeOutcome): string {
  return outcome.offer
    ? `canonicalized ${outcome.offer.canonicalOfferId} (${summarizeValidation(outcome.validation)})`
    : `rejected (${outcome.validation.rejectedCodes.join(", ") || "no-code"})`;
}