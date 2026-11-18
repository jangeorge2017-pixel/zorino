import { describe, expect, it } from "vitest";

import {
  PERSISTENT_SEARCH_MAX_ITEMS,
  PERSISTENT_SEARCH_TTL_MS,
  buildPersistentSearchKey,
  isPersistentSearchEntryStale,
} from "@/lib/search/persistent-cache-store";

describe("persistent search cache", () => {
  it("normalizes query whitespace/case and keys on shaping options", () => {
    expect(
      buildPersistentSearchKey("  iPhone   15 Pro ", {
        sortBy: "price",
        activeCurrency: "EGP",
        useFuzzyMatch: true,
      }),
    ).toBe("iphone 15 pro|sort:price|cur:EGP|fuzzy:1");
  });

  it("defaults to relevance/USD/non-fuzzy", () => {
    expect(buildPersistentSearchKey("tv")).toBe(
      "tv|sort:relevance|cur:USD|fuzzy:0",
    );
  });

  it("treats entries older than the 6h TTL as stale", () => {
    const fresh = new Date().toISOString();
    const stale = new Date(
      Date.now() - PERSISTENT_SEARCH_TTL_MS - 1_000,
    ).toISOString();
    expect(isPersistentSearchEntryStale(fresh)).toBe(false);
    expect(isPersistentSearchEntryStale(stale)).toBe(true);
    expect(isPersistentSearchEntryStale("not-a-date")).toBe(true);
  });

  it("caps the stored/returned pool at 40-60 products", () => {
    expect(PERSISTENT_SEARCH_MAX_ITEMS).toBe(60);
  });
});
