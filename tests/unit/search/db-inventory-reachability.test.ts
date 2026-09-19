/**
 * Regression guards for the Search coverage fix (Phase 2).
 *
 * Root cause (verified against production PostgREST): the DB supplement and the
 * Admitad ingested-row top-up built their word-boundary filter with the
 * operator `iregex`, which is NOT a valid PostgREST operator. Every such query
 * failed with `PGRST100` before reaching Postgres; the error was swallowed, so
 * the entire DB-imported inventory was silently invisible to Search. The valid
 * case-insensitive POSIX-regex operator is `imatch` (→ `~*`).
 *
 * The second guard locks the new interleave: relevant DB products must stay
 * reachable within the display cap even when the live pool alone fills it
 * (previously they were appended after a full pool and dropped entirely).
 */
import { describe, expect, it } from "vitest";

import {
  buildWordBoundaryOrFilter,
  escapeRegexToken,
} from "@/lib/integration/word-match-filter";
import { interleaveLiveAndDbResults } from "@/lib/search/engine";
import type { SearchResultItem } from "@/lib/data/homepage";

describe("buildWordBoundaryOrFilter — PostgREST-valid operator", () => {
  it("uses imatch (case-insensitive regex), never the invalid iregex", () => {
    const filter = buildWordBoundaryOrFilter(["iphone", "15"]);

    expect(filter).toBe(
      "product_name.imatch.\\miphone\\M,product_name.imatch.\\m15\\M",
    );
    expect(filter).not.toContain("iregex");
  });

  it("anchors each token as a whole word with \\m…\\M", () => {
    expect(buildWordBoundaryOrFilter(["pro"])).toBe(
      "product_name.imatch.\\mpro\\M",
    );
  });

  it("escapes regex metacharacters in tokens", () => {
    expect(buildWordBoundaryOrFilter(["a.b"])).toBe(
      "product_name.imatch.\\ma\\.b\\M",
    );
    expect(escapeRegexToken("1+1")).toBe("1\\+1");
  });
});

function item(id: string): SearchResultItem {
  return {
    id,
    name: `Product ${id}`,
    imageSrc: `https://img.example/${id}.jpg`,
    emoji: "🛍️",
    price: 10,
    originalPrice: 12,
    discount: 16,
    store: "Store",
    storeSlug: "admitad",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    category: "General",
    affiliateUrl: `https://go.example/${id}`,
  };
}

const live = (n: number) => Array.from({ length: n }, (_, i) => item(`live-${i}`));
const db = (n: number) => Array.from({ length: n }, (_, i) => item(`db-${i}`));

describe("interleaveLiveAndDbResults — DB inventory stays reachable at the cap", () => {
  it("reserves canonical cadence from slot 0 — a live fill saturating the cap cannot unbudget the DB slots", () => {
    const mixed = interleaveLiveAndDbResults(live(200), db(100), 200, 20, 4);

    expect(mixed).toHaveLength(200);

    // Cadence-first: every dbEvery-th slot (0-based, from slot 0) is a canonical
    // DB row. A busy live pool structurally cannot monopolize the window.
    for (let i = 0; i < 50; i++) {
      expect(mixed[i * 4]!.id).toBe(`db-${i}`);
    }

    const dbCount = mixed.filter((m) => m.id.startsWith("db-")).length;
    expect(dbCount).toBe(50);

    // No duplicates and only source items are emitted.
    expect(new Set(mixed.map((m) => m.id)).size).toBe(mixed.length);
    const liveIds = new Set(live(200).map((m) => m.id));
    const dbIds = new Set(db(100).map((m) => m.id));
    expect(mixed.every((m) => liveIds.has(m.id) || dbIds.has(m.id))).toBe(true);
  });

  it("holds the cadence seam from slot 0 even for a short live block (Bug 4 guard preserved)", () => {
    const mixed = interleaveLiveAndDbResults(live(2), db(2), 20, 10, BigInt(4));
    expect(mixed.map((m) => m.id)).toEqual([
      "db-0",
      "live-0",
      "live-1",
      "db-1",
    ]);
  });

  it("drains DB rows when there is no live result at all", () => {
    const mixed = interleaveLiveAndDbResults([], db(5), 3, 10, 4);
    expect(mixed.map((m) => m.id)).toEqual(["db-0", "db-1", "db-2"]);
  });

  it("returns an empty pool for a non-positive cap", () => {
    expect(interleaveLiveAndDbResults(live(5), db(5), 0, 10, 4)).toEqual([]);
  });

  it("never emits more DB rows than are supplied", () => {
    const mixed = interleaveLiveAndDbResults(live(200), db(3), 200, 20, 4);
    expect(mixed.filter((m) => m.id.startsWith("db-"))).toHaveLength(3);
  });
});
