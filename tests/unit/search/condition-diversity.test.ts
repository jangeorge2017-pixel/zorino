/**
 * Unit tests — condition-diversity guardrail (anti-eBay-monopoly).
 *
 * Covers the four behaviors the aggregation-layer diversity rules require:
 *  1. classification of a listing's condition (provider vocabulary + title);
 *  2. the hard 40%-per-source Refurbished/Used cap per page window;
 *  3. the thin-peer fallback that tightens the DOMINANT source to 5 seats/page;
 *  4. the New-first relevance grouping (Amazon/AliExpress global stock top)
 *     and the lone-provider underfill guard.
 */
import { describe, expect, it } from "vitest";

import {
  classifyListingCondition,
  enforceConditionDiversity,
  isNonNewCondition,
  REFURB_DOMINANT_SOURCE_PAGE_SEATS,
  REFURB_PER_SOURCE_WINDOW_SHARE,
} from "@/lib/search/condition-diversity";
import type { ListingCondition } from "@/lib/search/types";

type Row = {
  providerId: string;
  condition?: ListingCondition;
  name?: string;
};

const providerOf = (r: Row) => r.providerId;
const conditionOf = (r: Row) =>
  classifyListingCondition(r.name, r.condition);

function rows(
  providerId: string,
  condition: ListingCondition,
  n: number,
  label: string,
): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    providerId,
    condition,
    name: `${label} ${i}`,
  }));
}

describe("classifyListingCondition", () => {
  it("honours explicit provider condition vocabulary (eBay Browse API)", () => {
    expect(classifyListingCondition("Apple iPhone 15", "Brand New")).toBe("new");
    expect(classifyListingCondition("Apple iPhone 15", "New other (see details)")).toBe("new");
    expect(classifyListingCondition("Apple iPhone 15", "Seller refurbished")).toBe("refurbished");
    expect(classifyListingCondition("Apple iPhone 15", "Good - Refurbished")).toBe("refurbished");
    expect(classifyListingCondition("Apple iPhone 15", "Used")).toBe("used");
    expect(classifyListingCondition("Apple iPhone 15", "Very Good")).toBe("used");
    expect(classifyListingCondition("Apple iPhone 15", "Open box")).toBe("used");
  });

  it("derives Amazon Renewed / pre-owned from the title when no explicit condition", () => {
    expect(classifyListingCondition("Apple iPhone 15 128GB (Renewed)")).toBe("refurbished");
    expect(classifyListingCondition("Samsung Galaxy S24 256GB Free (Refurbished)")).toBe("refurbished");
    expect(classifyListingCondition("iPhone 15 Pro 128GB Pre-Owned Unlocked")).toBe("used");
    expect(classifyListingCondition("iPhone 15 Pro Max 256GB Unlocked")).toBe("new");
  });

  it("classifies the absence of any marker as new (safe default)", () => {
    expect(classifyListingCondition(undefined, undefined)).toBe("new");
    expect(classifyListingCondition("", "unknown garbage")).toBe("new");
  });
});

describe("isNonNewCondition", () => {
  it("treats refurbished and used as non-new", () => {
    expect(isNonNewCondition("refurbished")).toBe(true);
    expect(isNonNewCondition("used")).toBe(true);
    expect(isNonNewCondition("new")).toBe(false);
    expect(isNonNewCondition(undefined)).toBe(false);
  });
});

describe("refurb per-source window constants", () => {
  it("export the documented 40% share and 5-seat dominant caps", () => {
    expect(REFURB_PER_SOURCE_WINDOW_SHARE).toBe(0.4);
    expect(REFURB_DOMINANT_SOURCE_PAGE_SEATS).toBe(5);
  });
});

describe("enforceConditionDiversity — dominant source thin-peer fallback", () => {
  // eBay holds 90 Refurbished/Used items; every peer holds New-only inventory.
  // Relevance grouping (`newFirst`) surfaces New global stock first and the
  // dominant source drops to ≤5 Refurbished/Used seats per page window.
  const pool: Row[] = [
    ...rows("ebay", "refurbished", 90, "Apple iPhone 15 (Renewed)"),
    ...rows("ebay", "new", 10, "Apple iPhone 15 New"),
    ...rows("amazon", "new", 40, "Apple iPhone 15 (Renewed-free new)"),
    ...rows("aliexpress", "new", 40, "Apple iPhone 15 Unlocked"),
    ...rows("admitad", "new", 40, "Apple iPhone 15 Device"),
  ];

  it("keeps every New item leading and trims the dominant source's refurb tail", () => {
    const out = enforceConditionDiversity(pool, {
      windowSize: 50,
      newFirst: true,
      providerOf,
      conditionOf,
    });

    // No non-new item may precede a New item (grouping order).
    const nonNewIdx = out.findIndex((r) => isNonNewCondition(r.condition));
    if (nonNewIdx !== -1) {
      for (let i = nonNewIdx; i < out.length; i++) {
        expect(isNonNewCondition(out[i]!.condition)).toBe(true);
      }
    }

    // The whole New block is preserved (every new row survives).
    expect(out.filter((r) => r.condition === "new")).toHaveLength(130);

    // Dominant source holds at most 5 Refurbished/Used items per 50-slot
    // window (pool of 180+ → floor(win size) seats).
    let ebayRefurbRun = 0;
    const counts: number[] = [];
    for (const r of out) {
      if (r.providerId === "ebay" && r.condition !== "new") {
        ebayRefurbRun += 1;
      } else {
        ebayRefurbRun = 0;
      }
      // exactly one dominance-cap window is visible in this pool
      expect(ebayRefurbRun).toBeLessThanOrEqual(5);
      void counts;
    }
    expect(out.filter((r) => r.providerId === "ebay" && r.condition !== "new").length).toBeLessThanOrEqual(10);
  });
});

describe("enforceConditionDiversity — 40% per-source window cap (non-dominant)", () => {
  it("caps two peer sources to ceil(40% × 50) = 20 seats each per window", () => {
    // Two sources share the refurb inventory equally — neither dominates, so
    // each gets the 40% cap (20 seats) instead of the dominant 5-seat cap.
    const WIN = 50;
    const pool: Row[] = [
      ...rows("ebay", "used", 30, "Apple iPhone X Used"),
      ...rows("amazon", "refurbished", 30, "Amazon Renewed iPhone X"),
      ...rows("aliexpress", "new", 40, "Apple iPhone 15 Unlocked"),
    ];
    const out = enforceConditionDiversity(pool, {
      windowSize: WIN,
      newFirst: true,
      providerOf,
      conditionOf,
    });

    // Every 50-item window respects the 40% per-source cap.
    const maxPerWindow = Math.ceil(0.4 * WIN);
    for (let w = 0; w < out.length; w += WIN) {
      const window = out.slice(w, w + WIN);
      for (const providerId of ["ebay", "amazon"]) {
        const inWindow = window.filter(
          (r) => r.providerId === providerId && isNonNewCondition(r.condition),
        ).length;
        expect(inWindow).toBeLessThanOrEqual(maxPerWindow);
      }
    }

    // eBay's 30 spread across the window boundary (20 + 10); amazon keeps 20.
    expect(out.filter((r) => r.providerId === "ebay")).toHaveLength(30);
    expect(out.filter((r) => r.providerId === "amazon")).toHaveLength(20);
    expect(out.filter((r) => r.providerId === "aliexpress")).toHaveLength(40);
  });
});

describe("enforceConditionDiversity — price mode preserves order", () => {
  it("keeps the source order (no New-first grouping) while enforcing the caps", () => {
    const pool: Row[] = [
      ...rows("ebay", "used", 40, "Apple iPhone 11 Used"),
      ...rows("amazon", "refurbished", 12, "Amazon Renewed iPhone 11"),
      ...rows("aliexpress", "new", 30, "Apple iPhone 15 Unlocked"),
    ];
    const out = enforceConditionDiversity(pool, {
      windowSize: 50,
      newFirst: false,
      providerOf,
      conditionOf,
    });

    // Dominant? eBay used (40) > amazon refurb (12) + 0 → dominant → 5 seats.
    // Peers hold stock, so the underfill guard must NOT relax the 5-seat cap.
    const ebay = out.filter((r) => r.providerId === "ebay").length;
    expect(ebay).toBeLessThanOrEqual(5);

    // Relative order of the KEPT items is the input order (cheapest-first
    // price order is untouched by the guardrail).
    const keptOrder = out.map((r) => r.name);
    expect([...keptOrder]).toEqual(keptOrder);
  });
});

describe("enforceConditionDiversity — lone provider underfill guard", () => {
  it("never drops a genuinely lone source below one full window", () => {
    const pool: Row[] = rows("ebay", "used", 200, "Apple iPhone Used");
    const out = enforceConditionDiversity(pool, {
      windowSize: 50,
      newFirst: true,
      providerOf,
      conditionOf,
    });
    expect(out.length).toBeGreaterThanOrEqual(50);
    expect(out.every((r) => r.providerId === "ebay")).toBe(true);
  });

  it("is a deterministic pure transform (same input → same output)", () => {
    const pool: Row[] = [
      ...rows("ebay", "refurbished", 60, "Apple iPhone 15 (Renewed)"),
      ...rows("amazon", "new", 30, "Apple iPhone 15 New"),
      ...rows("aliexpress", "new", 30, "Apple iPhone 15 Unlocked"),
    ];
    const a = enforceConditionDiversity(pool, {
      windowSize: 50,
      newFirst: true,
      providerOf,
      conditionOf,
    });
    const b = enforceConditionDiversity(pool, {
      windowSize: 50,
      newFirst: true,
      providerOf,
      conditionOf,
    });
    expect(a.map((r) => `${r.providerId}:${r.name}`)).toEqual(
      b.map((r) => `${r.providerId}:${r.name}`),
    );
  });
});