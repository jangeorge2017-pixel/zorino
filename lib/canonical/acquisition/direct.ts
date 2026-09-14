/**
 * DIRECT acquisition layer factory (Phase 5).
 *
 * Direct acquisition = a provider API connector returns product listings
 * directly. The DIRECT layer is a first-class, separate acquisition layer:
 * it adapts provider-native listings through `retargetSearchListing` and
 * produces RawOffers that flow into the SAME canonical convergence
 * (runAcquisition) as the indirect layer.
 *
 * Providers acquired here: AliExpress, eBay, CJdropshipping,
 * and any future direct API connector.
 */

import type { DirectAcquirer } from "@/lib/canonical/acquisition";
import { retargetSearchListing } from "@/lib/canonical/adapters";
import type { RawProviderListing } from "@/lib/search/types";

export interface DirectListingAcquirerOptions {
  /** Provider registry id this acquirer covers. */
  providerId: string;
  /** Strategy label recorded on every canonical offer (e.g. "aliexpress-dpapi"). */
  strategy: string;
  /** Fetches the provider's native listings (the hunt is the caller's job). */
  fetchListings: () => Promise<RawProviderListing[]>;
}

/**
 * Wrap a live search-connector listing source as a concrete DirectAcquirer.
 * Every listing retargets 1:1 into a RawOffer via the shared direct adapter.
 * Listings not belonging to `providerId` are excluded — the layer is scoped to
 * one provider so a foreign listing can never leak into its raw stream.
 */
export function createDirectAcquirer(
  options: DirectListingAcquirerOptions,
): DirectAcquirer {
  return {
    mode: "direct",
    strategy: options.strategy,
    providerId: options.providerId,
    fetchOffers: async () => {
      const listings = await options.fetchListings();
      return listings
        .filter((listing) => listing.providerId === options.providerId)
        .map((listing) => retargetSearchListing(listing));
    },
  };
}