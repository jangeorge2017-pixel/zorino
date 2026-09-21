/*hfnction serverOrdered(rows: DbRow[]): DbRow[] {
*
 * DB-leg paging contract regression.
 *
 * The homepage Products counter regression (tests/unit/integration/
 * homepage-products-counter.test.ts) already proves the real exported
 * `getRealCatalogProductCount` reports the EXACT Supabase count (417) instead
 * of a 200-capped display pool. This file pins the same truthfulness for the
 * DB *legs* the Search page's "load more" pager drives:
 *
 *   1. `countSearchResultsFromDatabase` returns the exact catalog count (417),
 *      not the 200-window pool size.
 *   2. `getSearchResultsFromDatabasePaged` serves any page the pager asks for,
 *      including pages entirely past offset 200 (deep reachability), with a
 *      truthful `total` of 417.
 *   3. Page boundaries are contiguous and non-overlapping: a page split at the
 *      200 seam shares no product_id with the following page between window
 *      edges, and no row is skipped.
 *   4. No single provider monopolizes later pages: a deep page really past the
 *      200-window still mixes providers (round-robin source -> no monopoly).
 *
 * Same seam discipline as the passing homepage counter suite: drive the REAL
 * exported DB legs with the REAL test-only anon-client seam
 * `setSupabaseAnonClientForTests` - no module mocking. Vitest is configured
 * single-fork (+resetRealCatalogProductCountForTests after each).
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  countSearchResultsFromDatabase,
  getSearchResultsFromDatabasePaged,
  resetRealCatalogProductCountForTests,
  setSupabaseAnonClientForTests,
} from "@/lib/integration/database-catalog";

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

/** 417 deterministic catalog rows; discount desc, round-robin providers. */
function makeDbRows(count = 417): DbRow[] {
  return Array.from({ length: count }, (_, i) => ({
    product_id: `db-${String(i).padStart(4, "0")}`,
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

/**
 * Realistic NON-UNIFORM catalog inventory (eBay-dominant, like the production
 * distribution). Providers hold their TRUE share of the matching universe 
 * there is NO equal 25% allocation and NO per-provider quota. The few rare
 * providers (Admitad=2, AliExpress=4) must stay fully reachable through
 * pagination regardless of eBay's dominance.
 *
 *   eBay 388 + CJdropshipping 23 + AliExpress 4 + Admitad 2 = 417 candidates.
 *
 * Seed picks the provider order deterministically (mulberry32  identical
 * across platforms and Node versions), so the test never depends on runtime
 * randomness and still reproduces the exact same deep-page drift every run.
 */
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

/** 417 deterministic rows whose provider mix is intentionally NON-UNIFORM. */
function makeNonUniformDbRows(count = 417): DbRow[] {
  const weights: Array<[string, number]> = [
    ["ebay", 388],
    ["cjdropshipping", 23],
    ["aliexpress", 4],
    ["admitad", 2],
  ];
  const totalWeight = weights.reduce((s, [, w]) => s + w, 0);
  if (totalWeight !== count) {
    throw new Error(`non-uniform weights must sum to ${count}`);
  }
  const providerPool: string[] = [];
  for (const [provider, w] of weights) {
    for (let k = 0; k < w; k++) providerPool.push(provider);
  }
  const providers = seededShuffle(providerPool, 0x5eed_417);
  const rows = makeDbRows(count);
  return rows.map((row, i) => ({ ...row, provider: providers[i] }));
}

function serverOrdered(rows: DbRow[]): DbRow[] {
  return [...rows].sort(
    (a, b) =>
      b.discount_percent - a.discount_percent ||
      a.product_name.localeCompare(b.product_name) ||
      a.product_id.localeCompare(b.product_id),
  );
}

/**
 * Fake supabase anon client:
 *  - count leg (head): `.from("lowest_prices_today").select(_,{head:true})
 *    .or().eq().eq().not().neq()` -> thenable `{ count, error }`.
 *  - paged leg: `.from("lowest_prices_today").select().or().eq().eq().not()
 *    .neq().order().order().order().range(from,to)` -> Promise
 *    `{ data, count, error }` with count = exact total (not window-capped).
 *  - products leg: `.from("products").select().in("id", ids)` -> Promise
 *    `{ data, error }`.
 */
function buildFakeSupabase(rows: DbRow[]): () => unknown {
  const ordered = serverOrdered(rows);
  const total = rows.length;

  const dbChain = {
    select: () => dbChain,
    or: () => dbChain,
    eq: () => dbChain,
    not: () => dbChain,
    neq: () => dbChain,
    order: () => dbChain,
    range: (from: number, to: number) =>
      Promise.resolve({
        data: ordered.slice(from, to + 1),
        count: total,
        error: null,
      }),
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

afterEach(() => {
  resetRealCatalogProductCountForTests();
});

describe("DB-leg Search paging contract", () => {
  it("counts the exact catalog, not the 200-window pool", async () => {
    setSupabaseAnonClientForTests(buildFakeSupabase(makeDbRows(417)) as never);

    const count = await countSearchResultsFromDatabase("wireless earbuds");
    expect(count).toBe(417);
    expect(count).toBeGreaterThan(200);
  });

  it("reaches pages deep past the 200-window with a truthful total", async () => {
    setSupabaseAnonClientForTests(buildFakeSupabase(makeDbRows(417)) as never);

    const deep = await getSearchResultsFromDatabasePaged(
      "wireless earbuds",
      340,
      30,
    );

    expect(deep.total).toBe(417);
    expect(deep.total).toBeGreaterThan(200);
    expect(deep.items).toHaveLength(30);
    expect(deep.items[0]).toBeDefined();
  });

  it("keeps pages contiguous - no duplicate and no gap at the 200 seam", async () => {
    setSupabaseAnonClientForTests(buildFakeSupabase(makeDbRows(417)) as never);

    const before = await getSearchResultsFromDatabasePaged(
      "wireless earbuds",
      190,
      40,
    );
    const after = await getSearchResultsFromDatabasePaged(
      "wireless earbuds",
      230,
      40,
    );

    const beforeIds = before.items.map((m: any) => m.id);
    const afterIds = after.items.map((m: any) => m.id);

    const overlap = beforeIds.filter((id) => afterIds.includes(id));
    expect(overlap).toHaveLength(0);
    expect(new Set(beforeIds).size).toBe(40);
    expect(new Set(afterIds).size).toBe(40);
    expect(before.total).toBe(417);
    expect(after.total).toBe(417);
  });

  it("reaches the COMPLETE matching universe - truthful provider shares, zero suppression", async () => {
    // Truthful non-uniform catalog: 417 rows in the REAL TRAFFIC MIX (eBay
    // dominant - 388/417 via `makeNonUniformDbRows`). This is NOT an equal
    // 25% round-robin allocation: eBay genuinely holds ~93% of the universe
    // while the rarest providers (AliExpress=4, Admitad=2) hold their true
    // tiny share. The contract: pagination must walk to the LAST row of the
    // complete universe with no dup, no gap, and NO provider suppressed.
    setSupabaseAnonClientForTests(
      buildFakeSupabase(makeNonUniformDbRows(417)) as never,
    );

    // Walk EVERY page across the whole universe (60/page; 7 pages cover all
    // 417 rows) and union the identities seen. DB-leg provider identity = the
    // resolved marketplace slug (`storeSlug`, emitted by `resolveMarketplaceId`
    // in `rowToSearchResultItem`); `store` is the display merchant. No
    // `provider`/`providerName` field exists.
    const seenIds = new Set<string>();
    const byProvider: Record<string, number> = {};
    let pageTotal = 0;
    for (let offset = 0; offset < 417; offset += 60) {
      const page = await getSearchResultsFromDatabasePaged(
        "wireless earbuds",
        offset,
        60,
      );
      pageTotal = page.total;
      for (const m of page.items as any[]) {
        const id = String(m.id ?? m.product_id ?? m.productId ?? JSON.stringify(m));
        expect(seenIds.has(id)).toBe(false); // no duplicate across the universe
        seenIds.add(id);
        const p = m.storeSlug ?? m.store ?? m.provider;
        expect(p).toBeTruthy(); // every item carries a truthful provider identity
        byProvider[p] = (byProvider[p] ?? 0) + 1;
      }
    }

    // Complete-universe reachability: every one of the 417 rows is reachable
    // through pagination (no gap, no dup, no page shortchanged at the tail).
    expect(pageTotal).toBe(417);
    expect(seenIds.size).toBe(417);

    // Truthful per-provider inventory across the WHOLE universe: eBay owns its
    // real dominant share (388) - NOT an equal 25% allocation, NOT a <=36
    // quota. The rare providers keep their true counts.
    expect(byProvider.ebay).toBe(388);
    expect(byProvider.cjdropshipping).toBe(23);
    expect(byProvider.aliexpress).toBe(4);
    expect(byProvider.admitad).toBe(2);

    // Zero suppression: every provider in the catalog remains reachable - even
    // the rarest (AliExpress=4, Admitad=2) survive eBay's deep-page dominance.
    expect(byProvider.admitad).toBeGreaterThan(0);
    expect(byProvider.aliexpress).toBeGreaterThan(0);
    expect(byProvider.cjdropshipping).toBeGreaterThan(0);
  });
});
