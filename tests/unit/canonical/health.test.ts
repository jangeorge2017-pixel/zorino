/**
 * Persisted provider health tests (Phase 2).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runAcquisition } from "@/lib/canonical/acquisition";
import {
  aggregateValidationRejections,
  checkpointFromRun,
  summarizeCheckpoint,
} from "@/lib/canonical";
import {
  createHealthCheckpointStore,
  InMemoryHealthCheckpointStore,
  NoopHealthCheckpointStore,
  resetHealthCheckpointStoreForTests,
  setHealthCheckpointStoreForTests,
  SupabaseHealthCheckpointStore,
} from "@/lib/integration/provider-health-persisted";
import type { RawOffer } from "@/lib/canonical";

const directRaw = (over: Partial<RawOffer> = {}): RawOffer => ({
  providerId: "aliexpress",
  externalOfferId: "ae-h1",
  acquisition: "direct",
  title: "Sony WH-1000XM5",
  price: 299,
  currency: "USD",
  images: [{ url: "https://ae01.alicdn.com/img/h.jpg" }],
  productUrl: "https://www.aliexpress.com/item/ae-h1.html",
  availability: "in_stock",
  ...over,
});

// Reset the memoized store between tests so flag/settings don't leak.
beforeEach(() => {
  resetHealthCheckpointStoreForTests();
});
afterEach(() => {
  resetHealthCheckpointStoreForTests();
});

describe("checkpointFromRun", () => {
  it("reports ok for a clean run with correct counts", async () => {
    const result = await runAcquisition({
      mode: "direct",
      strategy: "aliexpress-dpapi",
      fetchOffers: async () => [directRaw()],
    });
    const cp = checkpointFromRun(result, {
      source: "search",
      strategy: "aliexpress-dpapi",
      durationMs: 120,
    });
    expect(cp.status).toBe("ok");
    expect(cp.providerId).toBe("aliexpress");
    expect(cp.acquiredCount).toBe(1);
    expect(cp.acceptedCount).toBe(1);
    expect(cp.rejectedCount).toBe(0);
    expect(cp.productCount).toBe(1);
    expect(cp.validationRejections).toEqual({});
    expect(cp.collectedAt).toBeDefined();
  });

  it("reports error + writes rejection counters when nothing is accepted", async () => {
    const result = await runAcquisition({
      mode: "direct",
      strategy: "s",
      fetchOffers: async () => [
        directRaw({ externalOfferId: undefined }),
        directRaw({ price: -5 }),
      ],
    });
    const cp = checkpointFromRun(result, { source: "canonical", strategy: "s" });
    expect(cp.status).toBe("error");
    expect(cp.acceptedCount).toBe(0);
    expect(cp.rejectedCount).toBe(2);
    expect(cp.errorCode).toBe("G1_EXTERNAL_ID_MISSING");
    expect(cp.validationRejections["G1_EXTERNAL_ID_MISSING"]).toBe(1);
    expect(cp.validationRejections["G2_PRICE_INVALID"]).toBe(1);
  });

  it("reports degraded when some offers pass and some fail", async () => {
    const result = await runAcquisition({
      mode: "direct",
      strategy: "s",
      fetchOffers: async () => [directRaw(), directRaw({ externalOfferId: undefined })],
    });
    const cp = checkpointFromRun(result, { source: "search" });
    expect(cp.status).toBe("degraded");
    expect(cp.acceptedCount).toBe(1);
    expect(cp.rejectedCount).toBe(1);
  });
});

describe("aggregateValidationRejections", () => {
  it("tallies duplicate G-codes across rejected offers", async () => {
    const result = await runAcquisition({
      mode: "direct",
      strategy: "s",
      fetchOffers: async () => [
        directRaw({ price: -1 }),
        directRaw({ price: -2 }),
      ],
    });
    const counters = aggregateValidationRejections(result);
    expect(counters["G2_PRICE_INVALID"]).toBe(2);
  });
});

describe("store implementations", () => {
  it("noop store discards and reports nothing written", async () => {
    const store = new NoopHealthCheckpointStore();
    const cp = {
      providerId: "x",
      status: "ok" as const,
      source: "test",
      acquiredCount: 1,
      acceptedCount: 1,
      rejectedCount: 0,
      productCount: 1,
      validationRejections: {} as Record<string, number>,
      collectedAt: new Date().toISOString(),
    };
    expect(await store.write(cp)).toBe(false);
    expect(await store.writeMany([cp])).toBe(0);
  });

  it("in-memory store persists and exposes all checkpoints", async () => {
    const store = new InMemoryHealthCheckpointStore();
    const result = await runAcquisition({
      mode: "direct",
      strategy: "s",
      fetchOffers: async () => [directRaw()],
    });
    const cp = checkpointFromRun(result, { source: "search" });
    const written = await store.writeMany([cp, { ...cp, status: "degraded" }]);
    expect(written).toBe(2);
    expect(store.all().length).toBe(2);
    expect(store.latest()?.providerId).toBe("aliexpress");
  });

  it("supabase store no-ops cleanly without service-role credentials", async () => {
    // createSupabaseServiceClient() returns null without env keys → 0 written.
    const { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } = process.env;
    // (env is not present in CI unit tests; guard in case a dev has .env loaded)
    const store = new SupabaseHealthCheckpointStore();
    const written = await store.write({
      providerId: "aliexpress",
      status: "ok",
      source: "test",
      acquiredCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      productCount: 0,
      validationRejections: {},
      collectedAt: new Date().toISOString(),
    });
    if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL) {
      expect(written).toBe(false);
    } else {
      // With creds (dev machine) we accept either outcome but must not throw.
      expect(typeof written).toBe("boolean");
    }
  });
});

describe("createHealthCheckpointStore (flag-aware)", () => {
  it("returns the Noop store while ARCH_CANONICAL is off (default)", () => {
    const store = createHealthCheckpointStore();
    expect(store).toBeInstanceOf(NoopHealthCheckpointStore);
  });

  it("forwards a test-injected store", () => {
    const fake = new InMemoryHealthCheckpointStore();
    setHealthCheckpointStoreForTests(fake);
    expect(createHealthCheckpointStore()).toBe(fake);
  });
});

describe("summarizeCheckpoint", () => {
  it("renders a compact diagnostic line", async () => {
    const result = await runAcquisition({
      mode: "direct",
      strategy: "s",
      fetchOffers: async () => [directRaw()],
    });
    const cp = checkpointFromRun(result, { source: "search" });
    expect(summarizeCheckpoint(cp)).toContain("aliexpress → ok");
    expect(summarizeCheckpoint(cp)).toContain("accepted 1");
  });
});