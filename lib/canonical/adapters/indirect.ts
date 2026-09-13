/**
 * Uniform INDIRECT adapter (Phase 5).
 *
 * Indirect acquisition = product discovery through an affiliate/feed NETWORK
 * (Admitad today, any future network) where the network hands us a merchant's
 * deep-link and whatever data the merchant's feed describes. The merchant —
 * not the network — is the store the user sees.
 *
 * The rest of the spine treats "indirect" as FIRST-CLASS and orthogonal to
 * the direct API path, so every indirect source must enter the canonical
 * pipeline through ONE uniform adapter: `retargetIndirectFeedOffer`.
 *
 *  Directive: "Direct providers and indirect providers must remain separate
 *  acquisition layers feeding the same canonical pipeline. Migrate Admitad
 *  into the uniform indirect adapter."
 *
 * This module defines the neutral indirect feed offer shape (`IndirectFeedOffer`)
 * that any indirect network can conform to, plus the single mapping function.
 * Pure, deterministic, never throws, never fabricates data.
 */

import type { RawOffer } from "@/lib/canonical/types";

/**
 * The neutral shape a feed/network adapter produces for ONE merchant offer.
 * Field names are provider-agnostic so a new indirect network only adapts its
 * own raw rows into this shape — no provider-specific mapping in the spine.
 */
export interface IndirectFeedOffer {
  /** Network/feed-native offer id. REQUIRED for identity. */
  id: string;
  title: string;
  /** Current price. */
  price: number;
  currency: string;
  /** Merchant deep-link (affiliate URL) handed over by the network. */
  url: string;
  /** Merchant/vendor name when the feed carries it (raw, pre-identity). */
  brand?: string;
  /** Market-facing display name of the merchant (label the user sees). */
  merchantName?: string;
  imageUrl?: string;
  originalPrice?: number;
  countryCode?: string;
  category?: string;
  inStock?: boolean;
  /** @deprecated use merchantName — kept for legacy feed rows. */
  vendor?: string;
}

export interface IndirectFeedMeta {
  /** Provider registry id of the network (e.g. "admitad"). REQUIRED. */
  providerId: string;
  /** Merchant display name (the store the user sees). */
  merchantName?: string;
  /** Source trace, e.g. `feed:<feedSlug>` — telemetry only. */
  sourceRef?: string;
  /** ISO timestamp of acquisition; defaulted at canonicalize time. */
  fetchedAt?: string;
}

/**
 * Map ONE indirect feed offer into a canonical RawOffer.
 *
 * - acquisition is ALWAYS "indirect" (the layer the offer entered through).
 * - merchantName is the feed's merchant (crafted by the caller via
 *   `IndirectFeedOffer.merchantName` or `IndirectFeedMeta` context) — the
 *   store identity shown for indirect networks.
 * - affiliateUrl equals the network deep-link and is TRACKABLE by
 *   construction (a property of the network link channel, not invented data).
 * - originalPrice is preserved only when genuinely above price (G4 semantics).
 */
export function retargetIndirectFeedOffer(
  offer: IndirectFeedOffer,
  meta: IndirectFeedMeta,
): RawOffer {
  const originalPrice =
    offer.originalPrice != null && Number.isFinite(offer.originalPrice) &&
    offer.originalPrice > offer.price && offer.originalPrice - offer.price > 1e-9
      ? offer.originalPrice
      : undefined;

  return {
    providerId: meta.providerId,
    externalOfferId: String(offer.id).trim() || String(offer.id),
    acquisition: "indirect",
    sourceRef: meta.sourceRef,
    merchantName:
      offer.merchantName?.trim() ||
      meta.merchantName?.trim() ||
      undefined,
    title: offer.title,
    brand: offer.brand ?? offer.vendor ?? undefined,
    price: offer.price,
    originalPrice,
    currency: offer.currency,
    images: offer.imageUrl ? [{ url: offer.imageUrl }] : [],
    productUrl: offer.url,
    affiliateUrl: offer.url,
    affiliateTrackable: true,
    availability: offer.inStock === false ? "out_of_stock" : "in_stock",
    category: offer.category,
    countryCode: offer.countryCode,
    fetchedAt: meta.fetchedAt,
  };
}