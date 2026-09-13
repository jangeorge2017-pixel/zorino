/**
 * INDIRECT acquisition layer factory (Phase 5).
 *
 * Indirect acquisition = discovery through an affiliate/feed NETWORK (Admitad
 * today, any future network). The INDIRECT layer is a first-class, separate
 * acquisition layer: every feed offer is adapted through the ONE uniform
 * indirect adapter (`retargetIndirectFeedOffer`) into RawOffers that flow into
 * the SAME canonical convergence (runAcquisition) as the direct layer.
 *
 * No provider-specific code lives in this factory — a new indirect network
 * only supplies feed sources conforming to the neutral `IndirectFeedOffer`
 * shape.
 */

import type { IndirectAcquirer } from "@/lib/canonical/acquisition";
import {
  retargetIndirectFeedOffer,
  type IndirectFeedMeta,
  type IndirectFeedOffer,
} from "@/lib/canonical/adapters";

export interface IndirectFeedSource {
  /** Merchant display name (the store the user sees). */
  feedName: string;
  /** Namespace for this merchant's offers (e.g. feed slug). */
  feedSlug: string;
  offers: IndirectFeedOffer[];
}

export interface IndirectFeedAcquirerOptions {
  /** Provider registry id of the network (e.g. "admitad"). */
  providerId: string;
  /** Strategy label recorded on every canonical offer (e.g. "admitad-feed"). */
  strategy: string;
  /** Fetches the network's merchant feeds (the hunt is the caller's job). */
  fetchFeeds: () => Promise<IndirectFeedSource[]>;
  /** Optional prefix for the per-feed source trace (e.g. "feed"). */
  sourceRefPrefix?: string;
}

/**
 * Wrap a live feed-source fetcher as a concrete IndirectAcquirer.
 * Each merchant feed's offers retarget through the uniform indirect adapter,
 * preserving merchant identity and marking every offer affiliate-trackable.
 */
export function createIndirectFeedAcquirer(
  options: IndirectFeedAcquirerOptions,
): IndirectAcquirer {
  return {
    mode: "indirect",
    strategy: options.strategy,
    fetchOffers: async () => {
      const feeds = await options.fetchFeeds();
      const offers: import("@/lib/canonical/types").RawOffer[] = [];
      for (const feed of feeds) {
        const meta: IndirectFeedMeta = {
          providerId: options.providerId,
          merchantName: feed.feedName,
          sourceRef: options.sourceRefPrefix
            ? `${options.sourceRefPrefix}:${feed.feedSlug}`
            : undefined,
        };
        for (const offer of feed.offers) {
          offers.push(retargetIndirectFeedOffer(offer, meta));
        }
      }
      return offers;
    },
  };
}