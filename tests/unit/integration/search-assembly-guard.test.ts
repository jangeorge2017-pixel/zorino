/**
 * Regression tests — production search assembly page-1 guard.
 *
 * Production bug (verified against live search renders): when a flaky provider
 * window (eBay returning 0) leaves zero strong (exact/model) device matches,
 * the old secondary fill interleaved wrong-gen phones AND accessories (cases,
 * screen protectors) together, so a case could own slot #2 while genuine
 * wrong-gen devices waited. The page-1 fill must honor device-before-
 * accessory ordering for device queries:
 *
 *   - Phase 1: strong device matches (exact/model).
 *   - Phase 2: remaining real devices (wrong-generation phones, siblings).
 *   - Phase 3: accessories fill only the remaining slots.
 *
 * Accessory-intent queries keep their existing behavior (no device gate).
 */
import { describe, expect, it } from "vitest";

import { assembleProductionSearchResults } from "@/lib/search/production-pipeline";
import {
  diversifyTopViewport,
  exactModelPerProviderCeiling,
  PRICE_SORT_DIVERSITY_WINDOW,
  PRICE_SORT_MAX_CONSECUTIVE_SAME_PROVIDER,
  SEARCH_POOL_SINGLE_PROVIDER_EXACT_SHARE,
} from "@/lib/search/production-pipeline";
import type { RawProviderListing } from "@/lib/search/types";

function rawListing(overrides: Partial<RawProviderListing>): RawProviderListing {
  return {
    providerId: "aliexpress",
    externalId: "x",
    title: "listing",
    imageUrl: "https://x.example.com/img.jpg",
    price: 100,
    originalPrice: 120,
    discount: 0,
    currency: "USD",
    storeName: "Test Store",
    category: "Electronics",
    rating: 0,
    reviewCount: 0,
    salesCount: 0,
    inStock: true,
    productUrl: "https://x.example.com/p",
    affiliateUrl: "https://x.example.com/p?aff=1",
    ...overrides,
  };
}

describe("production search assembly — device-before-accessory page guard", () => {
  it("leads with real devices and fills with accessories only after devices are exhausted", async () => {
    const wrongGen1 = rawListing({
      externalId: "d1",
      title: "Apple iPhone 11 64GB Unlocked Smartphone",
    });
    const wrongGen2 = rawListing({
      externalId: "d2",
      title: "Apple iPhone 7 32GB Unlocked Phone",
    });
    const phoneCase = rawListing({
      externalId: "a1",
      title: "Clear Soft Silicone Case Compatible With iPhone 15 Pro Max",
    });
    const screenProtector = rawListing({
      externalId: "a2",
      title: "Tempered Glass Screen Protector For iPhone 15 Pro Max",
    });

    const results = assembleProductionSearchResults(
      [wrongGen1, wrongGen2, phoneCase, screenProtector],
      "iphone 15 pro max",
      10,
    );

    expect(results).toHaveLength(4);

    const titles = results.map((r) => r.name);
    const deviceTitles = titles.filter((t) => t.includes("iPhone 11") || t.includes("iPhone 7"));
    const accessoryTitles = titles.filter(
      (t) => t.includes("Case") || t.includes("Screen Protector"),
    );

    expect(deviceTitles).toHaveLength(2);
    expect(accessoryTitles).toHaveLength(2);

    // Every device precedes every accessory — a case must never rank ahead of
    // a real (even wrong-generation) device in a device query.
    const lastDevice = Math.max(
      titles.indexOf(deviceTitles[0]!),
      titles.indexOf(deviceTitles[1]!),
    );
    const firstAccessory = Math.min(
      titles.indexOf(accessoryTitles[0]!),
      titles.indexOf(accessoryTitles[1]!),
    );
    expect(lastDevice).toBeLessThan(firstAccessory);
  });

  it("keeps a genuine strong device match leading over accessories", async () => {
    const genuine = rawListing({
      externalId: "g1",
      title: "Apple iPhone 15 Pro Max 512GB Unlocked",
    });
    const wrongGen = rawListing({
      externalId: "d1",
      title: "Apple iPhone 11 64GB Unlocked Smartphone",
    });
    const phoneCase = rawListing({
      externalId: "a1",
      title: "Clear Soft Silicone Case Compatible With iPhone 15 Pro Max",
    });

    const results = assembleProductionSearchResults(
      [genuine, wrongGen, phoneCase],
      "iphone 15 pro max",
      10,
    );

    expect(results[0]?.name).toContain("15 Pro Max 512GB");
    const lastDevice = results.findIndex(
      (r) => r.name.includes("15 Pro Max 512GB") || r.name.includes("iPhone 11"),
    );
    const caseIndex = results.findIndex((r) => r.name.includes("Case"));
    expect(lastDevice).toBeGreaterThanOrEqual(0);
    expect(caseIndex).toBeGreaterThan(lastDevice);
  });
});

describe("production pool — no single marketplace can crowd out genuine inventory", () => {
  const QUERY = "iphone 15";

  function exactEbay(n: number): RawProviderListing[] {
    return Array.from({ length: n }, (_, i) =>
      rawListing({
        providerId: "ebay",
        externalId: `ebay-e-${i}`,
        title: `Apple iPhone 15 ${128 + i}GB Unlocked GSM Smartphone Variant ${i}`,
      }),
    );
  }

  function exactAli(n: number): RawProviderListing[] {
    return Array.from({ length: n }, (_, i) =>
      rawListing({
        providerId: "aliexpress",
        externalId: `ali-e-${i}`,
        title: `Apple iPhone 15 128GB ${i}% Original Factory Unlocked`,
      }),
    );
  }

  function siblingAli(n: number): RawProviderListing[] {
    return Array.from({ length: n }, (_, i) =>
      rawListing({
        providerId: "aliexpress",
        externalId: `ali-s-${i}`,
        title: `Apple iPhone 14 A-Grade Refurbished 128GB Device ${i}`,
      }),
    );
  }

  function importedRows(n: number): RawProviderListing[] {
    return Array.from({ length: n }, (_, i) =>
      rawListing({
        providerId: "admitad",
        externalId: `adm-${i}`,
        title: `Apple iPhone 14 64GB Grade B Reconditioned Device ${i}`,
      }),
    );
  }

  it("bounds the exact-model ceiling to at most 60% and never below a page", () => {
    expect(SEARCH_POOL_SINGLE_PROVIDER_EXACT_SHARE).toBe(0.6);
    expect(exactModelPerProviderCeiling(200)).toBe(120);
    expect(exactModelPerProviderCeiling(50)).toBe(50);
    expect(exactModelPerProviderCeiling(10)).toBe(50);
  });

it("caps each source to its strict equal share so a volume leader can no longer crowd the pool", () => {
    // eBay genuinely holds 200 exact iPhone 15 devices; AliExpress holds 10
    // exact + 30 same-family siblings; the imported catalog holds 20 more.
    // New hard per-source cap (Requirement 1): with 3 active sources and a
    // 200-slot pool each source contributes at most ceil(200/3) = 67, so eBay
    // can no longer fill 140/200 slots and crowd out the peers' genuine
    // inventory in the leading window.
    const results = assembleProductionSearchResults(
      [
        ...exactEbay(200),
        ...exactAli(10),
        ...siblingAli(30),
        ...importedRows(20),
      ],
      QUERY,
      200,
    );

    expect(results).toHaveLength(127);

    const stores = new Set(results.map((r) => r.storeSlug));
    expect(stores).toEqual(new Set(["ebay", "aliexpress", "admitad"]));

    // Genuine same-family + imported inventory is reachable in the pool.
    expect(results.some((r) => /iPhone 14/.test(r.name))).toBe(true);
    expect(results.some((r) => r.storeSlug === "admitad")).toBe(true);

    // Strict equal share: eBay capped at 67, AliExpress keeps all 40, the
    // imported catalog all 20 — no single source's volume dominates.
    expect(results.filter((r) => r.storeSlug === "ebay")).toHaveLength(67);
    expect(results.filter((r) => r.storeSlug === "aliexpress")).toHaveLength(40);
    expect(results.filter((r) => r.storeSlug === "admitad")).toHaveLength(20);

    // Relevance is preserved: the whole leading block (every provider's exact
    // matches) precedes the first sibling/imported device.
    const firstSibling = results.findIndex((r) => /iPhone 14/.test(r.name));
    expect(firstSibling).toBeGreaterThanOrEqual(77);
    for (let i = 0; i < firstSibling; i++) {
      expect(results[i]!.name).toContain("iPhone 15");
    }
  });

  it("interleaves sources 1-1-1 (strict alternation) while peers still have stock", () => {
    const results = assembleProductionSearchResults(
      [...exactEbay(4), ...exactAli(4)],
      QUERY,
      8,
    );

    const sequence = results.map((r) => r.storeSlug);
    expect(sequence).toHaveLength(8);
    // Strict round-robin: no source may appear twice consecutively while the
    // peer still has stock → mandatory alternation ebay/aliexpress.
    for (let i = 0; i < sequence.length - 1; i++) {
      expect(sequence[i]).not.toBe(sequence[i + 1]);
    }
  });

  it("does not fabricate or trim a genuinely lone provider — real stock fills the pool", () => {
    const results = assembleProductionSearchResults(
      exactEbay(200),
      QUERY,
      200,
    );

    // n = 1 active source → equal share = the whole pool, so a lone provider
    // is never trimmed and fills every slot with its real inventory.
    expect(results).toHaveLength(200);
    expect(results.every((r) => r.storeSlug === "ebay")).toBe(true);
    expect(results.every((r) => /iPhone 15/.test(r.name))).toBe(true);
  });
});

describe("production search assembly — universal price sort (Requirement 3)", () => {
  const QUERY = "iphone 15 pro";

  function priced(
    providerId: RawProviderListing["providerId"],
    n: number,
    price: number,
    titleOverride?: string,
  ): RawProviderListing {
    return rawListing({
      providerId,
      externalId: `${providerId}-${n}`,
      title: titleOverride ?? `Apple iPhone 15 Pro ${n}GB Unlocked GSM ${providerId}`,
      price,
      originalPrice: Math.round(price * 1.2),
      discount: 0,
    });
  }

  it("merges every source and sorts strictly by ascending price, regardless of marketplace", () => {
    const results = assembleProductionSearchResults(
      [
        priced("ebay", 1, 1200),
        priced("ebay", 2, 1100),
        priced("aliexpress", 1, 1050),
        priced("admitad", 1, 1000),
        priced("aliexpress", 2, 1350),
      ],
      QUERY,
      10,
      { sortBy: "price" },
    );

    expect(results.map((r) => r.price)).toEqual([1000, 1050, 1100, 1200, 1350]);
    // Cheapest offer leads — even though it belongs to a "smaller" source, and
    // eBay's two devices are NOT kept together in a block.
    expect(results[0]!.storeSlug).toBe("admitad");
    expect(results.map((r) => r.storeSlug)).toEqual([
      "admitad",
      "aliexpress",
      "ebay",
      "ebay",
      "aliexpress",
    ]);
  });

  it("caps the price-sorted list to the limit", () => {
    const results = assembleProductionSearchResults(
      [
        priced("ebay", 1, 1200),
        priced("ebay", 2, 1100),
        priced("aliexpress", 1, 1050),
        priced("admitad", 1, 1000),
      ],
      QUERY,
      2,
      { sortBy: "price" },
    );
    expect(results.map((r) => r.price)).toEqual([1000, 1050]);
  });
});

describe("production search assembly — iPhone 15 Pro must stay multi-provider", () => {
  const QUERY = "iphone 15 pro";

  function phone(
    providerId: RawProviderListing["providerId"],
    externalId: string,
    title: string,
    price: number,
  ): RawProviderListing {
    return rawListing({
      providerId,
      externalId,
      title,
      price,
      originalPrice: Math.round(price * 1.25),
    });
  }

  it("keeps AliExpress + Admitad genuine device inventory in the pool when only eBay has the exact model", () => {
    // eBay genuinely dominates the exact "iPhone 15 Pro" device volume, while
    // AliExpress holds same-family devices and Admitad holds imported/refurb
    // devices that resolve to the requested family.
    const ebay = Array.from({ length: 60 }, (_, i) =>
      phone(
        "ebay",
        `eb-${i}`,
        `Apple iPhone 15 Pro ${128 + i}GB Unlocked GSM - ${i}`,
        800 + i * 5,
      ),
    );
    const aliExpress = Array.from({ length: 8 }, (_, i) =>
      phone(
        "aliexpress",
        `ali-${i}`,
        `Apple iPhone 14 Pro Max ${128 + i}GB Factory Unlocked Device ${i}`,
        600 + i * 10,
      ),
    );
    const admitad = Array.from({ length: 8 }, (_, i) =>
      phone(
        "admitad",
        `adm-${i}`,
        `Apple iPhone 15 Pro Grade-A Refurbished ${256 + i}GB Device ${i}`,
        520 + i * 7,
      ),
    );

    const results = assembleProductionSearchResults(
      [...ebay, ...aliExpress, ...admitad],
      QUERY,
      50,
    );

    const stores = new Set(results.map((r) => r.storeSlug));
    expect(stores).toEqual(new Set(["ebay", "aliexpress", "admitad"]));

    // Strict equal share of the leading pool: eBay capped, peers keep genuine
    // device inventory reachable (not pushed off the top-12 viewport).
    expect(results.filter((r) => r.storeSlug === "ebay").length).toBeLessThan(25);
    expect(results.filter((r) => r.storeSlug === "aliexpress").length).toBeGreaterThan(0);
    expect(results.filter((r) => r.storeSlug === "admitad").length).toBeGreaterThan(0);
  });

  it("enforces at most 2 consecutive eBay slots in the top 12 when eBay owns the cheapest devices", () => {
    const ebay = Array.from({ length: 20 }, (_, i) =>
      phone(
        "ebay",
        `eb-${i}`,
        `Apple iPhone 15 Pro $${500 + i} Unlocked Device ${i}`,
        500 + i * 4,
      ),
    );
    const aliExpress = Array.from({ length: 6 }, (_, i) =>
      phone(
        "aliexpress",
        `ali-${i}`,
        `Apple iPhone 15 Pro Max 512GB Device ${i}`,
        1000 + i,
      ),
    );

    const results = assembleProductionSearchResults(
      [...ebay, ...aliExpress],
      QUERY,
      12,
      { sortBy: "price" },
    );

    // Price sort is preserved (cheapest first) but no single provider may hold
    // more than 2 consecutive slots in the leading viewport — eBay's cheap run
    // is broken by AliExpress's next-cheapest genuine device.
    const expected = [...results.map((r) => r.price)];
    expect(expected[0]!).toBeLessThanOrEqual(expected[11]!);

    let run = 0;
    for (const r of results) {
      run = r.storeSlug === "ebay" ? run + 1 : 0;
      expect(run).toBeLessThanOrEqual(2);
    }
    expect(results.some((r) => r.storeSlug === "aliexpress")).toBe(true);
  });
});

describe("price-mode top-viewport diversity (diversifyTopViewport)", () => {
  const item = (providerId: string, price: number) => ({ providerId, price });

  it("keeps pure order when no provider exceeds 2 consecutive", () => {
    const sorted = [
      item("admitad", 100),
      item("aliexpress", 105),
      item("ebay", 110),
      item("admitad", 115),
    ];
    const out = diversifyTopViewport(sorted);
    expect(out).toEqual(sorted);
  });

  it("interleaves next-cheapest from another provider to break an eBay run", () => {
    // eBay owns the cheap block; AliExpress owns the next-cheapest items. Pure
    // sort would show 12 eBay slots in the leading viewport; the cap interleaves
    // AliExpress's items so no single provider holds more than 2 consecutive
    // slots inside the top-12 window.
    const sorted = [
      ...Array.from({ length: 12 }, (_, i) => item("ebay", 100 + i)),
      item("aliexpress", 500),
      item("aliexpress", 501),
      item("aliexpress", 502),
      item("aliexpress", 503),
    ] as ReturnType<typeof item>[];
    const out = diversifyTopViewport(sorted);

    expect(out).toHaveLength(16);

    let run = 0;
    for (const r of out.slice(0, PRICE_SORT_DIVERSITY_WINDOW)) {
      run = r.providerId === "ebay" ? run + 1 : 0;
      expect(run).toBeLessThanOrEqual(2);
    }
    // AliExpress gets pulled into the viewport (not stranded at the tail).
    expect(out.slice(0, PRICE_SORT_DIVERSITY_WINDOW).some((r) => r.providerId === "aliexpress")).toBe(true);
  });

  it("is a pure permutation of the input (same items, same count)", () => {
    const sorted = [
      ...Array.from({ length: 10 }, (_, i) => item("ebay", 100 + i)),
      item("aliexpress", 900),
      item("admitad", 901),
    ];
    const out = diversifyTopViewport(sorted);
    expect(out).toHaveLength(sorted.length);
    const identity = ([p, price]: [string, number]) => `${p}:${price}`;
    expect(new Set(out.map((r) => identity([r.providerId, r.price])))).toEqual(
      new Set(sorted.map((r) => identity([r.providerId, r.price]))),
    );
  });

  it("does not trim a genuinely lone provider (real stock fills the viewport)", () => {
    const sorted = Array.from({ length: 20 }, (_, i) => item("ebay", 100 + i));
    const out = diversifyTopViewport(sorted);
    expect(out).toHaveLength(20);
    expect(out.every((r) => r.providerId === "ebay")).toBe(true);
  });

  it("exports the documented window/cap constants", () => {
    expect(PRICE_SORT_DIVERSITY_WINDOW).toBe(12);
    expect(PRICE_SORT_MAX_CONSECUTIVE_SAME_PROVIDER).toBe(2);
  });
});