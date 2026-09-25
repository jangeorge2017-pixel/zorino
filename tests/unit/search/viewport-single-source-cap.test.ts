import { describe, expect, it } from "vitest";
import {
  enforceViewportSingleSourceCap,
  VIEWPORT_SINGLE_SOURCE_MAX_SHARE,
} from "@/lib/search/production-pipeline";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";

type Row = { id: string; p: string };

const hits = (rows: Row[], until: number): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const row of rows.slice(0, until)) {
    counts[row.p] = (counts[row.p] ?? 0) + 1;
  }
  return counts;
};

const ids = (rows: Row[]): string[] => rows.map((r) => r.id);

describe("enforceViewportSingleSourceCap", () => {
  it("is a pure permutation — same membership and length, never a drop", () => {
    const pool: Row[] = [];
    for (let i = 0; i < 50; i++) pool.push({ id: `e${i}`, p: "ebay" });
    for (let i = 0; i < 50; i++) pool.push({ id: `a${i}`, p: "aliexpress" });

    const out = enforceViewportSingleSourceCap(pool, (r) => r.p);

    expect(out).toHaveLength(pool.length);
    expect(new Set(ids(out))).toEqual(new Set(ids(pool)));
  });

  it("caps a single source at 60% of a full page window while any peer is present", () => {
    // Window 1: 30 ebay + 20 aliexpress (ebay exactly at the 60% cap — all kept).
    // Window 2: 40 ebay + 10 aliexpress (ebay 40 > cap 30 — 10 surplus deferred).
    const pool: Row[] = [];
    for (let i = 0; i < 30; i++) pool.push({ id: `e${i}`, p: "ebay" });
    for (let i = 0; i < 20; i++) pool.push({ id: `a${i}`, p: "aliexpress" });
    for (let i = 30; i < 70; i++) pool.push({ id: `e${i}`, p: "ebay" });
    for (let i = 20; i < 30; i++) pool.push({ id: `a${i}`, p: "aliexpress" });

    const pageSize = SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
    const out = enforceViewportSingleSourceCap(pool, (r) => r.p);

    const cap = Math.floor(pageSize * VIEWPORT_SINGLE_SOURCE_MAX_SHARE);
    expect(cap).toBe(30);
    // Pure permutation — nothing dropped, everything reachable.
    expect(out).toHaveLength(pool.length);
    expect(new Set(ids(out))).toEqual(new Set(ids(pool)));
    // Page 1 (the first full 50-slot window) honors the cap exactly.
    expect(hits(out, pageSize)).toEqual({ ebay: 30, aliexpress: 20 });
    // Window 2 kept 30 ebay + 10 aliexpress in place; its 10-ebay surplus
    // (e60..e69) was deferred to the pool tail, still reachable later.
    expect(ids(out.slice(50, 90))).toEqual([
      ...ids(pool.slice(50, 80)), // e30..e59 kept
      ...ids(pool.slice(90)), // a20..a29 kept
    ]);
    expect(ids(out.slice(90))).toEqual(ids(pool.slice(80, 90))); // e60..e69 deferred
  });

  it("applies identically to a pool derived from PRICE mode (cap is sort-agnostic)", () => {
    // Mirrors the window-2 cap case in the sibling test, framed as the pool a
    // price-sorted search would feed in: page 1 is 35 ebay + 15 aliexpress —
    // ebay (35) exceeds the 60% cap (30) → 5 surplus deferred to the tail,
    // nothing dropped, everything still reachable.
    const pool: Row[] = [];
    for (let i = 0; i < 35; i++) pool.push({ id: `e${i}`, p: "ebay" });
    for (let i = 0; i < 15; i++) pool.push({ id: `a${i}`, p: "aliexpress" });

    const out = enforceViewportSingleSourceCap(pool, (r) => r.p);

    expect(out).toHaveLength(pool.length);
    expect(new Set(ids(out))).toEqual(new Set(ids(pool)));
    // The five surplus ebay seats (e30..e34) are deferred to the tail.
    expect(ids(out.slice(45))).toEqual(["e30", "e31", "e32", "e33", "e34"]);
    expect(ids(out.slice(0, 45))).toEqual([
      ...ids(pool.slice(0, 30)), // 30 ebay kept
      ...ids(pool.slice(35)), // 15 aliexpress kept
    ]);
  });

  it("leaves a lone-provider window untouched (genuine volume never trimmed)", () => {
    const pool: Row[] = [];
    for (let i = 0; i < 50; i++) pool.push({ id: `e${i}`, p: "ebay" });
    for (let i = 0; i < 50; i++) pool.push({ id: `a${i}`, p: "aliexpress" });

    const out = enforceViewportSingleSourceCap(pool, (r) => r.p);

    // Window 1 is 50/50 ebay (single provider) — untouched, all 50 kept at the
    // head; the cap only bites on the mixed window 2.
    expect(ids(out.slice(0, 50))).toEqual(ids(pool.slice(0, 50)));
  });

  it("leaves a partial final window untouched", () => {
    const pool: Row[] = [];
    for (let i = 0; i < 20; i++) pool.push({ id: `e${i}`, p: "ebay" });
    for (let i = 0; i < 10; i++) pool.push({ id: `a${i}`, p: "aliexpress" });

    const out = enforceViewportSingleSourceCap(pool, (r) => r.p);

    expect(ids(out)).toEqual(ids(pool));
  });

  it("leaves a balanced window untouched (no provider over budget anyway)", () => {
    const pool: Row[] = [];
    for (let i = 0; i < 25; i++) pool.push({ id: `e${i}`, p: "ebay" });
    for (let i = 0; i < 25; i++) pool.push({ id: `a${i}`, p: "aliexpress" });

    const out = enforceViewportSingleSourceCap(pool, (r) => r.p);

    expect(ids(out)).toEqual(ids(pool));
  });

  it("honours custom windowSize/maxShare (window 5, share 0.6 → cap 3)", () => {
    const pool: Row[] = [
      { id: "e0", p: "ebay" },
      { id: "e1", p: "ebay" },
      { id: "e2", p: "ebay" },
      { id: "e3", p: "ebay" },
      { id: "a0", p: "aliexpress" },
    ];
    const out = enforceViewportSingleSourceCap(pool, (r) => r.p, 5, 0.6);

    // ebay 4 > cap 3 → one ebay row deferred to the tail; aliexpress keeps its
    // seat; total unchanged.
    expect(ids(out)).toEqual(["e0", "e1", "e2", "a0", "e3"]);
  });

  it("server-renders determinism: repeated calls return identical order", () => {
    const pool: Row[] = [];
    for (let i = 0; i < 40; i++) pool.push({ id: `e${i}`, p: "ebay" });
    for (let i = 0; i < 10; i++) pool.push({ id: `a${i}`, p: "aliexpress" });
    for (let i = 40; i < 60; i++) pool.push({ id: `e${i}`, p: "ebay" });

    const a = enforceViewportSingleSourceCap(pool, (r) => r.p);
    const b = enforceViewportSingleSourceCap(pool, (r) => r.p);
    expect(ids(a)).toEqual(ids(b));
  });
});