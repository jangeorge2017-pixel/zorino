/**
 * Fix 5 regression tests — homepage "Products" counter.
 *
 * Observed production bug (verified against live homepage HTML + live Supabase):
 *   Homepage rendered 28 product cards but the hero showed "Products: 0".
 *
 * Root cause (reproduced against the live 120K-row table):
 *   `getRealCatalogProductCount()` ran the exact-count query with the
 *   string-form `.or("provider.in.(...)")` filter. That query shape is planned
 *   as a PostgREST `or` filter and consistently fails with a 500 / ~4s
 *   statement cancellation — the count never arrives, all 3 retries fail, and
 *   the function returns the module-level `lastKnownProductCount` which is 0 on
 *   a fresh instance. The same data read through the array-form
 *   `.in("provider", [...])` filter returns the exact count in <1s.
 *
 * Locked-down guarantees:
 *   - A working DB source returns the real exact count.
 *   - A DB failure NEVER surfaces a misleading 0 while a valid real fallback
 *     (the merged live catalog the homepage renders) exists.
 *   - Returns 0 only when every real source is genuinely empty/unavailable.
 *   - Existing homepage behavior is unchanged (count function signature/UI
 *     contract preserved; homepage section tests still pass).
 *
 * The tests inject fake client/fallback sources through the exported test
 * seams instead of mocking modules, because the suite runs with
 * isolate:false + singleFork:true where per-module mocks are unreliable.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  getRealCatalogProductCount,
  resetRealCatalogProductCountForTests,
  setCatalogFallbackCountForTests,
  setProductCountPersistenceForTests,
  setSupabaseAnonClientForTests,
} from "@/lib/integration/database-catalog";

/** Fake supabase chain: .from().select().eq().eq().in() thenable. */
function buildClient(result: {
  count?: number | null;
  error?: unknown;
}): () => unknown {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () =>
      Promise.resolve({
        count: result.count ?? null,
        error: result.error ?? null,
      }),
  };
  return () => ({ from: () => chain });
}

afterEach(() => {
  resetRealCatalogProductCountForTests();
});

describe("homepage Products counter (Fix 5)", () => {
  it("returns the real exact product count when the DB source succeeds", async () => {
    setSupabaseAnonClientForTests(buildClient({ count: 69_907 }) as never);
    setCatalogFallbackCountForTests(async () => 0);

    const count = await getRealCatalogProductCount();

    expect(count).toBe(69_907);
    expect(count).toBeGreaterThan(0);
  });

  it("uses the merged live catalog as a real fallback instead of reporting 0", async () => {
    setSupabaseAnonClientForTests(
      buildClient({ count: null, error: { message: "statement timeout" } }) as never,
    );
    setCatalogFallbackCountForTests(async () => 22);

    const count = await getRealCatalogProductCount();

    // The DB count failed (all retries) yet 22 real catalog products exist —
    // the stat must reflect them, never flicker to 0.
    expect(count).toBe(22);
    expect(count).toBeGreaterThan(0);
  });

  it("never lets a transient exact-count failure downgrade the stat to the tiny merged-catalog sample", async () => {
    // Simulate a healthy read first (caches the real catalog size)...
    setSupabaseAnonClientForTests(buildClient({ count: 69_907 }) as never);
    setCatalogFallbackCountForTests(async () => 0);
    expect(await getRealCatalogProductCount()).toBe(69_907);

    // ...then the exact-count query fails transiently. The merged catalog is
    // only a bounded per-merchant sample (~18 items, single provider visible),
    // so its length must NOT replace the real catalog size in the stat.
    setSupabaseAnonClientForTests(
      buildClient({ count: null, error: { message: "statement timeout" } }) as never,
    );
    setCatalogFallbackCountForTests(async () => 18);

    const count = await getRealCatalogProductCount();

    // The truthful last-known-good count wins; the tiny sample length is never
    // surfaced as the primary ProductCount while a real known-good exists.
    expect(count).toBe(69_907);
    expect(count).toBeGreaterThan(18);
  });

  it("falls back to last-known-good when the DB and catalog are both down", async () => {
    // Simulate one successful read first (caches the known-good count)...
    setSupabaseAnonClientForTests(buildClient({ count: 69_907 }) as never);
    setCatalogFallbackCountForTests(async () => 0);
    expect(await getRealCatalogProductCount()).toBe(69_907);

    // ...then all sources go down. The stat must NOT become 0; it holds the
    // last real value instead of claiming the catalog vanished.
    setSupabaseAnonClientForTests(
      buildClient({ count: null, error: { message: "unreachable" } }) as never,
    );
    setCatalogFallbackCountForTests(async () => 0);

    const count = await getRealCatalogProductCount();

    expect(count).toBe(69_907);
    expect(count).toBeGreaterThan(0);
  });

  it("returns 0 only when every real source is unavailable and no known-good", async () => {
    // No prior known-good count (fresh instance), unconfigured client, empty
    // catalog — the only case 0 is honest: every real source is truly empty.
    setSupabaseAnonClientForTests(
      buildClient({ count: null, error: { message: "unreachable" } }) as never,
    );
    setCatalogFallbackCountForTests(async () => 0);

    const count = await getRealCatalogProductCount();

    expect(count).toBe(0);
  });

  it("accepts a real count reported as 0 when the DB genuinely says 0", async () => {
    setSupabaseAnonClientForTests(buildClient({ count: 0 }) as never);
    setCatalogFallbackCountForTests(async () => 12);

    const count = await getRealCatalogProductCount();

    // A truthful 0 from the source is authoritative — never replaced by the
    // fallback (which would fabricate product existence).
    expect(count).toBe(0);
  });

  it("persists the last-known-good real count so a fresh instance can restore it", async () => {
    let persisted = 0;
    setProductCountPersistenceForTests({
      writer: async (count) => {
        persisted = count;
      },
    });
    setSupabaseAnonClientForTests(buildClient({ count: 69_907 }) as never);
    setCatalogFallbackCountForTests(async () => 0);

    expect(await getRealCatalogProductCount()).toBe(69_907);

    // The persist is fire-and-forget on the stat path — flush the microtask.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(persisted).toBe(69_907);
  });

  it("restores the persisted real count on a cold instance after a DB failure", async () => {
    // Fresh instance: module-level lastKnownProductCount is 0 (afterEach
    // reset). The exact-count query fails again, but the persisted real count
    // from a previous healthy read must win over the tiny merged-catalog
    // sample — this is the reported production "383+/17+" degradation.
    setProductCountPersistenceForTests({
      reader: async () => 69_907,
    });
    setSupabaseAnonClientForTests(
      buildClient({ count: null, error: { message: "statement timeout" } }) as never,
    );
    setCatalogFallbackCountForTests(async () => 18);

    const count = await getRealCatalogProductCount();

    expect(count).toBe(69_907);
    expect(count).toBeGreaterThan(18);
  });

  it("still prefers the module-level last-known-good over the persisted value", async () => {
    // A healthy read this instance observed 69_907; the persisted row (older,
    // 68_000) must NOT downgrade the fresher in-memory value.
    setProductCountPersistenceForTests({
      reader: async () => 68_000,
    });
    setSupabaseAnonClientForTests(buildClient({ count: 69_907 }) as never);
    setCatalogFallbackCountForTests(async () => 0);
    expect(await getRealCatalogProductCount()).toBe(69_907);

    setSupabaseAnonClientForTests(
      buildClient({ count: null, error: { message: "statement timeout" } }) as never,
    );
    setCatalogFallbackCountForTests(async () => 18);

    const count = await getRealCatalogProductCount();

    expect(count).toBe(69_907);
  });
});