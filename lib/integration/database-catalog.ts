/**
 * Bridge between the Supabase product catalog (imported by cron sync jobs)
 * and the NormalizedCatalogItem / SearchResultItem formats used by the
 * unified homepage feed and global search engine.
 *
 * Reads from `lowest_prices_today` joined with `products` to get category
 * metadata. Returns NormalizedCatalogItems that feed every homepage section,
 * the /deals page, the Hero orbit, and the search engine's DB fallback.
 */

import {
  createSupabaseAnonClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";
import type { NormalizedCatalogItem, ProviderOffer } from "@/lib/integration/catalog-types";
import type { ProductionProviderId } from "@/lib/integration/constants";
import type { SearchResultItem } from "@/lib/data/homepage";
import {
  normalizeProductImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/images/product-image";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";
import { LIVE_PROVIDER_IDS } from "@/lib/providers/registry";
import {
  buildWordBoundaryOrFilter,
  escapeRegexToken,
} from "@/lib/integration/word-match-filter";
import {
  CATALOG_COUNT_FRESHNESS_MS,
  getCatalogCount,
  getCatalogCountAgeMs,
  setCatalogCount,
} from "@/lib/integration/catalog-count";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

/** True when `token` appears in `hay` as a whole word (not a substring). */
function wordInTitle(hay: string, token: string): boolean {
  const esc = escapeRegexToken(token);
  return new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`, "i").test(hay);
}

type LowestPriceRow = {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  image_url: string;
  emoji: string | null;
  lowest_price: number;
  original_price: number | null;
  discount_percent: number;
  store_name: string;
  provider: string | null;
  affiliate_url: string | null;
  external_url: string | null;
  country_code: string;
  currency: string;
  category_slug?: string | null;
};

/** Infer a useful category from the product name when the DB stores "general". */
function inferCategoryFromName(name: string): string {
  const lower = name.toLowerCase();
  if (/\b(phone|iphone|samsung|galaxy|xiaomi|redmi|oppo|vivo|oneplus|pixel)\b/.test(lower)) return "phones";
  if (/\b(laptop|macbook|notebook|chromebook|thinkpad|surface|dell|hp pavilion)\b/.test(lower)) return "laptops";
  if (/\b(console|playstation|xbox|nintendo|gaming|controller|ps5|ps4|steam deck)\b/.test(lower)) return "gaming";
  if (/\b(tv|television|monitor|display|4k|oled|qled|hisense|tcl)\b/.test(lower)) return "tvs";
  if (/\b(watch|band|tracker|earbuds|headphones|airpods|fitbit|garmin)\b/.test(lower)) return "wearables";
  if (/\b(dress|shirt|jeans|jacket|shoes|sneakers|boots|sandals|fashion|clothing|apparel)\b/.test(lower)) return "fashion";
  if (/\b(home|kitchen|blender|vacuum|air fryer|mattress|pillow|furniture|lamp)\b/.test(lower)) return "home";
  return "electronics";
}

function rowToCatalogItem(row: LowestPriceRow): NormalizedCatalogItem {
  const providerId = resolveMarketplaceId(row.provider ?? row.store_name) as ProductionProviderId;
  const affiliateUrl = row.affiliate_url ?? row.external_url ?? "";
  const originalPrice = Number(row.original_price ?? row.lowest_price);
  const price = Number(row.lowest_price);
  const discount =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  const offer: ProviderOffer = {
    providerId,
    storeSlug: providerId,
    storeName: row.store_name,
    externalId: row.product_id,
    price,
    originalPrice,
    currency: row.currency,
    countryCode: row.country_code,
    productUrl: affiliateUrl,
    affiliateUrl,
    inStock: true,
  };

  const rawCategory = row.category_slug;
  const categorySlug =
    rawCategory && rawCategory !== "general"
      ? rawCategory
      : inferCategoryFromName(row.product_name);

  return {
    id: `db-${row.product_id}`,
    slug: row.product_slug,
    title: row.product_name,
    imageUrl: normalizeProductImageUrl(row.image_url),
    emoji: row.emoji ?? "🛍️",
    categorySlug,
    rating: 0,
    reviewCount: 0,
    countryCode: row.country_code,
    currency: row.currency,
    price,
    originalPrice,
    discount,
    discountType: "percentage",
    offers: [offer],
    providerIds: [providerId],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Providers that carry real, image-bearing products in `lowest_prices_today`.
 * Used to (a) enumerate the real merchant universe and (b) filter the catalog.
 * Derived from the canonical provider registry (status === "active") so the
 * set can never drift from the live-provider definition.
 */
const REAL_CATALOG_PROVIDERS = LIVE_PROVIDER_IDS;

/** Reciprocal of the .in() filter above — kept for the per-merchant query. */
function realProviderOr(): string {
  return `provider.in.(${REAL_CATALOG_PROVIDERS.join(",")})`;
}

/**
 * Enumerate the distinct real merchants present in `lowest_prices_today`.
 *
 * IMPORTANT: rows are heavily concentrated by merchant (one merchant can own
 * tens of thousands of rows, another only a handful at the very tail), so a
 * bounded "first N" slice would miss whole merchants. We page the full
 * real-provider set and dedupe on store_name to get every real merchant.
 * Runs once per 5-min catalog cache, so the full scan is acceptable.
 */
export async function getRealMerchantNames(supabase?: SupabaseDb): Promise<string[]> {
  const client = supabase ?? createSupabaseAnonClient();
  if (!client) return [];
  const names = new Set<string>();

  // IMPORTANT: the Supabase anon client caps responses at 1000 rows regardless
  // of the requested range, so we must step by exactly 1000. Previously each
  // page was fetched sequentially (~120 round-trips over the 120K-row table,
  // ~13s) just to discover the merchant set. Fetching pages concurrently
  // collapses that to a handful of parallel batches while remaining correct
  // (we stop only once a batch contains the short tail page).
  const page = 1000;
  const BATCH = 8; // concurrent pages per round
  const HARD_CAP = 130_000;

  const fetchPage = async (offset: number): Promise<Array<{ store_name: string | null }>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from("lowest_prices_today")
      .select("store_name")
      .eq("country_code", "US")
      .eq("currency", "USD")
      .not("image_url", "is", null)
      .neq("image_url", "")
      .or(realProviderOr())
      .range(offset, offset + page - 1);
    if (error) return [];
    return (data ?? []) as Array<{ store_name: string | null }>;
  };

  let offset = 0;
  for (;;) {
    if (offset > HARD_CAP) break;
    const offsets = Array.from(
      { length: BATCH },
      (_, i) => offset + i * page,
    );
    const batches = await Promise.all(offsets.map((o) => fetchPage(o)));
    let sawTail = false;
    for (const rows of batches) {
      for (const r of rows) {
        const name = r.store_name?.trim();
        if (name) names.add(name);
      }
      if (rows.length < page) sawTail = true;
    }
    // Advance past this batch. If any page in the batch was short we are past
    // the tail and there are no more rows to enumerate.
    offset += BATCH * page;
    if (sawTail) break;
  }

  return Array.from(names);
}
/**
 * Read a merchant-breadth sample of the Supabase `lowest_prices_today` table.
 * Returns NormalizedCatalogItems that can be merged with live search results.
 *
 * Unlike a single discount-limited slice (which a single dominant merchant can
 * flood and thereby hide every other real store), this pulls a bounded number
 * of the top products FROM EACH real merchant. Every real store in the DB is
 * therefore represented in the homepage catalog — so the store count is real
 * and the rendered feed stays diverse. Gracefully returns [] when Supabase is
 * not configured.
 */
export async function getCatalogItemsFromDatabase(): Promise<NormalizedCatalogItem[]> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return [];

  const storeNames = await getRealMerchantNames(supabase);
  if (storeNames.length === 0) return [];

  const PER_MERCHANT = 40;
  const collected: LowestPriceRow[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  for (const storeName of storeNames) {
    const { data, error } = await sb
      .from("lowest_prices_today")
      .select(
        "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
      )
      .eq("country_code", "US")
      .eq("currency", "USD")
      .eq("store_name", storeName)
      // Only real, image-bearing products enter the homepage catalog. The DB is
      // ~92% image-covered (120K rows), but some store feeds stored empty image
      // URLs that would otherwise resolve to placeholder cards. Filtering here
      // surfaces real products with real images so valid URLs render.
      .not("image_url", "is", null)
      .neq("image_url", "")
      .order("discount_percent", { ascending: false })
      .order("lowest_price", { ascending: false })
      .limit(PER_MERCHANT);

    if (error || !data) continue;

    for (const row of data as LowestPriceRow[]) {
      if (
        row.product_name &&
        row.image_url &&
        // Reject rows whose image normalizes to the placeholder (empty,
        // http-only, or invalid URLs all land there) — never placeholder cards.
        normalizeProductImageUrl(row.image_url) !== PRODUCT_IMAGE_PLACEHOLDER
      ) {
        collected.push(row);
      }
    }
  }

  // Dedupe on product_id so a product present across multiple merchants/rows
  // (rare) is not double-counted in the catalog feed.
  const byId = new Map<string, LowestPriceRow>();
  for (const row of collected) {
    if (!byId.has(row.product_id)) byId.set(row.product_id, row);
  }
  const rows = Array.from(byId.values());
  if (rows.length === 0) return [];

  // Batch-fetch category_slug from products table for these product IDs
  const productIds = rows.map((r) => r.product_id);
  const { data: productRows } = await sb
    .from("products")
    .select("id, category_slug")
    .in("id", productIds);

  const categoryMap = new Map<string, string | null>();
  for (const p of productRows ?? []) {
    categoryMap.set(p.id, p.category_slug);
  }

  return rows.map((row) => {
    row.category_slug = categoryMap.get(row.product_id) ?? null;
    return rowToCatalogItem(row);
  });
}

/**
 * Total count of real, image-bearing products in `lowest_prices_today` across
 * the live providers. This is the honest product-catalog size (not the bounded
 * in-memory feed), so the homepage "Products" stat reflects reality.
 *
 * Reliability:
 * - The count query MUST use the array-form `.in("provider", [...])` filter,
 *   NOT the string-form `.or("provider.in.(...)")`. Verified against the live
 *   120K-row table: `count: "exact"` combined with the `.or()` string form is
 *   planned as a PostgREST `or` filter and consistently 500s / times out
 *   (~4s statement cancellation), which is the root cause of the intermittent
 *   homepage "Products: 0". The array form is handled by the normal query
 *   planner path and returns the exact count in <1s.
 * - Retry transient failures; the caller caches the result for 5 minutes.
 * - Never surface "0" while real products exist: if the DB count is genuinely
 *   unavailable we fall back to the merged live catalog the homepage actually
 *   renders (a real, valid source), then to the last-known-good DB count.
 *   Returns 0 only when every real source is empty/unavailable.
 */
const COUNT_RETRIES = 3;
let lastKnownProductCount = 0;

/**
 * Test-only seams so regression tests can exercise the real retry/fallback
 * logic without a live Supabase connection (isolate:false + singleFork:true
 * makes per-module mocking unreliable). Production always passes null.
 */
let supabaseClientFactoryForTests: (() => SupabaseDb | null) | null = null;
let catalogFallbackCountForTests: (() => Promise<number>) | null = null;
let productCountWriterForTests: ((count: number) => Promise<void>) | null = null;
let productCountReaderForTests: (() => Promise<number>) | null = null;
let catalogCountReaderForTests: (() => Promise<number>) | null = null;
let catalogCountAgeReaderForTests: (() => Promise<number>) | null = null;
let catalogCountWriterForTests: ((count: number) => Promise<void>) | null = null;

/** Test-only: inject a fake `createSupabaseAnonClient` factory. */
export function setSupabaseAnonClientForTests(
  factory: (() => SupabaseDb | null) | null,
): void {
  supabaseClientFactoryForTests = factory;
}

/** Test-only: inject a fake merged-catalog fallback count source. */
export function setCatalogFallbackCountForTests(
  source: (() => Promise<number>) | null,
): void {
  catalogFallbackCountForTests = source;
}

/**
 * Test-only: inject fake last-known-good persistence read/write hooks so a
 * fresh-instance failure path can be exercised without a live service client.
 */
export function setProductCountPersistenceForTests(source: {
  writer?: ((count: number) => Promise<void>) | null;
  reader?: (() => Promise<number>) | null;
} | null): void {
  productCountWriterForTests = source?.writer ?? null;
  productCountReaderForTests = source?.reader ?? null;
}

/**
 * Test-only: inject fake `catalog_count` fast-path read/age/write hooks so the
 * fresh fast path and the stale/absent recompute branches can be exercised
 * without a live Supabase connection.
 */
export function setCatalogCountSourceForTests(source: {
  reader?: (() => Promise<number>) | null;
  ageReader?: (() => Promise<number>) | null;
  writer?: ((count: number) => Promise<void>) | null;
} | null): void {
  catalogCountReaderForTests = source?.reader ?? null;
  catalogCountAgeReaderForTests = source?.ageReader ?? null;
  catalogCountWriterForTests = source?.writer ?? null;
}

/** Test-only: restore all count seams and forget the known-good count. */
export function resetRealCatalogProductCountForTests(): void {
  supabaseClientFactoryForTests = null;
  catalogFallbackCountForTests = null;
  productCountWriterForTests = null;
  productCountReaderForTests = null;
  setCatalogCountSourceForTests(null);
  lastKnownProductCount = 0;
  lastPersistedProductCount = -1;
}

export async function getRealCatalogProductCount(): Promise<number> {
  // Fast path: a FRESH maintained `catalog_count` row is the authoritative
  // count without paying for the expensive exact-count over the 120K-row
  // table on the render hot path. Only when the row is absent or stale do we
  // fall through to the live count (seeded by the cron refresh off-path and
  // by any successful render).
  const freshMaintained = await readFreshMaintainedCatalogCount();
  if (freshMaintained > 0) {
    lastKnownProductCount = freshMaintained;
    return freshMaintained;
  }

  const supabase = supabaseClientFactoryForTests
    ? supabaseClientFactoryForTests()
    : createSupabaseAnonClient();
  if (!supabase) return fallbackRealCatalogProductCount();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  for (let attempt = 0; attempt < COUNT_RETRIES; attempt++) {
    const { count, error } = await sb
      .from("lowest_prices_today")
      .select("product_id", { count: "exact", head: true })
      .eq("country_code", "US")
      .eq("currency", "USD")
      .in("provider", [...REAL_CATALOG_PROVIDERS]);

    if (!error && typeof count === "number") {
      lastKnownProductCount = count;
      // Fire-and-forget: persist the known-good count so a cold instance
      // (empty module memory) can restore it after a transient failure. Never
      // blocks or fails the stat path.
      void persistProductCount(count);
      void writeMaintainedCatalogCount(count);
      return count;
    }
  }

  return fallbackRealCatalogProductCount();
}

/**
 * Read the maintained `catalog_count` row only when it is FRESH (written within
 * CATALOG_COUNT_FRESHNESS_MS). Stale/absent rows return 0 so the caller
 * recomputes the live count. Single-row read — single-digit milliseconds.
 */
async function readFreshMaintainedCatalogCount(): Promise<number> {
  let ageMs: number;
  if (catalogCountAgeReaderForTests) {
    try {
      ageMs = await catalogCountAgeReaderForTests();
    } catch {
      ageMs = Number.POSITIVE_INFINITY;
    }
  } else {
    if (process.env.NODE_ENV === "test") return 0;
    ageMs = await getCatalogCountAgeMs();
  }
  if (!(ageMs < CATALOG_COUNT_FRESHNESS_MS)) return 0;

  let count: number;
  if (catalogCountReaderForTests) {
    try {
      count = await catalogCountReaderForTests();
    } catch {
      return 0;
    }
  } else {
    if (process.env.NODE_ENV === "test") return 0;
    count = await getCatalogCount();
  }
  return count > 0 ? count : 0;
}

/**
 * Best-effort write of a known-good count into the maintained `catalog_count`
 * row (service_role upsert). Never throws into the caller.
 */
async function writeMaintainedCatalogCount(count: number): Promise<void> {
  if (catalogCountWriterForTests) {
    try {
      await catalogCountWriterForTests(count);
    } catch {
      // best-effort — never let persistence break the stat
    }
    return;
  }

  // Never write through a real service client inside vitest (the suite runs
  // without an explicit writer seam); production always proceeds below.
  if (process.env.NODE_ENV === "test") return;

  try {
    await setCatalogCount(count);
  } catch {
    // best-effort — never let persistence break the stat
  }
}

/**
 * Preference order after the exact-count query fails on ALL retries.
 * Never report a transient failure as 0 while real products exist:
 * 1) This instance's last observed real DB count (in-memory).
 * 2) The last count maintained in `catalog_count` — a real DB value, even if
 *    stale — restores the truthful catalog size (e.g. 69K+) on a cold
 *    instance instead of the tiny merged-catalog sample (merged catalog only
 *    carries a bounded representative slice of the DB, ~18 items).
 * 3) The LAST REAL DB count persisted in `integration_settings`.
 * 4) The merged live catalog length the homepage actually renders.
 * Returns 0 only when every real source is genuinely empty/unavailable.
 */
async function fallbackRealCatalogProductCount(): Promise<number> {
  if (lastKnownProductCount > 0) return lastKnownProductCount;

  const maintainedCount = await readAnyMaintainedCatalogCount();
  if (maintainedCount > 0) {
    lastKnownProductCount = maintainedCount;
    return maintainedCount;
  }

  const persistedCount = await readPersistedProductCount();
  if (persistedCount > 0) {
    lastKnownProductCount = persistedCount;
    return persistedCount;
  }

  const catalogCount = await getCatalogFallbackCount();
  if (catalogCount > 0) return catalogCount;
  return lastKnownProductCount;
}

/** Read the maintained count regardless of age; 0 when absent/unreadable. */
async function readAnyMaintainedCatalogCount(): Promise<number> {
  if (catalogCountReaderForTests) {
    try {
      const count = await catalogCountReaderForTests();
      return count > 0 ? count : 0;
    } catch {
      return 0;
    }
  }
  if (process.env.NODE_ENV === "test") return 0;
  try {
    const count = await getCatalogCount();
    return count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

/** integration_settings.key holding the last-known-good real catalog count. */
const PRODUCT_COUNT_SETTING_KEY = "homepage_product_count";
let lastPersistedProductCount = -1;

/**
 * Best-effort persist of the last-known-good real count into
 * `integration_settings` (service_role). Skipped when the count is unchanged
 * (the catalog count is stable between syncs), when no service client is
 * available, or inside tests without an explicit writer seam.
 */
async function persistProductCount(count: number): Promise<void> {
  if (count <= 0 || count === lastPersistedProductCount) return;

  if (productCountWriterForTests) {
    try {
      await productCountWriterForTests(count);
      lastPersistedProductCount = count;
    } catch {
      // best-effort — never let persistence break the stat
    }
    return;
  }

  // Never persist through a real service client inside vitest (the suite runs
  // without an explicit writer seam); production always proceeds below.
  if (process.env.NODE_ENV === "test") return;

  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb.from("integration_settings").upsert(
      {
        key: PRODUCT_COUNT_SETTING_KEY,
        value: String(count),
        provider: "system",
        label: "Homepage real product count",
        is_secret: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (!error) lastPersistedProductCount = count;
  } catch {
    // best-effort — never let persistence break the stat
  }
}

/** Read the persisted last-known-good count; 0 when absent/unreadable. */
async function readPersistedProductCount(): Promise<number> {
  try {
    if (productCountReaderForTests) {
      const value = await productCountReaderForTests();
      return value > 0 ? value : 0;
    }

    // Never read through a real service client inside vitest (the suite runs
    // without an explicit reader seam); production always proceeds below.
    if (process.env.NODE_ENV === "test") return 0;

    const supabase = createSupabaseServiceClient();
    if (!supabase) return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data } = await sb
      .from("integration_settings")
      .select("value")
      .eq("key", PRODUCT_COUNT_SETTING_KEY)
      .maybeSingle();
    const raw = data as { value?: string | number } | null;
    const count = Number(raw?.value ?? 0);
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

/**
 * Real fallback for the homepage "Products" stat when the DB count is
 * unavailable: the number of distinct real products in the merged live catalog
 * — the SAME source that renders the homepage cards. Dynamically imported to
 * avoid a static circular dependency with catalog-service. Returns 0 when the
 * catalog is also unavailable/empty (then the caller uses last-known-good).
 */
async function getCatalogFallbackCount(): Promise<number> {
  if (catalogFallbackCountForTests) {
    try {
      return await catalogFallbackCountForTests();
    } catch {
      return 0;
    }
  }
  try {
    const { getMergedCatalogItems } = await import(
      "@/lib/integration/catalog-service"
    );
    const items = await getMergedCatalogItems();
    return items.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Catalog viability gate & last-known-good
// ---------------------------------------------------------------------------

/**
 * Minimum viable catalog rule: a healthy merged catalog MUST span at least
 * two distinct real provider sources. The homepage is a multi-marketplace
 * surface by design (see the balancer rationale in homepage-sections.ts).
 * When provider latency collapses the fan-out to a single fast source, the
 * resulting pool is clearly incomplete and must NOT overwrite an existing
 * healthy snapshot in cache.
 *
 * - Deterministic (no randomness, no side effects)
 * - Provider-neutral (no specific provider named or required)
 * - Derived from the multi-marketplace identity of the architecture
 * - Small (>=2 is the smallest non-trivial multi-source threshold)
 * - Covered by regression tests
 */
export const MIN_VIABLE_SOURCES = 2;

export function isCatalogViable(items: NormalizedCatalogItem[]): boolean {
  if (items.length === 0) return false;
  const providers = new Set<string>();
  for (const item of items) {
    const pid = resolveMarketplaceId(
      item.providerIds[0] ?? item.offers[0]?.providerId ?? "unknown",
    );
    providers.add(pid);
  }
  return providers.size >= MIN_VIABLE_SOURCES;
}

/**
 * Last-known-good catalog snapshot (per-instance module memory, mirroring the
 * established `lastKnownProductCount` pattern). Once a healthy catalog has been
 * generated, subsequent degraded regenerations return this snapshot instead of
 * letting the unstable_cache slot be overwritten with incomplete data.
 *
 * The main `homepage:merged-catalog-v13-image-fix` unstable_cache slot persists
 * across requests on a warm instance. Module memory is set on the first viable
 * generation; all subsequent degraded regens within the same process lifetime
 * use the cached healthy snapshot. The residual cold-instance edge (module
 * memory empty on a brand-new worker with no prior healthy generation) falls
 * through to returning the degraded catalog -- this is acceptable because
 * unstable_cache always caches the return, and the degraded catalog is at least
 * a truthful representation when no healthy snapshot has ever been established.
 */
let lastKnownGoodCatalog: NormalizedCatalogItem[] = [];

/** Store a healthy catalog snapshot in module memory. */
export function rememberCatalogAsHealthy(items: NormalizedCatalogItem[]): void {
  lastKnownGoodCatalog = items;
}

/** Retrieve the last-known-good catalog snapshot (empty array if none yet). */
export function getLastKnownGoodCatalog(): NormalizedCatalogItem[] {
  return lastKnownGoodCatalog;
}

export interface CatalogSnapshotOutcome {
  items: NormalizedCatalogItem[];
  /** True when `items` is a trustworthy, full-TTL-worthy snapshot. */
  healthy: boolean;
}

/**
 * Resolve the final catalog snapshot from freshly-generated items and a
 * completeness signal.
 *
 * A snapshot is HEALTHY only when it is provider-viable AND `complete` (no
 * source was skipped for exceeding its budget). A viable-but-incomplete
 * snapshot (e.g. the fast providers returned while the DB/Admitad sources timed
 * out) is NOT healthy: the last-known-good snapshot is returned when one exists,
 * otherwise the truthful partial is returned but flagged unhealthy so callers
 * reuse it only briefly. Provider-neutral and deterministic.
 */
export function resolveCatalogSnapshot(
  freshItems: NormalizedCatalogItem[],
  complete = true,
): CatalogSnapshotOutcome {
  if (isCatalogViable(freshItems) && complete) {
    rememberCatalogAsHealthy(freshItems);
    return { items: freshItems, healthy: true };
  }
  // Degraded: protect the cache by returning the last-known-good snapshot.
  // Cold start: no known-good exists yet -> return fresh (truthful fallback).
  if (lastKnownGoodCatalog.length > 0) {
    return { items: lastKnownGoodCatalog, healthy: true };
  }
  return { items: freshItems, healthy: false };
}

/**
 * Pure function: resolve the final catalog items from the freshly-generated
 * items (completeness assumed). Thin wrapper over {@link resolveCatalogSnapshot}
 * retained for existing callers/tests.
 */
export function resolveCatalogOutcome(
  freshItems: NormalizedCatalogItem[],
): NormalizedCatalogItem[] {
  return resolveCatalogSnapshot(freshItems).items;
}

/**
 * Test-only seam: reset the viability gate state (known-good catalog memory).
 * Mirrors the resetRealCatalogProductCountForTests() pattern above.
 */
export function resetCatalogViabilityForTests(): void {
  lastKnownGoodCatalog = [];
}

function rowToSearchResultItem(row: LowestPriceRow): SearchResultItem {
  const providerId = resolveMarketplaceId(row.provider ?? row.store_name);
  const affiliateUrl = row.affiliate_url ?? row.external_url ?? "";
  const originalPrice = Number(row.original_price ?? row.lowest_price);
  const price = Number(row.lowest_price);
  const discount =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  const rawCategory = row.category_slug;
  const category =
    rawCategory && rawCategory !== "general"
      ? rawCategory
      : inferCategoryFromName(row.product_name);

  return {
    id: `db-${row.product_id}`,
    name: row.product_name,
    imageSrc: normalizeProductImageUrl(row.image_url),
    emoji: row.emoji ?? "🛍️",
    price,
    originalPrice,
    discount,
    store: row.store_name,
    storeSlug: providerId,
    rating: 0,
    reviewCount: 0,
    inStock: true,
    category,
    currency: row.currency,
    countryCode: row.country_code,
    affiliateUrl,
  };
}

/**
 * Read products from Supabase matching a search query.
 * Returns SearchResultItems that can be merged with live search-engine results.
 *
 * The search fan-out passes a hard `timeoutMs` so a slow database read can
 * never hold the whole query hostage. On timeout the DB supplement resolves to
 * an EMPTY pool — the same *truthful* "no additional DB products" state the
 * caller already sees after a DB error — never fabricated/partial rows.
 */
export async function getSearchResultsFromDatabase(
  query: string,
  limit = 24,
  options?: { timeoutMs?: number },
): Promise<SearchResultItem[]> {
  const deadline = options?.timeoutMs;
  if (!deadline || deadline <= 0) return loadSearchResultsFromDatabase(query, limit);

  return new Promise<SearchResultItem[]>((resolve) => {
    const timer = setTimeout(() => resolve([]), deadline);
    loadSearchResultsFromDatabase(query, limit).then(
      (items) => {
        clearTimeout(timer);
        resolve(items);
      },
      (err) => {
        clearTimeout(timer);
        // A DB error is a truthful "no database products".
        resolve([]);
      },
    );
  });
}

async function loadSearchResultsFromDatabase(
  query: string,
  limit: number,
): Promise<SearchResultItem[]> {
  const supabase = supabaseClientFactoryForTests
    ? supabaseClientFactoryForTests()
    : createSupabaseAnonClient();
  if (!supabase) return [];

  // Word-level OR matching: "nike shoes" → product_name ~* '\mnike\M' OR
  // '\mshoes\M'. Word-boundary regex (not ILIKE '%w%') stops short tokens from
  // matching inside unrelated words ("pro" ⊂ "waterproof"/"professional";
  // "15" ⊂ "x15-box"), which previously flooded the pool with irrelevant rows.
  // Word overlap scoring happens post-query.
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) return [];

  const orFilter = buildWordBoundaryOrFilter(words);

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .or(orFilter)
    .eq("country_code", "US")
    .eq("currency", "USD")
    .not("image_url", "is", null)
    .neq("image_url", "")
    .order("discount_percent", { ascending: false })
    .limit(limit * 2);

  if (error || !data?.length) return [];

  const rows = (data as LowestPriceRow[]).filter(
    (row) =>
      row.product_name &&
      row.image_url &&
      normalizeProductImageUrl(row.image_url) !== PRODUCT_IMAGE_PLACEHOLDER,
  );

  const productIds = rows.map((r) => r.product_id);
  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .in("id", productIds);

  const categoryMap = new Map<string, string | null>();
  for (const p of productRows ?? []) {
    categoryMap.set(p.id, p.category_slug);
  }

  const results = rows.map((row) => {
    row.category_slug = categoryMap.get(row.product_id) ?? null;
    return rowToSearchResultItem(row);
  });

  // Rank by word overlap: products matching more query words rank higher.
  // "Nike Air Max 90" matches 1/2 words for "nike shoes" → score 1
  // "Nike Running Shoes" matches 2/2 words → score 2 (ranked first).
  const queryWords = words;
  results.sort((a, b) => {
    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();
    const aMatches = queryWords.filter((w) => wordInTitle(aLower, w)).length;
    const bMatches = queryWords.filter((w) => wordInTitle(bLower, w)).length;
    if (aMatches !== bMatches) return bMatches - aMatches;
    return b.discount - a.discount || a.price - b.price;
  });

  return results.slice(0, limit);
}

/**
 * Read the Admitad `product_slug` (`admitad-<campaignId>-<offerId>`) for a
 * `lowest_prices_today` product_id. Used by the PDP resolver to match a DB row
 * to its live-feed offer so the real deep product/affiliate URL can be resolved
 * even when the persisted row stored only a merchant homepage URL.
 */
export async function getDatabaseProductSlug(
  productId: string,
): Promise<string | null> {
  const trimmed = productId.trim();
  if (!trimmed) return null;

  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select("product_slug")
    .eq("product_id", trimmed)
    .limit(1);

  if (error) return null;
  const row = (data as { product_slug?: string | null }[] | null)?.[0];
  return row?.product_slug?.trim() || null;
}

/**
 * Read a single lowest_prices_today row by its product_id (the id embedded in
 * `db-<product_id>` catalog ids) and map it to a SearchResultItem.
 * Used by the marketplace PDP resolver for Admitad/DB-sourced products.
 */
export async function getDatabaseSearchItemByProductId(
  productId: string,
): Promise<SearchResultItem | null> {
  const trimmed = productId.trim();
  if (!trimmed) return null;

  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .eq("product_id", trimmed)
    .limit(1);

  const row = (data as LowestPriceRow[] | null)?.[0];
  if (
    error ||
    !row ||
    !row.product_name ||
    !row.image_url ||
    normalizeProductImageUrl(row.image_url) === PRODUCT_IMAGE_PLACEHOLDER
  ) {
    return null;
  }

  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .eq("id", row.product_id)
    .limit(1);

  row.category_slug = productRows?.[0]?.category_slug ?? null;
  return rowToSearchResultItem(row);
}

/**
 * Look up a single lowest_prices_today row by its Admitad product_slug
 * (`admitad-<campaignId>-<offerId>`) and map it to a SearchResultItem.
 * This is the persisted-row counterpart of the live `admitad-…` feed products,
 * used as a fallback by the PDP resolver when the live feed cache is cold.
 * Only real rows (real name + real image) are ever returned.
 */
export async function getDatabaseSearchItemByProductSlug(
  productSlug: string,
): Promise<SearchResultItem | null> {
  const trimmed = productSlug.trim();
  if (!trimmed) return null;

  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .eq("product_slug", trimmed)
    .limit(1);

  const row = (data as LowestPriceRow[] | null)?.[0];
  if (
    error ||
    !row ||
    !row.product_name ||
    !row.image_url ||
    normalizeProductImageUrl(row.image_url) === PRODUCT_IMAGE_PLACEHOLDER
  ) {
    return null;
  }

  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .eq("id", row.product_id)
    .limit(1);

  row.category_slug = productRows?.[0]?.category_slug ?? null;
  return rowToSearchResultItem(row);
}
