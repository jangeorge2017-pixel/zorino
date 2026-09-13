/**
 * Parity specifications — Phase 2.
 *
 * Parity is the acceptance gate that proves the canonical spine does not
 * diverge from what production currently produces. Every parity clause checks
 * ONE dimension of a real production listing against its canonical offer:
 * identity, title, price, currency, image, url, availability, provider, and
 * (for indirect networks) store.
 *
 * Parity is NOT about matching — it is about data preservation. These checks
 * run against retargeted fixtures of the active providers in tests; wiring
 * them into CI is an acceptance gate for Phase 3+.
 */

import type { CanonicalOffer } from "@/lib/canonical/types";
import type { RawProviderListing } from "@/lib/search/types";
import { providerAcquisitionMode } from "@/lib/canonical/registry";

export type ParityDimension =
  | "provider"
  | "identity"
  | "title"
  | "price"
  | "currency"
  | "image"
  | "url"
  | "availability"
  | "store";

export interface ParityResult {
  dimension: ParityDimension;
  passes: boolean;
  expected?: unknown;
  actual?: unknown;
  note: string;
}

/** Run every parity clause for one listing/offer pair. Never throws. */
export function checkListingParity(
  listing: RawProviderListing,
  offer: CanonicalOffer,
): ParityResult[] {
  const results: ParityResult[] = [];

  const expect = (
    dimension: ParityDimension,
    passes: boolean,
    expected: unknown,
    actual: unknown,
    note: string,
  ) => {
    results.push({ dimension, passes, expected, actual, note });
  };

  expect(
    "provider",
    offer.providerId === listing.providerId,
    listing.providerId,
    offer.providerId,
    "provider identity preserved",
  );

  expect(
    "identity",
    offer.externalOfferId === listing.externalId,
    listing.externalId,
    offer.externalOfferId,
    "provider-native external id preserved",
  );

  expect(
    "title",
    offer.title === listing.title.trim(),
    listing.title.trim(),
    offer.title,
    "title preserved verbatim",
  );

  expect(
    "price",
    Math.abs(offer.price - listing.price) < 1e-9,
    listing.price,
    offer.price,
    "price preserved",
  );

  expect(
    "currency",
    offer.currency === listing.currency,
    listing.currency,
    offer.currency,
    "currency preserved",
  );

  const expectedImage = listing.imageUrl;
  const actualImage = offer.images[0]?.url;
  expect(
    "image",
    actualImage === expectedImage,
    expectedImage,
    actualImage,
    "primary image url preserved",
  );

  expect(
    "url",
    offer.productUrl === listing.productUrl,
    listing.productUrl,
    offer.productUrl,
    "product/affiliate destination url preserved",
  );

  const expectedAvailability: CanonicalOffer["availability"] = listing.inStock
    ? "in_stock"
    : "out_of_stock";
  expect(
    "availability",
    offer.availability === expectedAvailability,
    expectedAvailability,
    offer.availability,
    "stock state mapped one-to-one",
  );

  // Indirect networks (Admitad): the feed merchant IS the store shown.
  const isIndirect = offeringProviderIsIndirect(listing.providerId);
  if (isIndirect) {
    expect(
      "store",
      offer.storeName === listing.storeName,
      listing.storeName,
      offer.storeName,
      "indirect merchant becomes store identity",
    );
  } else {
    expect(
      "store",
      typeof offer.storeName === "string" && offer.storeName.length > 0,
      "non-empty store name from display registry",
      offer.storeName,
      "direct provider store name resolved from display metadata",
    );
  }

  return results;
}

/** All clauses pass? (acceptance-gate, e.g. CI.) */
export function listingParityPasses(
  listing: RawProviderListing,
  offer: CanonicalOffer,
): boolean {
  return checkListingParity(listing, offer).every((r) => r.passes);
}

/**
 * Rejection parity: production drops a listing when these preconditions fail
 * (see lib/search/normalization.ts). The canonical validator MUST also reject
 * them — canonical never accepts what production refuses.
 * Returns the G-code matched for each production-reject condition.
 */
export type RejectCondition =
  | "missing-external-id"
  | "missing-title"
  | "non-positive-price"
  | "missing-http-image"
  | "missing-affiliate-target";

export const CANONICAL_REJECTION_BY_CONDITION: Record<RejectCondition, string[]> = {
  "missing-external-id": ["G1_EXTERNAL_ID_MISSING"],
  "missing-title": ["G2_TITLE_MISSING"],
  "non-positive-price": ["G2_PRICE_INVALID", "G3_PRICE_ABOVE_HARD_CAP"],
  "missing-http-image": ["G2_IMAGE_INVALID", "G3_IMAGE_PLACEHOLDER"],
  "missing-affiliate-target": ["G2_AFFILIATE_TARGET_BAD"],
};

function offeringProviderIsIndirect(providerId: string): boolean {
  // Single source of truth — the registry's acquisition-mode derivation.
  // No provider-specific special casing here: new indirect networks are
  // recognized automatically when they are registered as indirect.
  return providerAcquisitionMode(providerId) === "indirect";
}

/** Human-friendly report of the full parity status. */
export function summarizeParity(results: ParityResult[]): string {
  const failed = results.filter((r) => !r.passes);
  if (failed.length === 0) {
    return `parity PASS (${results.length} clauses)`;
  }
  return (
    `parity FAIL (${failed.length}/${results.length} clauses): ` +
    failed.map((f) => `${f.dimension} (${f.note})`).join(", ")
  );
}