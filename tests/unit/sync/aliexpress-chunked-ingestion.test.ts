/**
 * Unit tests — resumable AliExpress import cursors + bridge write filter.
 *
 * The chunked ingestion pipeline (Vercel 504 fix) must:
 *  - advance a keyword×page sweep in micro-batches and report done only when
 *    every keyword/page is consumed (cursor math is pure and DB-independent),
 *  - advance an external-id offset through the stored id list,
 *  - skip bulk-upsert writes that would raise a price or rewrite an identical
 *    row (never-overwrite-cheaper + skip-identical-update contract).
 */
import { describe, expect, it } from "vitest";

import {
  advanceIdsCursor,
  advanceSweepCursor,
  startIdsCursor,
  startSweepCursor,
} from "@/lib/integrations/aliexpress/import-cursor";
import { shouldSkipBridgeWrite } from "@/lib/sync/import/lowest-prices-bridge";

describe("advanceSweepCursor", () => {
  it("advances within a keyword until maxPages", () => {
    const start = startSweepCursor();
    const step1 = advanceSweepCursor(start, 6, 3, 20, 20);
    expect(step1).toEqual({ next: { type: "sweep", keywordIndex: 0, page: 2 }, done: false });
    const step2 = advanceSweepCursor(step1.next!, 6, 3, 20, 20);
    expect(step2).toEqual({ next: { type: "sweep", keywordIndex: 0, page: 3 }, done: false });
    const step3 = advanceSweepCursor(step2.next!, 6, 3, 20, 20);
    expect(step3).toEqual({ next: { type: "sweep", keywordIndex: 1, page: 1 }, done: false });
  });

  it("advances keyword when a page is short (keyword exhausted)", () => {
    const start = startSweepCursor();
    const step = advanceSweepCursor(start, 6, 3, 20, 14);
    expect(step).toEqual({ next: { type: "sweep", keywordIndex: 1, page: 1 }, done: false });
  });

  it("reports done after the last keyword is exhausted", () => {
    const last = { type: "sweep" as const, keywordIndex: 5, page: 2 };
    const step = advanceSweepCursor(last, 6, 3, 20, 8);
    expect(step.done).toBe(true);
    expect(step.next).toBeNull();
  });

  it("reports done from the last keyword at maxPages with a full page", () => {
    const last = { type: "sweep" as const, keywordIndex: 5, page: 3 };
    const step = advanceSweepCursor(last, 6, 3, 20, 20);
    expect(step.done).toBe(true);
    expect(step.next).toBeNull();
  });

  it("handles zero keywords and out-of-range cursors defensively", () => {
    expect(advanceSweepCursor(startSweepCursor(), 0, 3, 20, 20).done).toBe(true);
    const negative = { type: "sweep" as const, keywordIndex: -3, page: -2 };
    const step = advanceSweepCursor(negative, 6, 3, 20, 20);
    expect(step.next).toEqual({ type: "sweep", keywordIndex: 0, page: 2 });
  });
});

describe("advanceIdsCursor", () => {
  it("advances by the batch size", () => {
    const step = advanceIdsCursor(0, 100, 20);
    expect(step).toEqual({ next: { type: "ids", offset: 20 }, done: false });
  });

  it("reports done when the batch consumes the tail", () => {
    const step = advanceIdsCursor(80, 100, 20);
    expect(step.done).toBe(true);
    expect(step.next).toBeNull();
  });

  it("starts at offset 0", () => {
    expect(startIdsCursor()).toEqual({ type: "ids", offset: 0 });
  });

  it("guards against a non-positive batch size", () => {
    const step = advanceIdsCursor(0, 100, -5);
    expect(step.next).toEqual({ type: "ids", offset: 1 });
  });
});

describe("shouldSkipBridgeWrite", () => {
  const existing = { price: 10, imageUrl: "https://img/x.jpg" };

  it("writes a brand-new product", () => {
    expect(shouldSkipBridgeWrite(null, 5, "https://img/y.jpg")).toBe(false);
  });

  it("never overwrites a cheaper existing offer", () => {
    expect(shouldSkipBridgeWrite(existing, 12, "https://img/y.jpg")).toBe(true);
  });

  it("skips an identical equal-price + same-image upsert", () => {
    expect(shouldSkipBridgeWrite(existing, 10, existing.imageUrl)).toBe(true);
  });

  it("writes an equal-price offer with a NEW image", () => {
    expect(shouldSkipBridgeWrite(existing, 10, "https://img/y.jpg")).toBe(false);
  });

  it("writes a genuinely cheaper offer", () => {
    expect(shouldSkipBridgeWrite(existing, 8, "https://img/y.jpg")).toBe(false);
  });

  it("treats sub-cent rounding noise as equal price", () => {
    expect(shouldSkipBridgeWrite(existing, 9.999, existing.imageUrl)).toBe(true);
  });
});