/**
 * Acquisition layer — DIRECT and INDIRECT pipelines converge here (Phase 1).
 *
 *  DIRECT:   provider API → adapter → RawOffer[]  (strategy: "api")
 *  INDIRECT: link/feed strategy → adapter → available data → RawOffer[]
 *            (strategy: e.g. "admitad-feed")
 *
 * Both paths produce RawOffer[], then flow through the SAME canonical
 * convergence: validate → canonicalize → group into CanonicalProduct[]. No
 * runtime code calls this yet (ARCH_CANONICAL default off).
 */

import type {
  CanonicalOffer,
  CanonicalProduct,
  OfferValidationResult,
  RawOffer,
} from "@/lib/canonical/types";
import type { ValidationProfile } from "@/lib/canonical/validation";
import {
  canonicalizeOffer,
  groupOffersIntoProducts,
  mergeProductBatches,
} from "@/lib/canonical/pipeline";

export interface DirectAcquirer {
  readonly mode: "direct";
  /** e.g. "aliexpress-dpapi", "ebay-browse" */
  readonly strategy: string;
  fetchOffers: () => Promise<RawOffer[]>;
}

export interface IndirectAcquirer {
  readonly mode: "indirect";
  /** e.g. "admitad-feed", "url-ingestion" */
  readonly strategy: string;
  fetchOffers: () => Promise<RawOffer[]>;
}

export type AnyAcquirer = DirectAcquirer | IndirectAcquirer;

export interface AcquisitionRunResult {
  products: CanonicalProduct[];
  offers: CanonicalOffer[];
  rejected: OfferValidationResult[];
  /** counts, for telemetry in the health/observability plane. */
  counts: {
    acquired: number;
    accepted: number;
    rejected: number;
    products: number;
  };
}

export interface AcquisitionOptions {
  /** Validation profile applied to every raw offer in this run. */
  profile?: ValidationProfile;
}

/**
 * Acquire from either a DIRECT or INDIRECT acquirer and converge both into
 * canonical products. Pure convergence — no persistence/UI here.
 */
export async function runAcquisition(
  acquirer: AnyAcquirer,
  options: AcquisitionOptions = {},
): Promise<AcquisitionRunResult> {
  const rawOffers = await acquirer.fetchOffers();

  const accepted: CanonicalOffer[] = [];
  const rejected: OfferValidationResult[] = [];

  for (const raw of rawOffers) {
    const outcome = canonicalizeOffer(raw, {
      profile: options.profile,
      strategy: acquirer.strategy,
    });
    if (outcome.offer) {
      accepted.push(outcome.offer);
    } else {
      rejected.push(outcome.validation);
    }
  }

  const products = groupOffersIntoProducts(accepted);

  return {
    products,
    offers: accepted,
    rejected,
    counts: {
      acquired: rawOffers.length,
      accepted: accepted.length,
      rejected: rejected.length,
      products: products.length,
    },
  };
}

/** Options shared by every layer in a full acquisition run. */
export type RunAllAcquisitionOptions = AcquisitionOptions;

/**
 * Run the FULL acquisition fan-out across every concrete layer — the DIRECT
 * and INDIRECT acquirers run in parallel and their accepted offers converge
 * through the SAME grouping/merging used by the rest of the spine.
 * Returns ONE merged result: ACQUISITION layers stay separate, the PIPELINE
 * is shared. Pure convergence — no persistence/UI here.
 */
export async function runAllAcquisition(
  acquirers: AnyAcquirer[],
  options: RunAllAcquisitionOptions = {},
): Promise<AcquisitionRunResult> {
  const runs = await Promise.all(
    acquirers.map((acquirer) => runAcquisition(acquirer, options)),
  );

  const products = mergeProductBatches(runs.map((run) => run.products));
  const offers = runs.flatMap((run) => run.offers);
  const rejected = runs.flatMap((run) => run.rejected);

  return {
    products,
    offers,
    rejected,
    counts: {
      acquired: runs.reduce((n, run) => n + run.counts.acquired, 0),
      accepted: runs.reduce((n, run) => n + run.counts.accepted, 0),
      rejected: runs.reduce((n, run) => n + run.counts.rejected, 0),
      products: products.length,
    },
  };
}

/** Report string used at onboarding/acceptance gate milestones. */
export function summarizeRun(result: AcquisitionRunResult): string {
  return (
    `mode acquirer -> ${result.counts.acquired} raw, ` +
    `${result.counts.accepted} accepted, ${result.counts.rejected} rejected, ` +
    `${result.counts.products} canonical products`
  );
}