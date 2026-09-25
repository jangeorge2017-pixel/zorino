/**
 * DEVICE-intent DB tail pagination regression (page 2 of a handset query).
 *
 * Live defects on /search (e.g. "iPhone 15 Pro Max"):
 *   - `total` flapped between the raw 120K accessory-inclusive match count and
 *     the pool length because the exact-count race resolved 0 on its 8s
 *     deadline.
 *   - Page 2 (offset 50) returned 0 rows: the beyond-pool DB leg is
 *     discount-ordered, so its windows were saturated with accessories and the
 *     in-memory strict device guard dropped every row in the page.
 *
 * The fix moves the guard INTO the DB legs for device-intent queries:
 *   - SQL pre-filters (accessory word-boundary `not`, handset price floor,
 *     brand must-contain) stop accessories from consuming the window;
 *   - the leg fetches a deep window (`DEVICE_TAIL_DEEP_WINDOW`, under the
 *     Supabase 1000-row cap), re-applies `passesStrictDeviceGuard` in JS,
 *     ranks by query-word overlap, then slices at the offset;
 *   - `total` is the length of that guard-passing sequence (the SAME in the
 *     count leg), and the count is cached 5 min so it can never flap.
 *
 * This file drives the REAL exported legs with a fake Supabase that honours
 * the SQL device filters (imatch regexes, price floor, brand OR, set
 * exclusion) — no module mocking.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  countSearchResultsFromDatabase,
  getSearchResultsFromDatabasePaged,
  resetDeviceSearchCountCacheForTests,
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

/**
 * 100-row catalog for "iphone 15 pro max":
 *   - 40 ACCESSORIES, heavily discounted (90–95%) — in discount order they own
 *     the head of the universe, exactly the shape that used to empty page 2.
 *   - 60 GENUINE handsets (20–30% discount, $700–$1600 USD).
 */
function makeRows(): DbRow[] {
  const accessoryTitles = [
    "Tempered Glass Screen Protector for iPhone 15 Pro Max",
    "Silicone Compatible Case for iPhone 15 Pro Max",
    "Magnetic Car Air Vent Holder for iPhone 15 Pro Max",
    "USB-C Fast Charger for iPhone 15 Pro Max",
    "Wireless Charging Stand for iPhone 15 Pro Max",
    "HD Tempered Glass Film for iPhone 15 Pro",
    "iPhone 15 Pro Max Leather Cover",
    "Magnetic Ultra Thin Bumper Case for iPhone 15 Pro",
    "Glass Screen Protector 3 Packs for iPhone 15 Pro Max",
    "Rotating Mount for iPhone 15 Pro Max",
  ];
  const genuineTitles = [
    "Apple iPhone 15 Pro Max 256GB Titanium Factory Unlocked",
    "Apple iPhone 15 Pro Max 1TB Natural Titanium Unlocked",
    "Apple iPhone 15 Pro 128GB Black Titanium",
    "Apple iPhone 15 Pro Max 512GB Blue Titanium",
    "Apple iPhone 15 Pro 256GB White Titanium",
    "Apple iPhone 15 Pro Max 256GB",
  ];
  const rows: DbRow[] = [];
  for (let i = 0; i < 40; i++) {
    rows.push({
      product_id: `acc-${String(i).padStart(3, "0")}`,
      product_name: `${accessoryTitles[i % accessoryTitles.length]} (${i})`,
      image_url: `https://img.example/acc-${i}.jpg`,
      discount_percent: 95 - (i % 5),
      lowest_price: Number((4.99 + i * 0.4).toFixed(2)),
      original_price: Number((99.99 + i * 0.4).toFixed(2)),
      store_name: "Store aliexpress",
      provider: "aliexpress",
      country_code: "US",
      currency: "USD",
    });
  }
  for (let i = 0; i < 60; i++) {
    rows.push({
      product_id: `phone-${String(i).padStart(3, "0")}`,
      product_name: `${genuineTitles[i % genuineTitles.length]} (${i})`,
      image_url: `https://img.example/phone-${i}.jpg`,
      discount_percent: 30 - (i % 10),
      lowest_price: Number((700 + i * 15).toFixed(2)),
      original_price: Number((999 + i * 15).toFixed(2)),
      store_name: "Store ebay",
      provider: "ebay",
      country_code: "US",
      currency: "USD",
    });
  }
  return rows;
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
 * Parse a PostgREST `or` clause string of the form
 * `product_name.imatch.\miphone\M,product_name.imatch.\m15\M` into JS
 * word-boundary regexes (the same ARE dialect the production `imatch`
 * operator turns into `~*`).
 */
function parseOrFilter(clause: string): RegExp[] {
  return clause
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const token = c.replace(/^product_name\.imatch\./, "");
      return new RegExp(token.replace(/\\m/g, "\\b").replace(/\\M/g, "\\b"), "i");
    });
}

/** Fake supabase honouring the device SQL filters + products leg. */
function buildFakeSupabase(rows: DbRow[], stats: { ranges: number }): () => unknown {
  const ordered = serverOrdered(rows);
  const orGroups: RegExp[][] = [];
  const notImatch: RegExp[] = [];
  let priceFloor: number | null = null;
  let excluded = new Set<string>();

  const apply = (r: DbRow): boolean => {
    if (excluded.has(r.product_id)) return false;
    for (const group of orGroups) {
      if (!group.some((re) => re.test(r.product_name))) return false;
    }
    for (const re of notImatch) {
      if (re.test(r.product_name)) return false;
    }
    if (priceFloor !== null && r.lowest_price < priceFloor) return false;
    return true;
  };

  const dbChain = {
    select: () => dbChain,
    or: (clause: string) => {
      orGroups.push(parseOrFilter(clause));
      return dbChain;
    },
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
      } else if (col === "product_name" && op === "imatch" && typeof val === "string") {
        notImatch.push(new RegExp(val, "i"));
      }
      return dbChain;
    },
    neq: () => dbChain,
    gte: (col: string, value: number) => {
      if (col === "lowest_price") priceFloor = value;
      return dbChain;
    },
    order: () => dbChain,
    range: (from: number, to: number) => {
      stats.ranges += 1;
      const universe = ordered.filter(apply);
      return Promise.resolve({
        data: universe.slice(from, to + 1),
        count: universe.length,
        error: null,
      });
    },
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        count: ordered.filter(apply).length,
        error: null,
      }).then(resolve),
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
                    .map((r) => ({ id: r.product_id, category_slug: "mobile" })),
                  error: null,
                }),
            }),
          }
        : dbChain,
  });
}

const QUERY = "iphone 15 pro max";
const DEVICE = { query: QUERY, activeCurrency: "USD" as const };

let stats: { ranges: number };

beforeEach(() => {
  resetDeviceSearchCountCacheForTests();
  stats = { ranges: 0 };
  setSupabaseAnonClientForTests(buildFakeSupabase(makeRows(), stats) as never);
});

afterEach(() => {
  resetDeviceSearchCountCacheForTests();
  resetRealCatalogProductCountForTests();
});

describe("device-intent DB tail pages a genuine handset sequence", () => {
  it("counts the guard-passing universe (60), not the raw 100 accessory-inclusive match count", async () => {
    const raw = await countSearchResultsFromDatabase(QUERY);
    expect(raw).toBe(100);

    const device = await countSearchResultsFromDatabase(QUERY, { device: DEVICE });
    expect(device).toBe(60);
  });

  it("page 2 (offset 50) renders the next batch of genuine handsets, never 0", async () => {
    const page1 = await getSearchResultsFromDatabasePaged(QUERY, 0, 50, {
      device: DEVICE,
    });
    expect(page1.items).toHaveLength(50);
    expect(page1.total).toBe(60);

    const page2 = await getSearchResultsFromDatabasePaged(QUERY, 50, 50, {
      device: DEVICE,
    });
    expect(page2.items).toHaveLength(10); // 60 - 50 reachable
    expect(page2.total).toBe(60); // truthful (device) total — no accessory inflation

    for (const item of [...page1.items, ...page2.items]) {
      expect(item.name).toMatch(/iphone/i);
      expect(item.name).not.toMatch(
        /case|cover|glass|protector|charger|stand|holder|cable|mount|film|bracket/i,
      );
    }
    const ids = [...page1.items, ...page2.items].map((m) => m.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("without the device option the tail keeps the raw discount-ordered universe (opt-in preserved)", async () => {
    const page1 = await getSearchResultsFromDatabasePaged(QUERY, 0, 50);
    expect(page1.items).toHaveLength(50);
    expect(page1.total).toBe(100);
    // The raw discount head is the accessories — the exact leak device legs fix.
    expect(page1.items.some((m) => /case|glass|stand|charger|holder/i.test(m.name))).toBe(
      true,
    );
  });

  it("device total stays consistent between count and paged calls (no flap)", async () => {
    const count = await countSearchResultsFromDatabase(QUERY, { device: DEVICE });
    const page1 = await getSearchResultsFromDatabasePaged(QUERY, 0, 50, {
      device: DEVICE,
    });
    const page2 = await getSearchResultsFromDatabasePaged(QUERY, 50, 50, {
      device: DEVICE,
    });
    expect(count).toBe(60);
    expect(page1.total).toBe(60);
    expect(page2.total).toBe(60);
  });

  it("successful counts are cached for 5 min; the cache reset forces a refetch", async () => {
    const callDeviceCount = () =>
      countSearchResultsFromDatabase(QUERY, { device: DEVICE });

    await callDeviceCount();
    const rangesAfterFirst = stats.ranges;
    expect(rangesAfterFirst).toBeGreaterThan(0);

    // Second identical call is served from cache — no further range fetch.
    const second = await callDeviceCount();
    expect(second).toBe(60);
    expect(stats.ranges).toBe(rangesAfterFirst);

    // Reset clears the cache → the next call refetches.
    resetDeviceSearchCountCacheForTests();
    const third = await callDeviceCount();
    expect(third).toBe(60);
    expect(stats.ranges).toBe(rangesAfterFirst + 1);
  });
});