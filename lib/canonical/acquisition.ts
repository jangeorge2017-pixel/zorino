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
  AcquisitionMode,
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
  /** Provider registry id this acquirer covers (set by the factories). */
  readonly providerId?: string;
  fetchOffers: () => Promise<RawOffer[]>;
}

export interface IndirectAcquirer {
  readonly mode: "indirect";
  /** e.g. "admitad-feed", "url-ingestion" */
  readonly strategy: string;
  /** Provider registry id this acquirer covers (set by the factories). */
  readonly providerId?: string;
  fetchOffers: () => Promise<RawOffer[]>;
}

export type AnyAcquirer = DirectAcquirer | IndirectAcquirer;

/**
 * A single acquirer failure as EVIDENCE. Neg/empty/timeout/429 must surface
 * here — never as fabricated offers. Populated on the `failures` array of the
 * run result so one broken layer never suppresses unrelated providers.
 */
export interface ProviderAcquirerFailure {
  /** Provider id (when the acquirer declares one). */
  providerId?: string;
  mode: AcquisitionMode;
  strategy: string;
  /** How many offers were acquired before the failure (0 for hard fetch error). */
  acquiredCount: number;
  /** Short machine code for telemetry, e.g. "timeout" | "rate-limited" | "fetch-failed". */
  code: "timeout" | "rate-limited" | "fetch-failed" | "unknown";
  /** Human-readable failure detail. */
  error: string;
}

export interface AcquisitionRunResult {
  products: CanonicalProduct[];
  offers: CanonicalOffer[];
  rejected: OfferValidationResult[];
  /**
   * Layer/boundary evidence of acquirers that FAULTED. Failure-isolation
   * contract: providers that failed are recorded here and never leak into
   * offers/products; every other layer continues independently.
   */
  failures: ProviderAcquirerFailure[];
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
 * Classify a thrown error into a compact failure evidence code.
 * timeout/empty/429 are represented as provider health evidence, not offers.
 */
function failureCodeFor(error: unknown): ProviderAcquirerFailure["code"] {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed out|abort/i.test(message)) return "timeout";
  if (/429|rate.?limit/i.test(message)) return "rate-limited";
  // An acquirer that returns without raising still yields an "unknown"-free,
  // zero-count run — empty acquisition is separate evidence via counts.
  return /fetch|failed|error/i.test(message) ? "fetch-failed" : "unknown";
}

/** Build the failure-isolated result for a hard acquirer fault. Never throws. */
function failedAcquisitionRun(
  acquirer: AnyAcquirer,
  error: unknown,
): AcquisitionRunResult {
  const failures: ProviderAcquirerFailure[] = [
    {
      providerId: acquirer.providerId,
      mode: acquirer.mode,
      strategy: acquirer.strategy,
      acquiredCount: 0,
      code: failureCodeFor(error),
      error: error instanceof Error ? error.message : String(error),
    },
  ];
  return {
    products: [],
    offers: [],
    rejected: [],
    failures,
    counts: { acquired: 0, accepted: 0, rejected: 0, products: 0 },
  };
}

/** Fallback failure record for an acquirer that faults before reporting. */
function unknownAcquirerFailure(error: unknown): AcquisitionRunResult {
  const failures: ProviderAcquirerFailure[] = [
    {
      mode: "direct",
      strategy: "unknown",
      acquiredCount: 0,
      code: failureCodeFor(error),
      error: error instanceof Error ? error.message : String(error),
    },
  ];
  return {
    products: [],
    offers: [],
    rejected: [],
    failures,
    counts: { acquired: 0, accepted: 0, rejected: 0, products: 0 },
  };
}

/**
 * Acquire from either a DIRECT or INDIRECT acquirer and converge both into
 * canonical products. Pure convergence — no persistence/UI here.
 *
 * Failure isolation: a faulting fetchOffers NEVER throws out of this boundary.
 * The acquirer fault is recorded as `failures` evidence (timeout / 429 /
 * request failure) and the offered/accepted counts stay 0 — no fake offers.
 */
export async function runAcquisition(
  acquirer: AnyAcquirer,
  options: AcquisitionOptions = {},
): Promise<AcquisitionRunResult> {
  let rawOffers: RawOffer[];
  try {
    rawOffers = await acquirer.fetchOffers();
  } catch (error) {
    return failedAcquisitionRun(acquirer, error);
  }

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
    failures: [],
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
 *
 * Failure isolation: layers run via allSettled. One provider faulting
 * (timeout / 429 / request failure / invalid acquirer) is recorded as
 * `failures` evidence and CANNOT suppress the other layers' offers.
 */
export async function runAllAcquisition(
  acquirers: AnyAcquirer[],
  options: RunAllAcquisitionOptions = {},
): Promise<AcquisitionRunResult> {
  const settled = await Promise.allSettled(
    acquirers.map((acquirer) => runAcquisition(acquirer, options)),
  );

  const runs: AcquisitionRunResult[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      runs.push(outcome.value);
    } else {
      // Defensive: runAcquisition never throws, but never let one layer
      // suppress the others even if it somehow does.
      runs.push(unknownAcquirerFailure(outcome.reason));
    }
  }

  const products = mergeProductBatches(runs.map((run) => run.products));
  const offers = runs.flatMap((run) => run.offers);
  const rejected = runs.flatMap((run) => run.rejected);
  const failures = runs.flatMap((run) => run.failures);

  return {
    products,
    offers,
    rejected,
    failures,
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
  const failureTail =
    result.failures.length > 0
      ? `, ${result.failures.length} provider failures`
      : "";
  return (
    `mode acquirer -> ${result.counts.acquired} raw, ` +
    `${result.counts.accepted} accepted, ${result.counts.rejected} rejected, ` +
    `${result.counts.products} canonical products${failureTail}`
  );
}