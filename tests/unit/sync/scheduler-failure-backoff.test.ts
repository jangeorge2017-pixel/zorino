/**
 * Unit tests — sync scheduler failure backoff.
 *
 * A chronically failing provider (e.g. a revoked/disabled API key) must not
 * keep winning the oldest-due race and starving the shared cron budget. These
 * tests cover the pure consecutive-failure streak computation that drives the
 * reorder + extended-backoff behavior in `runDueSyncJobs`.
 */
import { describe, expect, it } from "vitest";

import { computeFailureStreaks } from "@/lib/sync/scheduler";

type Row = { store_id: string | null; status: string };

describe("computeFailureStreaks", () => {
  it("counts consecutive failures from the most recent run", () => {
    const rows: Row[] = [
      { store_id: "cj", status: "failed" },
      { store_id: "cj", status: "failed" },
      { store_id: "cj", status: "failed" },
      { store_id: "ebay", status: "completed" },
    ];
    const streaks = computeFailureStreaks(rows);
    expect(streaks.get("cj")).toBe(3);
    expect(streaks.has("ebay")).toBe(false);
  });

  it("closes the streak at the first non-failed run", () => {
    const rows: Row[] = [
      { store_id: "cj", status: "failed" },
      { store_id: "cj", status: "failed" },
      { store_id: "cj", status: "completed" },
      { store_id: "cj", status: "failed" },
      { store_id: "cj", status: "failed" },
    ];
    expect(computeFailureStreaks(rows).get("cj")).toBe(2);
  });

  it("returns an empty map when no runs failed", () => {
    const rows: Row[] = [
      { store_id: "ebay", status: "completed" },
      { store_id: "aliexpress", status: "completed" },
    ];
    expect(computeFailureStreaks(rows).size).toBe(0);
  });

  it("ignores rows without a store id", () => {
    const rows: Row[] = [
      { store_id: null, status: "failed" },
      { store_id: "amazon", status: "failed" },
    ];
    const streaks = computeFailureStreaks(rows);
    expect(streaks.size).toBe(1);
    expect(streaks.get("amazon")).toBe(1);
  });

  it("applies the lookback order per store independently", () => {
    const rows: Row[] = [
      { store_id: "cj", status: "failed" },
      { store_id: "ebay", status: "failed" },
      { store_id: "cj", status: "failed" },
      { store_id: "ebay", status: "completed" },
    ];
    const streaks = computeFailureStreaks(rows);
    expect(streaks.get("cj")).toBe(2);
    // ebay's most recent run failed, then the older run closed it → streak 1.
    expect(streaks.get("ebay")).toBe(1);
  });
});
