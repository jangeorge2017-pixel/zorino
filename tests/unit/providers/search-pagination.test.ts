import { describe, it, expect } from "vitest";
import { sliceSearchPage } from "@/lib/search/engine";
import { mergePagedResults } from "@/lib/search/pagination";
import type { SearchResultItem } from "@/lib/data/homepage";

function makeItems(n: number): SearchResultItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `item-${i}`,
    name: `Product ${i}`,
    imageSrc: `https://img.example/${i}.jpg`,
    emoji: "📦",
    price: 10 + i,
    originalPrice: 20 + i,
    discount: 10,
    store: "Provider",
    storeSlug: "provider",
    rating: 4.5,
    reviewCount: 100,
    inStock: true,
    category: "electronics",
  }));
}

describe("sliceSearchPage", () => {
  it("returns the first page with hasMore when the pool is longer", () => {
    const pool = makeItems(120);
    const page = sliceSearchPage(pool, 0, 50);
    expect(page.items).toHaveLength(50);
    expect(page.total).toBe(120);
    expect(page.offset).toBe(0);
    expect(page.limit).toBe(50);
    expect(page.hasMore).toBe(true);
    expect(page.items[0].id).toBe("item-0");
    expect(page.items[49].id).toBe("item-49");
  });

  it("serves contiguous, non-overlapping pages over a stable pool", () => {
    const pool = makeItems(120);
    const p1 = sliceSearchPage(pool, 0, 50);
    const p2 = sliceSearchPage(pool, 50, 50);
    const p3 = sliceSearchPage(pool, 100, 50);
    const ids = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
    expect(ids).toEqual(pool.map((i) => i.id));
    expect(p1.hasMore).toBe(true);
    expect(p2.hasMore).toBe(true);
    expect(p3.hasMore).toBe(false);
  });

  it("last page is shorter and hasMore is false", () => {
    const pool = makeItems(117);
    const page = sliceSearchPage(pool, 100, 50);
    expect(page.items).toHaveLength(17);
    expect(page.total).toBe(117);
    expect(page.hasMore).toBe(false);
  });

  it("empty pool yields an empty page, total 0, hasMore false", () => {
    const page = sliceSearchPage([], 0, 50);
    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(0);
    expect(page.hasMore).toBe(false);
  });

  it("clamps negative offsets to 0", () => {
    const pool = makeItems(10);
    const page = sliceSearchPage(pool, -5, 5);
    expect(page.offset).toBe(0);
    expect(page.items).toHaveLength(5);
  });

  it("offset beyond the pool yields empty items and no more", () => {
    const pool = makeItems(10);
    const page = sliceSearchPage(pool, 50, 5);
    expect(page.items).toHaveLength(0);
    expect(page.hasMore).toBe(false);
    expect(page.total).toBe(10);
  });

  it("clamps NaN offset to 0 and default limit to PAGE_SIZE=50", () => {
    const pool = makeItems(80);
    const page = sliceSearchPage(pool, Number.NaN, Number.NaN);
    expect(page.offset).toBe(0);
    expect(page.limit).toBe(50);
    expect(page.items).toHaveLength(50);
    expect(page.hasMore).toBe(true);
  });
});

describe("mergePagedResults", () => {
  it("appends an incoming page after the existing items", () => {
    const existing = makeItems(3);
    const incoming = makeItems(2).map((item, i) => ({ ...item, id: `p2-${i}` }));
    const merged = mergePagedResults(existing, incoming);
    expect(merged.map((i) => i.id)).toEqual(["item-0", "item-1", "item-2", "p2-0", "p2-1"]);
  });

  it("drops duplicates already present (overlap-safe after pool eviction)", () => {
    const existing = makeItems(3);
    const incoming = [makeItems(2)[0], makeItems(1).map((i) => ({ ...i, id: "new-0" }))[0]];
    const merged = mergePagedResults(existing, incoming);
    expect(merged.map((i) => i.id)).toEqual(["item-0", "item-1", "item-2", "new-0"]);
  });

  it("returns the same array reference when nothing new arrives", () => {
    const existing = makeItems(3);
    const merged = mergePagedResults(existing, makeItems(3));
    expect(merged).toBe(existing);
  });

  it("never duplicates: full overlap yields no growth", () => {
    const existing = makeItems(5);
    const merged = mergePagedResults(existing, makeItems(5));
    expect(merged).toHaveLength(5);
  });

  it("handles empty incoming page", () => {
    const existing = makeItems(2);
    expect(mergePagedResults(existing, [])).toBe(existing);
  });
});