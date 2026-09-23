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
 *   - on a device/product query only TRUE product candidates count as provider
 *     representation — an accessory (case, screen protector) never stands in
 *     for a provider whose matching inventory is accessories-only; on an
 *     accessory-intent query a relevant accessory IS the target product and is
 *     placed at the first accessory slots (devices never yield to an accessory),
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

function ebayMacBook(n: number): SearchResultItem {
  return item(
    `mac-ebay-dev-${n}`,
    "ebay",
    `Apple MacBook Air M3 (2024) 13-inch ${512 + n}GB Laptop`,
  );
}

function aliMacBookCase(n: number): SearchResultItem {
  return item(
    `mac-ali-acc-${n}`,
    "aliexpress",
    `Silicone Case for MacBook Air M3 13 inch ${n}`,
  );
}

function aliMacBookDevice(n: number): SearchResultItem {
  return item(
    `mac-ali-dev-${n}`,
    "aliexpress",
    `Apple MacBook Air M3 (2024) 13-inch ${512 + n}GB Laptop`,
  );
}

function sameIdSets(a: readonly SearchResultItem[], b: readonly SearchResultItem[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((i) => i.id));
  return b.every((i) => ids.has(i.id));
}

const IPHONE_QUERY = "iphone 15 pro max";

function ebayIphone(n: number): SearchResultItem {
  return item(
    `ebay-iphone-${n}`,
    "ebay",
    `Apple iPhone 15 Pro Max ${256 + n}GB Unlocked Smartphone`,
  );
}

function aliIphone(n: number): SearchResultItem {
  return item(
    `ali-iphone-${n}`,
    "aliexpress",
    `Apple iPhone 15 Pro Max ${256 + n}GB 5G Network Unlocked Smartphone 6.7" Original`,
  );
}

// Shapes of the two real production rows that hijacked page-1 slots 2-3 for
// "iphone 15 pro max" before the fix (a VR-glasses accessory and a screen
// repair part). Neither is a genuine iPhone 15 Pro Max.
function admitadVrGlasses(n: number): SearchResultItem {
  return item(
    `adm-vr-${n}`,
    "admitad",
    "BOBOVR Z5VR Glasses for iPhone Android BlueTooth VR Virtual Reality 3D Video Player",
  );
}

function admitadScreenRepair(n: number): SearchResultItem {
  return item(
    `adm-screen-${n}`,
    "admitad",
    "For iPhone X OLED Soft display LCD touch glass full assembly replacement",
  );
}

function admitadBulkPhone(n: number): SearchResultItem {
  return item(
    `adm-bulk-${n}`,
    "admitad",
    `Stock Thin Slim Black ${32 + n}GB A Grade Unlocked Mobile Phone`,
  );
}

function ebayOlderGalaxy(n: number): SearchResultItem {
  return item(
    `ebay-old-${n}`,
    "ebay",
    `Samsung Galaxy S23 Ultra ${256 + n}GB Unlocked Smartphone`,
  );
}

function cjFamilyGalaxy(n: number): SearchResultItem {
  return item(
    `cj-family-${n}`,
    "cjdropshipping",
    `Samsung Galaxy A55 128GB Unlocked Smartphone`,
  );
}

function aliFamilyDevice(n: number): SearchResultItem {
  return item(
    `ali-family-${n}`,
    "aliexpress",
    `Samsung Galaxy S24 FE 128GB Unlocked Smartphone Original`,
  );
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

  it("reorders toward tiered coverage even when every product provider already sits on page 1 — accessories drop behind devices", () => {
    // Every provider is present on page 1, but the pool still needs the
    // coverage reorder: AliExpress's best devices get EARLY exposure behind the
    // preserved lead, and the accessory-only provider no longer claims
    // device-tier page-1 slots (its rows move behind every real device).
    const pool = [
      ...Array.from({ length: 30 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 10 }, (_, i) => aliDevice(i)),
      ...Array.from({ length: 10 }, (_, i) => admitadAccessory(i)),
      ...Array.from({ length: 10 }, (_, i) => ebayDevice(100 + i)),
    ];
    const composed = composeSearchPageOne(pool, QUERY, 50);
    const head = composed.slice(0, 50);

    // Strict permutation: same items, nothing dropped, pagination untouched.
    expect(composed).toHaveLength(60);
    expect(sameIdSets(composed, pool)).toBe(true);

    // Every provider with genuine PRODUCT inventory stays on page 1.
    expect(new Set(head.map((i) => i.storeSlug))).toEqual(new Set(["ebay", "aliexpress"]));

    // Head[0..1] is the preserved global relevance lead, then each provider's
    // best genuine devices are hoisted behind it (early, not 30-31).
    expect(head[0]!.id).toBe("ebay-dev-0");
    expect(head[1]!.id).toBe("ebay-dev-1");
    expect(head[2]!.id).toBe("ali-dev-0");
    expect(head[3]!.id).toBe("ali-dev-1");

    // Admitad (accessories-only on a device query) is NOT on page 1 anymore.
    expect(composed.slice(50).map((i) => i.storeSlug)).toEqual(
      Array.from({ length: 10 }, () => "admitad"),
    );

    // The dominant provider still owns most of the page.
    expect(head.filter((i) => i.storeSlug === "ebay").length).toBeGreaterThanOrEqual(38);
  });

  it("never mutates the input", () => {
    const pool = [...Array.from({ length: 50 }, (_, i) => ebayDevice(i)), aliDevice(1)];
    const snapshot = pool.map((i) => i.id);
    composeSearchPageOne(pool, QUERY, 50);
    expect(pool.map((i) => i.id)).toEqual(snapshot);
  });
});

describe("composeSearchPageOne — early, meaningful multi-provider exposure", () => {
  it("places a missing provider's genuine DEVICES in the early page-1 region (accessories never represent on a device query)", () => {
    const pool = [
      ...Array.from({ length: 50 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 5 }, (_, i) => aliDevice(i + 1)),
      // Admitad's only matching inventory is accessories — for a device query
      // that must NOT count as provider representation.
      ...Array.from({ length: 5 }, (_, i) => admitadAccessory(i + 1)),
    ];

    const composed = composeSearchPageOne(pool, QUERY, 50);

    // Strict permutation: same items, same counts, nothing dropped.
    expect(composed).toHaveLength(60);
    expect(sameIdSets(composed, pool)).toBe(true);
    expect(composed.filter((i) => i.storeSlug === "ebay")).toHaveLength(50);
    expect(composed.filter((i) => i.storeSlug === "aliexpress")).toHaveLength(5);
    expect(composed.filter((i) => i.storeSlug === "admitad")).toHaveLength(5);

    // The first page truthfully shows every provider that holds genuine
    // PRODUCT stock, with the missing provider's devices EARLY — not at
    // positions 46-49. Admitad (accessories-only here) is NOT on page 1.
    const head = composed.slice(0, 50);
    const headStores = new Set(head.map((i) => i.storeSlug));
    expect(headStores).toEqual(new Set(["ebay", "aliexpress"]));

    // Global relevance lead preserved untouched (the assembled top-2).
    expect(head[0]!.id).toBe("ebay-dev-0");
    expect(head[1]!.id).toBe("ebay-dev-1");

    // The promoted provider-best devices sit directly behind the lead.
    expect(head[2]!.id).toBe("ali-dev-1");
    expect(head[3]!.id).toBe("ali-dev-2");

    // No accessory was promoted ahead of any device — the page stays
    // device-only where a provider had no products to offer.
    expect(head[48]!.storeSlug).toBe("ebay");
    expect(head[49]!.storeSlug).toBe("ebay");

    // The dominant provider still owns most of the page — nothing equalized.
    const ebayHead = head.filter((i) => i.storeSlug === "ebay").length;
    expect(ebayHead).toBeGreaterThanOrEqual(40);

    // Evicted head devices roll to page 2 (same items, reachable — not dropped).
    const composedIds = composed.map((i) => i.id);
    expect(composedIds.slice(50, 54)).toEqual([
      "ebay-dev-48",
      "ebay-dev-49",
      "ali-dev-3",
      "ali-dev-4",
    ]);
    // Accessories and un-promoted devices keep their original relative order.
    expect(composedIds.slice(54)).toEqual([
      "ali-dev-5",
      "adm-acc-1",
      "adm-acc-2",
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

  it("does NOT promote an accessory-only provider for a device query (no-op)", () => {
    // CJdropshipping only owns relevant accessories for this device query.
    // Accessories must NOT count as provider representation — the pool is
    // returned unchanged and CJ stays off page 1.
    const pool = [
      ...Array.from({ length: 50 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 6 }, (_, i) => cjAccessory(i + 1)),
    ];

    const composed = composeSearchPageOne(pool, QUERY, 50);
    const head = composed.slice(0, 50);

    expect(composed.map((i) => i.id)).toEqual(pool.map((i) => i.id));
    expect(new Set(head.map((i) => i.storeSlug))).toEqual(new Set(["ebay"]));
  });

  it("promotes a genuine MacBook product for a MacBook query, never a case in its place", () => {
    // The live defect being locked: for "macbook air m3", AliExpress was
    // represented by a silicone case around position 48. An accessory must not
    // stand in for a provider on a device query.
    const pool = [
      ...Array.from({ length: 50 }, (_, i) => ebayMacBook(i)),
      aliMacBookCase(1),
      aliMacBookCase(2),
      aliMacBookDevice(1),
      aliMacBookDevice(2),
    ];

    const composed = composeSearchPageOne(pool, "macbook air m3", 50);
    const head = composed.slice(0, 50);

    expect(sameIdSets(composed, pool)).toBe(true);
    expect(composed).toHaveLength(54);

    // The preserved global lead + the genuine MacBook product EARLY…
    expect(head[0]!.id).toBe("mac-ebay-dev-0");
    expect(head[1]!.id).toBe("mac-ebay-dev-1");
    expect(head[2]!.id).toBe("mac-ali-dev-1");
    expect(head[3]!.id).toBe("mac-ali-dev-2");

    // …and NO silicone case anywhere on page 1.
    expect(head.some((i) => i.storeSlug === "aliexpress" && i.id.startsWith("mac-ali-acc"))).toBe(
      false,
    );
    expect(head[48]!.storeSlug).toBe("ebay");
    expect(head[49]!.storeSlug).toBe("ebay");
  });

  it("gives an accessory-intent query its accessory representation at the first accessory slots", () => {
    // For "… case" queries the accessory IS the genuine target product and
    // qualifies as provider representation (still never ahead of a device).
    const pool = [
      ...Array.from({ length: 50 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 6 }, (_, i) => cjAccessory(i + 1)),
    ];

    const composed = composeSearchPageOne(pool, "samsung galaxy s24 case", 50);
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

describe("composeSearchPageOne — production defect regression lock", () => {
  it("never lets a repair part, accessory or unrelated bulk listing stand in for a provider on a device query (iPhone 15 Pro Max)", () => {
    // The live defect being locked: for "iphone 15 pro max", Admitad's two
    // junk rows (VR glasses + screen-repair part) claimed page-1 slots 2-3.
    const pool = [
      ...Array.from({ length: 47 }, (_, i) => ebayIphone(i)),
      ...Array.from({ length: 2 }, (_, i) => aliIphone(i + 1)),
      admitadVrGlasses(1),
      admitadScreenRepair(1),
      admitadBulkPhone(1),
      ...Array.from({ length: 10 }, (_, i) => ebayIphone(100 + i)),
    ];

    const composed = composeSearchPageOne(pool, IPHONE_QUERY, 50);
    const head = composed.slice(0, 50);

    // Strict permutation.
    expect(composed).toHaveLength(62);
    expect(sameIdSets(composed, pool)).toBe(true);

    // No junk anywhere on page 1 — page 1 is genuine devices only.
    expect(head.some((i) => i.storeSlug === "admitad")).toBe(false);
    expect(new Set(head.map((i) => i.storeSlug))).toEqual(new Set(["ebay", "aliexpress"]));

    // The preserved global lead, then the missing provider's GENUINE devices
    // directly behind it — that is what occupies the old junk slots 2-3.
    expect(head[0]!.id).toBe("ebay-iphone-0");
    expect(head[1]!.id).toBe("ebay-iphone-1");
    expect(head[2]!.id).toBe("ali-iphone-1");
    expect(head[3]!.id).toBe("ali-iphone-2");

    // The junk rows still exist in the pool (behind every genuine device).
    const junkIds = ["adm-vr-1", "adm-screen-1", "adm-bulk-1"];
    const idxs = junkIds.map((id) => composed.findIndex((i) => i.id === id));
    expect(Math.max(...idxs)).toBeGreaterThanOrEqual(50);
  });

  it("gives a family-only provider's best genuine device EARLY page-1 exposure (bounded), without displacing the exact lead", () => {
    // The live defect being locked: eBay holds the exact S24 Ultra inventory
    // while CJdropshipping holds only a genuine same-family (Galaxy A55)
    // device. The family seat was being stranded after ALL exact candidates,
    // so a volume leader's exact count could monopolize page 1. The family
    // provider now reaches the early region directly behind the exact
    // coverage — bounded by the early-device cap, never an equal share.
    const pool = [
      ...Array.from({ length: 40 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 15 }, (_, i) => ebayOlderGalaxy(i)),
      ...Array.from({ length: 3 }, (_, i) => cjFamilyGalaxy(i + 1)),
    ];

    const composed = composeSearchPageOne(pool, QUERY, 50);
    const head = composed.slice(0, 50);

    expect(sameIdSets(composed, pool)).toBe(true);
    expect(composed).toHaveLength(58);

    // The preserved global relevance lead stays untouched.
    expect(head[0]!.id).toBe("ebay-dev-0");
    expect(head[1]!.id).toBe("ebay-dev-1");

    // CJ's genuine same-family device gets early exposure right behind the
    // exact coverage — page 1 is no longer a single-provider page.
    expect(head[2]!.storeSlug).toBe("cjdropshipping");
    expect(head[3]!.storeSlug).toBe("cjdropshipping");

    // Bounded presence: CJ contributes its 2 coverage seats, nothing more
    // (its third family row stays behind every exact candidate).
    expect(head.filter((i) => i.storeSlug === "cjdropshipping").length).toBe(2);

    // Exact/model candidates still dominate the page — no equalization.
    const ebayExactHead = head.filter(
      (i) => i.storeSlug === "ebay" && i.id.startsWith("ebay-dev"),
    ).length;
    expect(ebayExactHead).toBeGreaterThanOrEqual(38);

    // Same-provider lower-relevance family rows compact behind the exacts.
    expect(head[42]!.id.startsWith("ebay-old")).toBe(true);
  });

  it("prevents an exact-volume leader from monopolizing page 1 when a peer holds genuine same-family devices (Samsung/MacBook shape)", () => {
    // Live shape for "samsung galaxy s24" / "macbook air m3": eBay contributes
    // 50 exact devices; AliExpress's only genuine matching devices are
    // same-family models plus accessories. The family devices must be on page 1
    // (truthfully, early), the accessories must not — and eBay keeps its
    // relevance lead and the majority of the page.
    const pool = [
      ...Array.from({ length: 50 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 3 }, (_, i) => aliFamilyDevice(i + 1)),
      ...Array.from({ length: 6 }, (_, i) => admitadAccessory(i + 1)),
    ];

    const composed = composeSearchPageOne(pool, QUERY, 50);
    const head = composed.slice(0, 50);

    expect(sameIdSets(composed, pool)).toBe(true);
    expect(composed).toHaveLength(59);

    // Not an all-eBay page anymore.
    expect(new Set(head.map((i) => i.storeSlug)).has("aliexpress")).toBe(true);

    // Preserved exact lead, then the genuine family device early.
    expect(head[0]!.id).toBe("ebay-dev-0");
    expect(head[1]!.id).toBe("ebay-dev-1");
    expect(head[2]!.id).toBe("ali-family-1");
    expect(head[3]!.id).toBe("ali-family-2");

    // The accessories are never promoted ahead of a device.
    expect(head.some((i) => i.storeSlug === "admitad")).toBe(false);
    expect(head[48]!.storeSlug).toBe("ebay");
    expect(head[49]!.storeSlug).toBe("ebay");

    // The exact-volume leader still owns most of the page.
    const ebayHead = head.filter((i) => i.storeSlug === "ebay").length;
    expect(ebayHead).toBeGreaterThanOrEqual(45);
  });

  it("gives an accessory-intent query its accessory representation at the FIRST accessory slots, never ahead of a device", () => {
    // "… case" query: the accessory IS the genuine target product and gets
    // coverage seats at the accessory tail, directly after all matching devices.
    const pool = [
      ...Array.from({ length: 60 }, (_, i) => ebayDevice(i)),
      ...Array.from({ length: 6 }, (_, i) => cjAccessory(i + 1)),
    ];

    const composed = composeSearchPageOne(pool, "samsung galaxy s24 ultra case", 50);
    const head = composed.slice(0, 50);

    expect(sameIdSets(composed, pool)).toBe(true);
    expect(head.slice(0, 48).every((i) => i.storeSlug === "ebay")).toBe(true);
    expect(head[48]!.storeSlug).toBe("cjdropshipping");
    expect(head[49]!.storeSlug).toBe("cjdropshipping");
    expect(head.filter((i) => i.storeSlug === "cjdropshipping").length).toBe(2);
  });
});