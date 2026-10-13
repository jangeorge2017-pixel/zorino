/**
 * Admitad → uniform indirect adapter bridge (Phase 5).
 *
 * The ONLY place Admitad's native feed row (`AdmitadFeedOffer`) becomes the
 * neutral indirect shape (`IndirectFeedOffer`) / a canonical `RawOffer`. Both
 * the live catalog emitter (index.ts) and the DB ingestion emitter
 * (ingestion.ts) consume this single mapping, so the provider-specific field
 * adaptation lives in exactly one file — everything downstream is generic.
 */

import type { AdmitadFeedOffer } from "./types";
import type { RawOffer } from "@/lib/canonical/types";
import {
  createIndirectFeedAcquirer,
  retargetIndirectFeedOffer,
  type IndirectFeedMeta,
  type IndirectFeedOffer,
} from "@/lib/canonical";
import { DEFAULT_COUNTRY } from "@/lib/international/config";
import { resolveCountryForCurrency } from "@/lib/integration/catalog-scope";
import { ADMITAD_PROVIDER_ID } from "./config";

/**
 * Adapt ONE native Admitad feed offer into the neutral indirect feed shape
 * the uniform indirect adapter consumes. Field names become provider-agnostic
 * here — the canonical spine below this bridge knows nothing about Admitad.
 *
 * Market binding: the offer's market is NEVER hardcoded. It comes from the
 * caller's real signal (the merchant program's declared GEO / the offer's
 * currency), falling back to the offer currency's home market and only then to
 * the catalog default — so an EGP/SAR/AED offer is bound to EG/SA/AE instead of
 * being mislabeled US.
 */
export function admitadFeedToIndirectFeedOffer(
  offer: AdmitadFeedOffer,
  options?: { countryCode?: string },
): IndirectFeedOffer {
  return {
    id: offer.id,
    title: offer.name,
    price: offer.price,
    currency: offer.currencyId,
    url: offer.url,
    brand: offer.vendor || undefined,
    imageUrl: offer.image || undefined,
    originalPrice: offer.oldprice ?? undefined,
    countryCode:
      options?.countryCode ??
      resolveCountryForCurrency(offer.currencyId) ??
      DEFAULT_COUNTRY,
  };
}

export interface AdmitadFeedToRawMeta {
  /** Merchant display name (the store the user sees). */
  merchantName: string;
  /** Source trace, e.g. `feed:ajazz` — telemetry only. */
  sourceRef?: string;
  /** Override the deep-link when the offer URL is empty (e.g. gotolink). */
  urlOverride?: string;
  /** ISO timestamp of acquisition; defaulted at canonicalize time. */
  fetchedAt?: string;
  /**
   * Real market country the caller resolved for this offer (from the merchant
   * program's GEO/currency). When omitted, the offer currency's home market is
   * used. Never fabricated.
   */
  countryCode?: string;
}

/**
 * Map ONE Admitad feed offer through the UNIFORM indirect adapter into a
 * canonical RawOffer. `merchantName` is the feed/campaign merchant — the store
 * identity shown for indirect networks; every offer is affiliate-trackable.
 */
export function admitadFeedToRawOffer(
  offer: AdmitadFeedOffer,
  meta: AdmitadFeedToRawMeta,
): RawOffer {
  const neutral = admitadFeedToIndirectFeedOffer(offer, {
    countryCode: meta.countryCode,
  });
  const destinationUrl = meta.urlOverride || neutral.url;
  const feedMeta: IndirectFeedMeta = {
    providerId: ADMITAD_PROVIDER_ID,
    merchantName: meta.merchantName,
    sourceRef: meta.sourceRef,
    fetchedAt: meta.fetchedAt,
  };
  return retargetIndirectFeedOffer(
    { ...neutral, url: destinationUrl },
    feedMeta,
  );
}

/**
 * Acquire the whole Admitad network as an INDIRECT acquisition layer.
 * Real merchant feeds (from the shared discovery registry) stream through the
 * uniform indirect adapter into the SAME canonical convergence used by every
 * direct provider. Not wired into production page paths — the canonical
 * pipeline is ARCH_CANONICAL-gated — but this is the concrete "Admitad in the
 * uniform indirect adapter" entry point.
 */
export function createAdmitadFeedAcquirer(options: {
  strategy?: string;
  maxFeeds?: number;
  maxProductsPerFeed?: number;
} = {}): ReturnType<typeof createIndirectFeedAcquirer> {
  return createIndirectFeedAcquirer({
    providerId: ADMITAD_PROVIDER_ID,
    strategy: options.strategy ?? "admitad-feed",
    sourceRefPrefix: "feed",
    fetchFeeds: async () => {
      const { fetchAdmitadFeedProducts } = await import("./feed-fetcher");
      const feeds = await fetchAdmitadFeedProducts({
        maxFeeds: options.maxFeeds,
        maxProductsPerFeed: options.maxProductsPerFeed,
      });
      return feeds.map((feed) => ({
        feedName: feed.feedName,
        feedSlug: feed.feedSlug,
        offers: feed.offers.map((offer) => admitadFeedToIndirectFeedOffer(offer)),
      }));
    },
  });
}