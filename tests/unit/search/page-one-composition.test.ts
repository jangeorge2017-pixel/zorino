/**
 * Page-1 composition regression suite.
 *
 * Live defect being locked: a device-intent /search pool is assembled
 * device-first and relevance-ordered, but one provider's genuine exact/model
 * volume fills the entire first page (eBay: 50/50 for "samsung galaxy s24",
 * "macbook air m3") while every other provider's genuine matching inventory
 * (same-family devices, imported rows, relevant accessories) sits at pool
 * positions 50+. The page reads as "eBay-only" even though the pool holds real
 * AliExpress / Admitad / CJ inventory.
 *
 * `composeSearchPageOne` is the final page-1 Composition seam: it recomposes
 * ONLY the head of that pool (a pure permutation of the SAME item set) so
 * every provider that actually holds matching results gets a truthful, bounded
 * presence with MEANINGFUL EARLY exposure —
 *
 *   - global relevance stays the primary signal: the preserved leading slots
 *     are untouched, and each provider's candidates keep their relevance order,
 *   - a provider missing from page 1 has its best genuine DEVICES placed
 *     directly behind the preserved global lead (early exposure, never 46-49),
 *   - a provider holding only relevant accessories gets them at the first
 *     accessory slots (devices never yield to an accessory),
 *   - no provider is fabricated or padded, nothing irrelevant is promoted,
 *   - the dominant provider still owns most of the page (no forced-equal
 *     round-robin),
 *   - pagination semantics are untouched (same total, same items, zero dups).
 *
 * Composition is applied ONLY on the /search device-intent path (the engine
 * passes `optimizeForDeviceIntent`); homepage / Compare Prices never call it.
 */
import { describe, expect, it } from "vitest";

import {
  composeSearchPageOne,
  PAGE_ONE_PROVIDER_PRESENCE,
} from "@/lib/search/page-one";
import type { SearchResultItem } from "@/lib/data/homepage";

const QUERY = "samsung galaxy s24 ultra";

function item(id: string, storeSlug: string, name: string): SearchResultItem {
  return {
    id,
    name,
    imageSrc: `https://img.example/${id}.jpg`,
    emoji: "📦",
    price: 100,
    originalPrice: 120,
    discount: 0,
    store: storeSlug,
    storeSlug,
    rating: 0,
    reviewCount: 0,
    inStock: true,
    category: "Electronics",
    affiliateUrl: `https://go.example/${id}`,
  };
}

function ebayDevice(n: number): SearchResultItem {
  return item(
    `ebay-dev-${n}`,
    "ebay",
    `Samsung Galaxy S24 Ultra ${256 + n}GB Unlocked Smartphone`,
  );
}

function aliDevice(n: number): SearchResultItem {
  return item(
    `ali-dev-${n}`,
    "aliexpress",
    `Samsung Galaxy S24 Ultra ${256 + n}GB Unlocked Smartphone Original`,
  );
}

function admitadAccessory(n: number): SearchResultItem {
  return item(
    `adm-acc-${n}`,
    "admitad",
    `Silicone Case for Samsung Galaxy S24 Ultra ${n}`,
  );
}

function cjAccessory(n: number): SearchResultItem {
  return item(
    `cj-acc-${n}`,
    "cjdropshipping",
    `Tempered Glass Screen Protector for Samsung Galaxy S24 Ultra ${n}`,
  );
}

function sameIdSets(a: readonly SearchResultItem[], b: readonly SearchResultItem[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((i) => i.id));
  return b.every((i) => ids.has(i.id));
}

describe("PAGE_ONE_PROVIDER_PRESENCE", () => {
  it("is a small, bounded presence — never an equal-share quota", () => {
    expect(PAGE_ONE_PROVIDER_PRESENCE).toBe(2);
  });
});

describe("composeSearchPageOne — no-ops (seeded pools & untouched surfaces)", () => {
  it("returns the pool unchanged when it already fits one page", () => {
    const pool = [
      ebayDevice(1),
      aliDevice(1),
      admitadAccessory(1),
      admitadAccessory(2),
      cjAccessory(1),
    ];
    const composed = composeSearchPageOne(pool, QUERY, 50);
    expect(composed.map((i) => i.id)).toEqual(pool.map((i) => i.id));
  });

  it("returns the pool unchanged for a single-provider pool", () => {
    const pool = Array.from({ length: 60 }, (_, i) => ebayDevice(i));
    const composed = composeSearchPageOne(pool, QUERY, 50);
    expect(composed.map((i) => i.id)).toEqual(pool.map((i) => i.id));
  });

  it("returns the pool unchanged when every provider already sits on page 1", () => {
    const pool = [
      ...Array.from({ length: 30 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 10 }, (_, i) => aliDevice(i)),
      ...Array.from({ length: 10 }, (_, i) => admitadAccessory(i)),
      ...Array.from({ length: 10 }, (_, i) => ebayDevice(100 + i)),
    ];
    const composed = composeSearchPageOne(pool, QUERY, 50);
    expect(composed.map((i) => i.id)).toEqual(pool.map((i) => i.id));
  });

  it("never mutates the input", () => {
    const pool = [...Array.from({ length: 50 }, (_, i) => ebayDevice(i)), aliDevice(1)];
    const snapshot = pool.map((i) => i.id);
    composeSearchPageOne(pool, QUERY, 50);
    expect(pool.map((i) => i.id)).toEqual(snapshot);
  });
});

describe("composeSearchPageOne — early, meaningful multi-provider exposure", () => {
  it("places a missing provider's genuine devices in the EARLY page-1 region", () => {
    const pool = [
      ...Array.from({ length: 50 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 5 }, (_, i) => aliDevice(i + 1)),
      ...Array.from({ length: 5 }, (_, i) => admitadAccessory(i + 1)),
    ];

    const composed = composeSearchPageOne(pool, QUERY, 50);

    // Strict permutation: same items, same counts, nothing dropped.
    expect(composed).toHaveLength(60);
    expect(sameIdSets(composed, pool)).toBe(true);
    expect(composed.filter((i) => i.storeSlug === "ebay")).toHaveLength(50);
    expect(composed.filter((i) => i.storeSlug === "aliexpress")).toHaveLength(5);
    expect(composed.filter((i) => i.storeSlug === "admitad")).toHaveLength(5);

    // The first page now truthfully shows every provider that holds stock, with
    // the missing provider's genuine devices EARLY — not at positions 46-49.
    const head = composed.slice(0, 50);
    const headStores = new Set(head.map((i) => i.storeSlug));
    expect(headStores).toEqual(new Set(["ebay", "aliexpress", "admitad"]));

    // Global relevance lead preserved untouched (the assembled top-2).
    expect(head[0]!.id).toBe("ebay-dev-0");
    expect(head[1]!.id).toBe("ebay-dev-1");

    // The promoted provider-best devices sit directly behind the lead.
    expect(head[2]!.id).toBe("ali-dev-1");
    expect(head[3]!.id).toBe("ali-dev-2");

    // Devices lead; accessories only at the tail, never ahead of a device.
    expect(head[48]!.storeSlug).toBe("admitad");
    expect(head[49]!.storeSlug).toBe("admitad");

    // The dominant provider still owns most of the page — nothing equalized.
    const ebayHead = head.filter((i) => i.storeSlug === "ebay").length;
    expect(ebayHead).toBeGreaterThanOrEqual(40);

    // Evicted head devices roll to page 2 (same items, reachable — not dropped).
    const composedIds = composed.map((i) => i.id);
    expect(composedIds.slice(50, 54)).toEqual([
      "ebay-dev-46",
      "ebay-dev-47",
      "ebay-dev-48",
      "ebay-dev-49",
    ]);
    // Un-promoted rest items keep their original relative order.
    expect(composedIds.slice(54)).toEqual([
      "ali-dev-3",
      "ali-dev-4",
      "ali-dev-5",
      "adm-acc-3",
      "adm-acc-4",
      "adm-acc-5",
    ]);
  });

  it("promotes a provider's genuine devices ahead of its own accessories", () => {
    // AliExpress's remaining pool has an accessory FIRST, then devices. The
    // device-first rule must bring the devices early, not the accessory.
    const pool = [
      ...Array.from({ length: 50 }, (_, i) => ebayDevice(i)),
      admitadAccessory(1),
      admitadAccessory(2),
      aliDevice(1),
      aliDevice(2),
      aliDevice(3),
    ];

    const composed = composeSearchPageOne(pool, QUERY, 50);
    const head = composed.slice(0, 50);

    expect(head[2]!.id).toBe("ali-dev-1");
    expect(head[3]!.id).toBe("ali-dev-2");
    expect(sameIdSets(composed, pool)).toBe(true);
  });

  it("gives an accessory-only provider its best accessories at the first accessory slots", () => {
    const pool = [
      ...Array.from({ length: 50 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 6 }, (_, i) => cjAccessory(i + 1)),
    ];

    const composed = composeSearchPageOne(pool, QUERY, 50);
    const head = composed.slice(0, 50);

    expect(sameIdSets(composed, pool)).toBe(true);
    const headStores = new Set(head.map((i) => i.storeSlug));
    expect(headStores.has("cjdropshipping")).toBe(true);

    // Devices still lead; the accessory presence sits only at the tail.
    const firstCj = head.findIndex((i) => i.storeSlug === "cjdropshipping");
    expect(firstCj).toBeGreaterThanOrEqual(48);
    expect(head.slice(0, firstCj).every((i) => i.storeSlug === "ebay")).toBe(true);

    // CJ contributes a bound presence, not a share of the page.
    expect(head.filter((i) => i.storeSlug === "cjdropshipping").length).toBeLessThanOrEqual(2);
  });

  it("keeps the deepest untouched remainder in original order (permutation stability)", () => {
    const pool = [
      ...Array.from({ length: 50 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 3 }, (_, i) => aliDevice(i + 1)),
      ...Array.from({ length: 3 }, (_, i) => admitadAccessory(i + 1)),
      ...Array.from({ length: 30 }, (_, i) => ebayDevice(200 + i)),
    ];

    const composed = composeSearchPageOne(pool, QUERY, 50);
    expect(composed).toHaveLength(86);
    expect(sameIdSets(composed, pool)).toBe(true);

    // Early genuine exposure for the missing providers.
    const head = composed.slice(0, 50);
    expect(head[0]!.id).toBe("ebay-dev-0");
    expect(head[1]!.id).toBe("ebay-dev-1");
    expect(head[2]!.id).toBe("ali-dev-1");
    expect(head[3]!.id).toBe("ali-dev-2");

    // The untouched remainder (the 30 extra eBay rows beyond the promoted
    // ali/admitad candidates) keeps its original relative order at the tail.
    const tail = composed.slice(-30);
    expect(tail.map((i) => i.id)).toEqual(
      Array.from({ length: 30 }, (_, i) => `ebay-dev-${200 + i}`),
    );
  });
});