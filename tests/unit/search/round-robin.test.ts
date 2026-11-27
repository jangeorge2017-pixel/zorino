import { describe, expect, it } from "vitest";

import {
  interleaveByStoreRoundRobin,
  storeRoundRobinKey,
} from "@/lib/search/types";

function itemsFor(store: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${store}-${index + 1}`);
}

describe("search API round-robin", () => {
  it("fills 60 slots with equal store shares", () => {
    const items = [
      ...itemsFor("ebay", 40),
      ...itemsFor("admitad", 40),
      ...itemsFor("amazon", 40),
    ];
    const mixed = interleaveByStoreRoundRobin(items, (item) => item.split("-")[0]!, 60);

    expect(mixed).toHaveLength(60);
    expect(mixed.slice(0, 6)).toEqual([
      "ebay-1",
      "admitad-1",
      "amazon-1",
      "ebay-2",
      "admitad-2",
      "amazon-2",
    ]);
    for (const store of ["ebay", "admitad", "amazon"]) {
      expect(mixed.filter((item) => item.startsWith(`${store}-`))).toHaveLength(20);
    }
  });

  it("keeps source alternation while a peer still has stock", () => {
    const items = [...itemsFor("ebay", 30), ...itemsFor("noon", 4)];
    const mixed = interleaveByStoreRoundRobin(items, (item) => item.split("-")[0]!, 20);

    expect(mixed).toHaveLength(20);
    expect(mixed.slice(0, 8)).toEqual([
      "ebay-1",
      "noon-1",
      "ebay-2",
      "noon-2",
      "ebay-3",
      "noon-3",
      "ebay-4",
      "noon-4",
    ]);
  });

  it("keeps real merchant stores separate inside one provider", () => {
    const rows = [
      { storeSlug: "admitad", store: "Raneen", id: "a1" },
      { storeSlug: "admitad", store: "B-Tech", id: "a2" },
      { storeSlug: "temu", store: "Temu", id: "t1" },
      { storeSlug: "admitad", store: "Raneen", id: "a3" },
    ];

    expect(storeRoundRobinKey(rows[0]!)).not.toBe(storeRoundRobinKey(rows[1]!));
    expect(interleaveByStoreRoundRobin(rows, storeRoundRobinKey, 4).map((row) => row.id)).toEqual([
      "a1",
      "a2",
      "t1",
      "a3",
    ]);
  });

  it("never repeats a store while another queued store has stock", () => {
    const items = [
      ...itemsFor("ebay", 12),
      ...itemsFor("amazon", 12),
      ...itemsFor("noon", 12),
    ];
    const mixed = interleaveByStoreRoundRobin(items, (item) => item.split("-")[0]!, 24);

    expect(mixed).toHaveLength(24);
    for (let index = 1; index < mixed.length; index += 1) {
      const previous = mixed[index - 1]!.split("-")[0];
      const current = mixed[index]!.split("-")[0];
      const previousRemaining = items.filter((item) => item.startsWith(`${previous}-`)).length;
      const currentRemaining = items.filter((item) => item.startsWith(`${current}-`)).length;
      if (previousRemaining > 0 && currentRemaining > 0) {
        expect(previous).not.toBe(current);
      }
    }
  });
});
