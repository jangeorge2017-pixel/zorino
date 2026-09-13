/**
 * Old-vs-new parity harness — Phase 4.
 *
 * Compares what the LEGACY pipeline publishes vs the CANONICAL pipeline for
 * the SAME inputs, field by field, per surface. Deterministic by design: it
 * runs both paths over captured/injected fixtures (no network), so the runs
 * are reproducible in CI. Optional LIVE mode compares the two runtime paths
 * over live connectors (guarded — only runs when explicitly requested).
 *
 * The canonical pipeline REUSES the legacy assembly/emitters, so on identical
 * accepted inputs the published bytes must match. Divergence is expected and
 * reported ONLY where canonical validation drops an invalid offer (those are
 * the recorded canonical rejections, and they are intentional).
 */

import type {
  NormalizedSearchListing,
  RawProviderListing,
} from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { CompareProductResult } from "@/services/compare";
import { assembleProductionSearchResults } from "@/lib/search/production-pipeline";
import { searchProducts } from "@/lib/search/engine";
import { searchItemToCompareResult } from "@/lib/data/marketplace-product-detail";
import { canonicalSearchProducts } from "./search";
import { canonicalizeSearchListings, canonicalizeCatalogItems, canonicalizeProductDetail } from "./core";
import type { CanonicalSurface } from "./feature";

// ─── shared comparison primitives ─────────────────────────────────────────

export interface FieldParity {
  field: string;
  same: number;
  diff: number;
  missing: number;
  matchRate: number;
}

export interface ItemParity {
  id: string;
  matched: boolean;
  equalLegacyCanonical: boolean;
  diffs: string[];
}

export type ParityVerdict = "pass" | "warn" | "fail";

export interface SurfaceParityReport {
  surface: CanonicalSurface;
  mode: "fixture" | "live";
  runAt: string;
  verdict: ParityVerdict;
  comparedPairs: number;
  itemMatchRate: number;
  perField: FieldParity[];
  itemDiffs: ItemParity[];
  canonicalRejections: number;
  /** compare-only: identical product order once canonical drops are attributed */
  compareOrderMatches?: boolean;
  /** compare-only: total offer count each path published after attribution */
  compareOffers?: { legacy: number; canonical: number };
  /** human summary */
  summary: string;
}

type RecordLike = Record<string, unknown>;

function valueOf(obj: RecordLike, field: string): unknown {
  return obj[field];
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const ka = Object.keys(a as RecordLike);
    const kb = Object.keys(b as RecordLike);
    return (
      ka.length === kb.length &&
      ka.every((key) => deepEqual((a as RecordLike)[key], (b as RecordLike)[key]))
    );
  }
  return false;
}

export function compareItems(
  legacy: readonly RecordLike[],
  canonical: readonly RecordLike[],
  fields: string[],
  idOf: (row: RecordLike) => string,
  skipMissingIds: ReadonlySet<string> = new Set(),
): Pick<SurfaceParityReport, "comparedPairs" | "itemMatchRate" | "perField" | "itemDiffs"> {
  const legacyById = new Map(legacy.map((row) => [idOf(row), row] as const));
  const canonicalById = new Map(canonical.map((row) => [idOf(row), row] as const));

  const explainedMissing = new Set<string>();
  for (let index = legacy.length - 1; index >= 0; index--) {
    const row = legacy[index];
    const id = idOf(row);
    if (!canonicalById.has(id) && skipMissingIds.has(id)) explainedMissing.add(id);
  }

  const itemDiffs: ItemParity[] = [];
  for (const [id, legacyRow] of legacyById) {
    const canonicalRow = canonicalById.get(id);
    if (!canonicalRow && explainedMissing.has(id)) continue;
    const item: ItemParity = { id, matched: Boolean(canonicalRow), equalLegacyCanonical: true, diffs: [] };
    if (!canonicalRow) {
      item.equalLegacyCanonical = false;
      item.diffs.push("<missing from canonical>");
    } else {
      for (const field of fields) {
        if (!deepEqual(valueOf(legacyRow, field), valueOf(canonicalRow, field))) {
          item.equalLegacyCanonical = false;
          item.diffs.push(field);
        }
      }
    }
    itemDiffs.push(item);
  }
  for (const id of canonicalById.keys()) {
    if (!legacyById.has(id)) {
      itemDiffs.push({ id, matched: false, equalLegacyCanonical: false, diffs: ["<extra in canonical>"] });
    }
  }

  const comparedPairs = itemDiffs.length;
  const matched = itemDiffs.filter((item) => item.matched).length;
  const itemMatchRate = comparedPairs > 0 ? matched / comparedPairs : 1;

  const perField: FieldParity[] = fields.map((field) => {
    let same = 0;
    let diff = 0;
    let missing = 0;
    for (const item of itemDiffs) {
      if (!item.matched) {
        missing += 1;
        continue;
      }
      if (item.diffs.includes(field)) diff += 1;
      else same += 1;
    }
    const total = same + diff + missing;
    return {
      field,
      same,
      diff,
      missing,
      matchRate: total > 0 ? same / total : 1,
    };
  });

  return { comparedPairs, itemMatchRate, perField, itemDiffs };
}

// ─── SEARCH parity ────────────────────────────────────────────────────────

export const SEARCH_PARITY_FIELDS = [
  "name",
  "imageSrc",
  "price",
  "originalPrice",
  "discount",
  "store",
  "storeSlug",
  "rating",
  "reviewCount",
  "inStock",
  "category",
  "affiliateUrl",
] as const;

export function createSearchParityReport(
  surface: CanonicalSurface,
  mode: "fixture" | "live",
  legacy: readonly SearchResultItem[],
  canonical: readonly SearchResultItem[],
  canonicalRejections: number,
  skipMissingIds: ReadonlySet<string> = new Set(),
): SurfaceParityReport {
  const comparison = compareItems(
    legacy,
    canonical,
    [...SEARCH_PARITY_FIELDS],
    (row) => row.id as string,
    skipMissingIds,
  );
  const itemMatchRate = comparison.itemMatchRate;
  const fieldRates = comparison.perField.map((f) => f.matchRate);
  return {
    surface,
    mode,
    runAt: new Date().toISOString(),
    verdict:
      itemMatchRate === 1 && fieldRates.every((r) => r >= 0.999999)
        ? "pass"
        : itemMatchRate >= 0.9
          ? "warn"
          : "fail",
    ...comparison,
    canonicalRejections,
    summary:
      `search ${mode}: ${comparison.itemDiffs.length} items compared, id-match ` +
      `${(itemMatchRate * 100).toFixed(1)}%, canonical rejections ${canonicalRejections}`,
  };
}

/**
 * Deterministic SEARCH parity over identical fixture listings (no network).
 * Runs legacy assembly vs canonical assembly on the same raw input. Listings
 * the canonical gate drops are attributed (not counted as divergences); the
 * accepted sets must still emit byte-identical results.
 */
export function runSearchFixtureParity(
  query: string,
  fixtureListings: readonly NormalizedSearchListing[],
  limit = 50,
): SurfaceParityReport {
  const ranked = [...fixtureListings];
  const legacy = assembleProductionSearchResults(ranked as RawProviderListing[], query, limit);

  const canonical = canonicalizeSearchListings(ranked);
  const canonicalItems = assembleProductionSearchResults(
    canonical.accepted as unknown as RawProviderListing[],
    query,
    limit,
  );

  // The emitter re-normalizes each listing into `${providerId}-${externalId}`,
  // so attribute drops by that same id (canonical rejections are expected drops).
  const rejectedIds = new Set(
    canonical.rejected.map(
      (r) => `${r.listing.providerId}-${r.listing.externalId}`,
    ),
  );
  return createSearchParityReport(
    "search",
    "fixture",
    legacy,
    canonicalItems,
    canonical.rejected.length,
    rejectedIds,
  );
}

/**
 * LIVE SEARCH parity — requires provider credentials + a network. Only runs
 * when explicitly requested via CANONICAL_PARITY_LIVE=1 to keep CI hermetic.
 */
export async function runSearchLiveParity(
  query: string,
): Promise<SurfaceParityReport> {
  const [legacy, canonical] = await Promise.all([
    searchProducts(query, 50),
    canonicalSearchProducts(query, 50),
  ]);
  return createSearchParityReport("search", "live", legacy, canonical, 0);
}

// ─── HOMEPAGE parity ──────────────────────────────────────────────────────

export const CATALOG_PARITY_FIELDS = [
  "id",
  "title",
  "imageUrl",
  "price",
  "originalPrice",
  "discount",
  "currency",
  "countryCode",
  "rating",
  "reviewCount",
] as const;

export function runCatalogFixtureParity(
  items: readonly NormalizedCatalogItem[],
): SurfaceParityReport {
  const legacy = [...items];
  const outcome = canonicalizeCatalogItems(items);
  const deliveredIds = new Set(outcome.items.map((item) => item.id));
  const droppedIds = new Set(
    legacy.filter((item) => !deliveredIds.has(item.id)).map((item) => item.id),
  );
  const comparison = compareItems(
    legacy as unknown as RecordLike[],
    outcome.items as unknown as RecordLike[],
    [...CATALOG_PARITY_FIELDS],
    (row) => row.id as string,
    droppedIds,
  );
  const itemMatchRate = comparison.itemMatchRate;
  const hasDrops = outcome.droppedItems > 0 || outcome.rejectedOffers > 0;
  return {
    surface: "homepage",
    mode: "fixture",
    runAt: new Date().toISOString(),
    verdict:
      !hasDrops &&
      itemMatchRate === 1 &&
      comparison.perField.every((f) => f.matchRate >= 0.999999)
        ? "pass"
        : itemMatchRate >= 0.9
          ? "warn"
          : "fail",
    ...comparison,
    canonicalRejections: outcome.rejectedOffers + outcome.droppedItems,
    summary:
      `homepage fixture: ${legacy.length} items, ${(itemMatchRate * 100).toFixed(1)}% id-match, ` +
      `dropped ${outcome.droppedItems}, rejected offers ${outcome.rejectedOffers}`,
  };
}

// ─── COMPARE parity ───────────────────────────────────────────────────────

/**
 * Compare output contract — every published field the /compare page carries
 * downstream, flattened so divergences are attributed per concept:
 *  - canonical product identity          → productId / productName / productSlug
 *  - summary stats                       → lowestPrice, highestPrice, highestDiscount,
 *                                         savingsVsHighest, savingsPercent, providerCount,
 *                                         cheapestStoreName, highestDiscountStoreName
 *  - store/provider identity + offers    → offers[]
 *  - prices / currency                   → offers[].price / .originalPrice / .currency
 *  - stock state                         → offers[].inStock
 *  - product/affiliate destinations      → offers[].externalUrl
 *  - flags                               → offers[].discountPercent / .isLowest / .isHighestDiscount
 *  - ordering / balancing                → offers[] array order (deep-equal) + product order
 *
 * `offers` is deep-compared as ONE field, which also enforces "no false
 * cross-store matches" and "no missing legitimate offers" by exact multiset
 * equality (store slug/name + provider identity per offer).
 */
export const COMPARE_PARITY_FIELDS = [
  "productId",
  "productName",
  "productSlug",
  "lowestPrice",
  "highestPrice",
  "highestDiscount",
  "savingsVsHighest",
  "savingsPercent",
  "providerCount",
  "cheapestStoreName",
  "highestDiscountStoreName",
  "offers",
] as const;

function toCompareContract(result: CompareProductResult): RecordLike {
  const { product, offers } = result;
  const offerContract = offers.map((o) => ({
    id: o.id,
    productId: o.productId,
    provider: o.provider,
    storeId: o.storeId,
    storeSlug: o.store?.slug ?? null,
    storeName: o.store?.name ?? null,
    price: o.price,
    originalPrice: o.originalPrice ?? null,
    currency: o.currency,
    countryCode: o.countryCode ?? null,
    inStock: o.inStock,
    externalUrl: o.externalUrl ?? null,
    discountPercent: o.discountPercent,
    isLowest: o.isLowest ?? false,
    isHighestDiscount: o.isHighestDiscount ?? false,
  }));
  return {
    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    lowestPrice: result.lowestPrice,
    highestPrice: result.highestPrice,
    highestDiscount: result.highestDiscount,
    savingsVsHighest: result.savingsVsHighest,
    savingsPercent: result.savingsPercent,
    providerCount: result.providerCount,
    cheapestStoreName: result.cheapestStoreName,
    highestDiscountStoreName: result.highestDiscountStoreName,
    offers: offerContract,
  };
}

/**
 * Full old-vs-new COMPARE parity over the same curated normalized listings.
 * Both paths run the exact /compare assembly: assembleProductionSearchResults
 * (balancing) → searchItemToCompareResult (single real offer per product) with
 * enrichment frozen out identically on both sides. Canonical drops are
 * attributed (skipMissingIds on the emitted id) — accepted products must be
 * byte-identical in identity, store, offers, prices/currency, stock,
 * destinations, flags, ordering and balancing.
 */
export function runCompareFixtureParity(
  query: string,
  fixtureListings: readonly NormalizedSearchListing[],
  limit = 50,
): SurfaceParityReport {
  const assembleToCompare = (pool: readonly NormalizedSearchListing[], q: string) =>
    assembleProductionSearchResults(pool as unknown as RawProviderListing[], q, limit)
      .slice(0, limit)
      .map(searchItemToCompareResult);

  const legacy = assembleToCompare(fixtureListings, query);
  const outcome = canonicalizeSearchListings(fixtureListings);
  const canonical = assembleToCompare(outcome.accepted, query);

  const rejectedIds = new Set(
    outcome.rejected.map((r) => `${r.listing.providerId}-${r.listing.externalId}`),
  );
  const comparison = compareItems(
    legacy.map(toCompareContract),
    canonical.map(toCompareContract),
    [...COMPARE_PARITY_FIELDS],
    (row) => row.productId as string,
    rejectedIds,
  );

  const legacySeq = legacy
    .filter((r) => !rejectedIds.has(r.product.id))
    .map((r) => r.product.id);
  const canonicalSeq = canonical.map((r) => r.product.id);
  const compareOrderMatches =
    legacySeq.length === canonicalSeq.length &&
    legacySeq.every((id, index) => id === canonicalSeq[index]);

  const offerCount = (results: CompareProductResult[]) =>
    results
      .filter((r) => !rejectedIds.has(r.product.id))
      .reduce((n, r) => n + r.offers.length, 0);
  const legacyOffers = offerCount(legacy);
  const canonicalOffers = offerCount(canonical);
  const offersEqual = legacyOffers === canonicalOffers;

  const rate = comparison.itemMatchRate;
  const pass =
    rate === 1 &&
    comparison.perField.every((f) => f.matchRate >= 0.999999) &&
    compareOrderMatches &&
    offersEqual;
  return {
    surface: "compare",
    mode: "fixture",
    runAt: new Date().toISOString(),
    verdict: pass ? "pass" : rate >= 0.9 ? "warn" : "fail",
    ...comparison,
    canonicalRejections: outcome.rejected.length,
    compareOrderMatches,
    compareOffers: { legacy: legacyOffers, canonical: canonicalOffers },
    summary:
      `compare fixture: ${legacy.length - rejectedIds.size} of ${legacy.length} products matched, ` +
      `contract parity ${(rate * 100).toFixed(1)}%, order ${compareOrderMatches ? "same" : "DIFF"}, ` +
      `offers ${legacyOffers} vs ${canonicalOffers}, canonical rejections ${outcome.rejected.length}`,
  };
}

// ─── PDP parity ───────────────────────────────────────────────────────────

export interface PdpDetailFacade {
  id: string;
  offersCount: number;
  lowestPrice: number;
  providerCount: number;
  cheapestStoreName: string;
}

export function facadeFromDetail(detail: { id?: string; comparison?: CompareProductResult & { offers: unknown[] } }): PdpDetailFacade {
  const comparison = detail.comparison;
  return {
    id: detail.id ?? "",
    offersCount: comparison?.offers?.length ?? 0,
    lowestPrice: comparison?.lowestPrice ?? 0,
    providerCount: comparison?.providerCount ?? 0,
    cheapestStoreName: comparison?.cheapestStoreName ?? "",
  };
}

export function runPdpFixtureParity(
  detail: Parameters<typeof canonicalizeProductDetail>[0],
): SurfaceParityReport {
  const legacyFacade = facadeFromDetail(detail as unknown as { comparison?: CompareProductResult & { offers: unknown[] } });
  const outcome = canonicalizeProductDetail(detail);
  const canonicalFacade = facadeFromDetail(outcome.detail as unknown as { comparison?: CompareProductResult & { offers: unknown[] } });
  const fields = ["id", "offersCount", "lowestPrice", "providerCount", "cheapestStoreName"] as const;
  const diffs = fields.filter((field) => legacyFacade[field] !== canonicalFacade[field]);
  const same = fields.length - diffs.length;
  const rate = diffs.length === 0 ? 1 : same / fields.length;
  return {
    surface: "pdp",
    mode: "fixture",
    runAt: new Date().toISOString(),
    verdict:
      rate === 1
        ? "pass"
        : outcome.rejectedOfferIds.length > 0
          ? "warn"
          : "fail",
    comparedPairs: outcome.offersTotal,
    itemMatchRate: rate,
    perField: fields.map((field) => ({
      field,
      same: legacyFacade[field] === canonicalFacade[field] ? 1 : 0,
      diff: legacyFacade[field] === canonicalFacade[field] ? 0 : 1,
      missing: 0,
      matchRate: legacyFacade[field] === canonicalFacade[field] ? 1 : 0,
    })),
    itemDiffs: diffs.length
      ? [{ id: legacyFacade.id, matched: true, equalLegacyCanonical: false, diffs: [...diffs] }]
      : [{ id: legacyFacade.id, matched: true, equalLegacyCanonical: true, diffs: [] }],
    canonicalRejections: outcome.rejectedOfferIds.length,
    summary:
      `pdp fixture: ${outcome.offersTotal} offers, rejected ${outcome.rejectedOfferIds.length}, ` +
      `summary parity ${(rate * 100).toFixed(1)}%`,
  };
}