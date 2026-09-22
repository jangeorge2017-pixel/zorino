/**
 * Duplicate-free pagination regression (universe-seam fix).
 *
 * Live defect: "Samsung has 2 repeated IDs and AirPods has 28 repeated IDs
 * after offset 200." Root cause: the paged seam skipped the DB leg by
 * `dbConsumedInPool` — a COUNT of pool db rows treated as the discount-prefix
 * of the DB universe. The pool's db rows are NOT that prefix (they are
 * exact+family merged, re-ranked, and deduped against live rows), so the tail
 * re-served rows the pool already showed and skipped discount-head rows the
 * pool never placed.
 *
 * The fix makes pagination walk ONE deterministic ordered matching universe:
 *
 *   positions [0, pool.length)     → the balanced pool (unchanged, still
 *                                    device-first assembled)
 *   positions [pool.length, total) → the discount-ordered DB leg MINUS the
 *                                    pool's db rows, excluded BY SET
 *                                    (`product_id not in (...)`), indexed from
 *                                    rank 0 — never skipped by count
 *
 * These tests prove, offline (seeded pool + fake Supabase), that:
 *   1. `resolvePooledPageSelection` maps any offset onto that single universe.
 *   2. The legacy `searchProductsPaged` seam serves successive, contiguous,
 *      duplicate/gap-free portions of the universe even when the pool's db rows
 *      sit far outside the discount-head.
 *   3. The canonical `searchResultsPagedSurface` (gate on) serves the exact
 *      same universe, keeps the truthful total, and keeps non-eBay providers
 *      reachable deep into the catalog.
 *   4. No page re-consumes a row an earlier page already emitted.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  clearSearchPoolForTests,
  resolvePooledPageSelection,
  searchProductsPaged,
  setSearchPoolForTests,
} from "@/lib/search/engine";
import {
  searchResultsPagedSurface,
  setCanonicalSearchFetcherForTests,
} from "@/lib/canonical/consumption/search";
import {
  resetSurfaceFlagsForTests,
  setSurfaceEnabledForTests,
} from "@/lib/canonical/consumption/feature";
import {
  resetCanonicalFlagForTests,
  setCanonicalEnabledForTests,
} from "@/lib/canonical/feature";
import {
  resetRealCatalogProductCountForTests,
  setSupabaseAnonClientForTests,
} from "@/lib/integration/database-catalog";
import type { SearchResultItem } from "@/lib/data/homepage";

type DbRow = {
  product_id: string;
  product_name: string;
  image_url: string;
  discount_percent: number;
  lowest_price: number;
  original_price: number;
  store_name: string;
  provider: string;
  country_code: string;
  currency: string;
};

const PROVIDERS = ["aliexpress", "ebay", "admitad", "cjdropshipping"];

/** Deterministic rows; product_id is a plain slug (NOT already "db-"-prefixed). */
function makeRows(count = 417): DbRow[] {
  return Array.from({ length: count }, (_, i) => ({
    product_id: `pid-${String(i).padStart(4, "0")}`,
    product_name: `Wireless Earbuds Pro ${String(i).padStart(4, "0")}`,
    image_url: `https://img.example/earbuds-${i}.jpg`,
    discount_percent: Math.max(0, 84 - Math.floor(i / 3)),
    lowest_price: Number((14.99 + i * 0.3).toFixed(2)),
    original_price: Number((79.99 + i * 0.3).toFixed(2)),
    store_name: `Store ${PROVIDERS[i % PROVIDERS.length]}`,
    provider: PROVIDERS[i % PROVIDERS.length],
    country_code: "US",
    currency: "USD",
  }));
}

function serverOrdered(rows: DbRow[]): DbRow[] {
  return [...rows].sort(
    (a, b) =>
      b.discount_percent - a.discount_percent ||
      a.product_name.localeCompare(b.product_name) ||
      a.product_id.localeCompare(b.product_id),
  );
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** eBay-dominant catalog (388/417) with rare AliExpress/Admitad like production. */
function makeNonUniformRows(count = 417): DbRow[] {
  const weights: Array<[string, number]> = [
    ["ebay", 388],
    ["cjdropshipping", 23],
    ["aliexpress", 4],
    ["admitad", 2],
  ];
  const providerPool: string[] = [];
  for (const [provider, w] of weights) {
    for (let k = 0; k < w; k++) providerPool.push(provider);
  }
  const providers = seededShuffle(providerPool, 0x5eed_417);
  return makeRows(count).map((row, i) => ({ ...row, provider: providers[i] }));
}

/**
 * Fake supabase anon client mirroring the production seam (count head + paged
 * leg with `.not("product_id","in","(…)")` set-exclusion + products leg).
 */
function buildFakeSupabase(rows: DbRow[]): () => unknown {
  const ordered = serverOrdered(rows);
  const total = rows.length;
  let excluded = new Set<string>();

  const dbChain = {
    select: () => dbChain,
    or: () => dbChain,
    eq: () => dbChain,
    not: (col?: string, op?: string, val?: unknown) => {
      if (col === "product_id" && op === "in" && typeof val === "string") {
        excluded = new Set(
          val
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }
      return dbChain;
    },
    neq: () => dbChain,
    order: () => dbChain,
    range: (from: number, to: number) => {
      const inUniverse = ordered.filter((r) => !excluded.has(r.product_id));
      return Promise.resolve({
        data: inUniverse.slice(from, to + 1),
        count: inUniverse.length,
        error: null,
      });
    },
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ count: total, error: null }).then(resolve),
  };

  return () => ({
    from: (table: string): unknown =>
      table === "products"
        ? {
            select: () => ({
              in: (_col: string, ids: string[]) =>
                Promise.resolve({
                  data: ordered
                    .filter((r) => ids.includes(r.product_id))
                    .map((r) => ({ id: r.product_id, category_slug: "audio" })),
                  error: null,
                }),
            }),
          }
        : dbChain,
  });
}

/** Item id for a DB row as `rowToSearchResultItem` would build it. */
function dbItemId(productId: string): string {
  return `db-${productId}`;
}

function liveItem(id: string): SearchResultItem {
  return {
    id,
    name: `Live Seller Item ${id}`,
    imageSrc: `https://img.example/${id}.jpg`,
    emoji: "📦",
    price: 19.99,
    originalPrice: 29.99,
    discount: 33,
    store: "eBay",
    storeSlug: "ebay",
    rating: 4.4,
    reviewCount: 220,
    inStock: true,
    category: "Electronics",
    affiliateUrl: `https://go.example/${id}`,
  };
}

function dbPoolItem(row: DbRow): SearchResultItem {
  return {
    ...liveItem(dbItemId(row.product_id)),
    name: row.product_name,
    store: `Store ${row.provider}`,
    storeSlug: row.provider,
    discount: row.discount_percent,
  };
}

describe("resolvePooledPageSelection — one deterministic universe", () => {
  const pool = [
    ...["live-0", "live-1", "live-2", "live-3"].map(liveItem),
    ...makeRows(8)
      .slice(0, 6)
.map((r) => dbPoolItem(r)),
  ];

  it("fully-inside pages take a pure pool slice with an empty tail", () => {
    const sel = resolvePooledPageSelection(pool, 1, 3);
    expect(sel.poolHead).toEqual(pool.slice(1, 4));
    expect(sel.tailStart).toBe(0);
    expect(sel.tailCount).toBe(0);
  });

  it("straddling pages carry the remaining pool head then start the tail at rank 0", () => {
    const sel = resolvePooledPageSelection(pool, 7, 10);
    expect(sel.poolHead).toEqual(pool.slice(7));
    expect(sel.tailStart).toBe(0);
    expect(sel.tailCount).toBe(7);
  });

  it("fully-beyond pages take no pool head and index the tail past the pool length", () => {
    const sel = resolvePooledPageSelection(pool, 13, 10);
    expect(sel.poolHead).toEqual([]);
    expect(sel.tailStart).toBe(3);
    expect(sel.tailCount).toBe(10);
  });

  it("excludes EVERY pool db row by product_id (set, not count-skip)", () => {
    const sel = resolvePooledPageSelection(pool, 20, 10);
    const page = (sel.excludeProductIds ?? []).sort();
    expect(page).toEqual(makeRows(8).slice(0, 6).map((r) => r.product_id).sort());
    // Only db-* rows are excluded; live rows never enter the set.
    expect(sel.excludeProductIds.some((id) => id.startsWith("live-"))).toBe(false);
  });

  it("clamps malformed offsets/limits", () => {
    const sel = resolvePooledPageSelection(pool, NaN, NaN);
    expect(sel.tailStart).toBe(0);
    expect(sel.tailCount).toBe(40);
    expect(sel.poolHead).toEqual(pool.slice(0, Math.min(50, pool.length)));
    const neg = resolvePooledPageSelection(pool, -5, 5);
    expect(neg.poolHead).toEqual(pool.slice(0, 5));
  });
});

afterEach(() => {
  resetRealCatalogProductCountForTests();
  clearSearchPoolForTests();
  resetSurfaceFlagsForTests();
  resetCanonicalFlagForTests();
  setCanonicalSearchFetcherForTests(null);
});

/** Walk pages until hasMore goes false; returns raw pages + raw id stream. */
async function walkPages(
  fetcher: (offset: number) => Promise<{
    items: SearchResultItem[];
    total: number;
    hasMore: boolean;
  }>,
  pageSize: number,
  maxPages = 40,
): Promise<{ pages: SearchResultItem[][]; ids: string[]; lastTotal: number }> {
  const pages: SearchResultItem[][] = [];
  const ids: string[] = [];
  let offset = 0;
  let lastTotal = 0;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetcher(offset);
    lastTotal = page.total;
    pages.push(page.items);
    ids.push(...page.items.map((item) => item.id));
    if (!page.hasMore || page.items.length === 0) break;
    offset += page.items.length;
  }
  return { pages, ids, lastTotal };
}

describe("legacy searchProductsPaged — pool-excluded universe seam", () => {
  const query = "wireless earbuds universe legacy";

  it("serves successive, duplicate-free, gap-free portions of the unified universe", async () => {
    const rows = makeNonUniformRows(417);
    const ordered = serverOrdered(rows);

    // Pool: 28 live rows then 12 db rows sitting FAR from the discount head
    // (indices 2,5,60,90,150,210,270,330,390,12,45,301) — the exact scenario
    // the old count-skip (`dbConsumedInPool`) re-served / gap-skipped.
    const scattered = [2, 5, 60, 90, 150, 210, 270, 330, 390, 12, 45, 301];
    const poolDbRows = scattered.map((i) => ordered[i]!);
    const poolDbItems = poolDbRows.map((r) => dbPoolItem(r));
    const pool: SearchResultItem[] = [
      ...Array.from({ length: 28 }, (_, i) => liveItem(`live-${i}`)),
      ...poolDbItems,
    ];

    setSupabaseAnonClientForTests(buildFakeSupabase(rows) as never);
    setSearchPoolForTests(query, pool);

    // Expected universe: [pool in order] ++ [DB order minus pool db ids].
    const emitted = new Set(poolDbRows.map((r) => r.product_id));
    const sIds = ordered.filter((r) => !emitted.has(r.product_id)).map((r) => dbItemId(r.product_id));
    const expected = [...pool.map((i) => i.id), ...sIds];

    const fetchPage = (offset: number) =>
      searchProductsPaged(query, offset, 50, { optimizeForDeviceIntent: true });
    const { pages, ids, lastTotal } = await walkPages(fetchPage, 50);

    // 1. Zero duplicates anywhere — the raw id stream is fully unique.
    expect(ids).toHaveLength(new Set(ids).size);

    // 2. Truthful total on every page: the exact Supabase match count.
    expect(lastTotal).toBe(417);

    // 3. Successive portions of the SAME universe: every page is exactly
    //    expected[offset .. offset + items.length).
    let offset = 0;
    for (const page of pages) {
      expect(page.map((i) => i.id)).toEqual(expected.slice(offset, offset + page.length));
      offset += page.length;
    }

    // 4. The complete universe is reachable (pool + full DB leg, no skip).
    expect(new Set(ids).size).toBe(expected.length);
    expect(expected).toHaveLength(pool.length + sIds.length);

    // 5. No adjacent-page overlap.
    for (let i = 0; i + 1 < pages.length; i++) {
      const a = new Set(pages[i]!.map((m) => m.id));
      for (const id of pages[i + 1]!.map((m) => m.id)) {
        expect(a.has(id)).toBe(false);
      }
    }
  });

  it("keeps non-eBay providers reachable deep into the catalog", async () => {
    const rows = makeNonUniformRows(417);
    const ordered = serverOrdered(rows);

    const pool: SearchResultItem[] = [
      ...Array.from({ length: 40 }, (_, i) => liveItem(`live-${i}`)),
      ...ordered.slice(0, 12).map((r) => dbPoolItem(r)),
    ];
    setSupabaseAnonClientForTests(buildFakeSupabase(rows) as never);
    setSearchPoolForTests(query + " deep", pool);

    const { ids, lastTotal } = await walkPages(
      (offset) => searchProductsPaged(query + " deep", offset, 50, { optimizeForDeviceIntent: true }),
      50,
    );
    expect(lastTotal).toBe(417);

    const dbIds = ids.filter((id) => id.startsWith("db-"));
    const rowsById = new Map(ordered.map((r) => [dbItemId(r.product_id), r]));

    // Deep pages reach every provider in the catalog, including the rare
    // AliExpress/Admitad rows that the old count-skip could suppress.
    const deepProviders = new Set<string>();
    for (const id of dbIds) {
      const row = rowsById.get(id);
      if (row) deepProviders.add(row.provider);
    }
    expect(deepProviders.has("ebay")).toBe(true);
    expect(deepProviders.has("cjdropshipping")).toBe(true);
    expect(deepProviders.has("aliexpress")).toBe(true);
    expect(deepProviders.has("admitad")).toBe(true);
  });
});

describe("canonical searchResultsPagedSurface — same universe, gate on", () => {
  const query = "wireless earbuds universe canonical";

  it("renders pages that are exact successive slices of the unified universe", async () => {
    setCanonicalEnabledForTests(true);
    setSurfaceEnabledForTests("search", true);

    const rows = makeNonUniformRows(417);
    const ordered = serverOrdered(rows);

    // Pool is 52 db rows, all Admitad store identity so the canonical assembly
    // keeps the feed order 1:1 (single provider → balance keeps sort order).
    const poolRows = ordered.slice(0, 52);
    const dbItems: SearchResultItem[] = poolRows.map((r, i) => ({
      ...dbPoolItem(r),
      store: "Store admitad",
      storeSlug: "admitad",
      discount: poolRows.length - i, // decreasing so single-provider balance is stable
    }));

    setSupabaseAnonClientForTests(buildFakeSupabase(rows) as never);
    setCanonicalSearchFetcherForTests(async () => ({
      liveListings: [],
      dbItems,
      activeProviders: ["aliexpress", "ebay", "admitad", "cjdropshipping"],
    }));

    // Expected universe: pool (52, in pool order) ++ DB leg minus pool ids.
    const emitted = new Set(poolRows.map((r) => r.product_id));
    const sIds = ordered.filter((r) => !emitted.has(r.product_id)).map((r) => dbItemId(r.product_id));
    const expected = [...dbItems.map((i) => i.id), ...sIds];
    expect(expected).toHaveLength(rows.length); // 52 + 365 = 417 → truthful universe

    const fetchPage = (offset: number) =>
      searchResultsPagedSurface(query, offset, 50);
    const { pages, ids, lastTotal } = await walkPages(fetchPage, 50);

    // Zero duplicates across the whole walk.
    expect(ids).toHaveLength(new Set(ids).size);

    // Truthful total (the exact Supabase match count).
    expect(lastTotal).toBe(417);

    // Exact successive portions of ONE universe.
    let offset = 0;
    for (const page of pages) {
      expect(page.map((i) => i.id)).toEqual(expected.slice(offset, offset + page.length));
      offset += page.length;
    }

    // Full reachability: pool + every DB row minus nothing.
    expect(ids).toHaveLength(expected.length);
    expect(new Set(ids).size).toBe(expected.length);

    // Adjacent pages share nothing.
    for (let i = 0; i + 1 < pages.length; i++) {
      const a = new Set(pages[i]!.map((m) => m.id));
      for (const id of pages[i + 1]!.map((m) => m.id)) {
        expect(a.has(id)).toBe(false);
      }
    }
  });
});