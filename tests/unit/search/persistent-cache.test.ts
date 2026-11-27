import { describe, expect, it } from "vitest";

import type { SearchResultItem } from "@/lib/data/homepage";
import { getSearchCacheVersion } from "@/lib/search/cache-version";
import {
  CRITICAL_SEARCH_PROVIDER_IDS,
  PERSISTENT_SEARCH_MAX_ITEMS,
  PERSISTENT_SEARCH_TTL_MS,
  buildPersistentSearchKey,
  getMissingCriticalSearchProviders,
  isIncompletePersistentSearchPool,
  isPersistentSearchEntryStale,
} from "@/lib/search/persistent-cache-store";

function item(store: string, storeSlug: string): SearchResultItem {
  return { store, storeSlug } as unknown as SearchResultItem;
}

describe("persistent search cache", () => {
  it("normalizes query whitespace/case and keys on shaping options", () => {
    expect(
      buildPersistentSearchKey("  iPhone   15 Pro ", {
        sortBy: "price",
        activeCurrency: "EGP",
        useFuzzyMatch: true,
      }),
    ).toBe(
      `${getSearchCacheVersion()}|iphone 15 pro|sort:price|cur:EGP|fuzzy:1|orig:`,
    );
  });

  it("defaults to relevance/USD/non-fuzzy", () => {
    expect(buildPersistentSearchKey("tv")).toBe(
      `${getSearchCacheVersion()}|tv|sort:relevance|cur:USD|fuzzy:0|orig:`,
    );
  });

  it("treats entries older than the 30min TTL as stale", () => {
    const fresh = new Date().toISOString();
    const stale = new Date(
      Date.now() - PERSISTENT_SEARCH_TTL_MS - 1_000,
    ).toISOString();
    expect(isPersistentSearchEntryStale(fresh)).toBe(false);
    expect(isPersistentSearchEntryStale(stale)).toBe(true);
    expect(isPersistentSearchEntryStale("not-a-date")).toBe(true);
  });

  it("caps the stored/returned pool at 60 products", () => {
    expect(PERSISTENT_SEARCH_MAX_ITEMS).toBe(60);
  });

  it("treats short pools as incomplete even with all critical providers", () => {
    const rich = [
      item("Amazon Egypt", "amazon-eg"),
      item("AliExpress", "aliexpress"),
      item("Jumia", "jumia"),
      ...Array.from({ length: 45 }, (_, index) => item(`Store ${index}`, `store-${index}`)),
    ];
    expect(isIncompletePersistentSearchPool(rich)).toBe(false);
    expect(isIncompletePersistentSearchPool(rich.slice(0, 47))).toBe(true);
  });

  it("detects pools that silently dropped a critical provider", () => {
    const complete = [
      item("Amazon Egypt", "amazon-eg"),
      item("AliExpress", "aliexpress"),
      item("Jumia", "jumia"),
    ];
    expect(getMissingCriticalSearchProviders(complete)).toEqual([]);

    expect(
      getMissingCriticalSearchProviders([
        item("AliExpress", "aliexpress"),
        item("Jumia", "jumia"),
      ]),
    ).toEqual(["amazon-eg"]);

    expect(getMissingCriticalSearchProviders([])).toEqual([
      ...CRITICAL_SEARCH_PROVIDER_IDS,
    ]);
  });

  it("normalizes store display names before deciding coverage", () => {
    expect(
      getMissingCriticalSearchProviders([
        item("Amazon Egypt", "Amazon Egypt"),
        item("AliExpress", "AliExpress"),
        item("Jumia", "Jumia Egypt"),
      ]),
    ).toEqual([]);
  });
});
