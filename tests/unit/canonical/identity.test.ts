/**
 * Phase 3 identity bootstrap + persistence tests.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  backfillLowestPricesRows,
  bootstrapIdentityFromRow,
  canonicalProductKey,
  createIdentityStore,
  InMemoryCanonicalIdentityStore,
  LocalJsonIdentityStore,
  NoopCanonicalIdentityStore,
  SupabaseCanonicalIdentityStore,
  type IdentityInputRow,
} from "@/lib/canonical";
import type { SupabaseLikeClient } from "@/lib/canonical/identity";

const admitadRow = (over: Partial<IdentityInputRow> = {}): IdentityInputRow => ({
  product_id: "5d3f1a2e-0001-4b9e-8c2a-111111111111",
  product_name: "Wireless Bluetooth Earbuds Pro 2024 with Charging Case",
  provider: "admitad",
  store_name: "Alibaba WW",
  lowest_price: 12.99,
  original_price: 25.99,
  currency: "USD",
  country_code: "US",
  image_url: "https://ae01.alicdn.com/kf/earbuds-pro-1.jpg",
  affiliate_url: "https://example.com/aff_c?offer_id=1",
  external_url: "https://www.alibaba.com/product/earbuds-pro",
  ...over,
});

describe("identity bootstrap — determinism and clustering", () => {
  it("returns deterministic ids for the same row", () => {
    const a = bootstrapIdentityFromRow(admitadRow());
    const b = bootstrapIdentityFromRow(admitadRow());
    expect("identity" in a).toBe(true);
    expect("identity" in b).toBe(true);
    if ("identity" in a && "identity" in b) {
      expect(a.identity.canonicalProductId).toBe(b.identity.canonicalProductId);
      expect(a.identity.canonicalOfferId).toBe(b.identity.canonicalOfferId);
      expect(a.identity.confidence).toBe("suggested");
    }
  });

  it("id prefixes and provider scoping are correct", () => {
    const a = bootstrapIdentityFromRow(admitadRow());
    if ("identity" in a) {
      expect(a.identity.canonicalProductId.startsWith("canon:")).toBe(true);
      expect(a.identity.canonicalOfferId.startsWith("po:admitad:")).toBe(true);
    }
  });

  it("clusters identical titles (same product across merchants) into one product id", () => {
    const a = bootstrapIdentityFromRow(admitadRow({ product_id: "id-1", store_name: "Alibaba WW" }));
    const b = bootstrapIdentityFromRow(admitadRow({ product_id: "id-2", store_name: "DHgate" }));
    const c = bootstrapIdentityFromRow(admitadRow({ product_id: "id-3", store_name: "Made-in-China" }));
    if ("identity" in a && "identity" in b && "identity" in c) {
      expect(a.identity.canonicalProductId).toBe(b.identity.canonicalProductId);
      expect(a.identity.canonicalProductId).toBe(c.identity.canonicalProductId);
      // different external refs → distinct provider-scoped offers
      expect(a.identity.canonicalOfferId).not.toBe(b.identity.canonicalOfferId);
      expect(b.identity.canonicalOfferId).not.toBe(c.identity.canonicalOfferId);
    }
  });

  it("keeps a title key equal to the canonical product key fallback", () => {
    const a = bootstrapIdentityFromRow(admitadRow());
    if ("identity" in a) {
      expect(a.identity.key).toBe(canonicalProductKey({ title: admitadRow().product_name }));
    }
  });

  it("skips rows without a title", () => {
    const r = bootstrapIdentityFromRow(admitadRow({ product_name: "  " }));
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error.reason).toBe("no-title");
  });

  it("skips rows with missing/zero/non-numeric price", () => {
    for (const over of [{ lowest_price: 0 }, { lowest_price: -5 }, { lowest_price: NaN }]) {
      const r = bootstrapIdentityFromRow(admitadRow(over as Partial<IdentityInputRow>));
      expect("error" in r).toBe(true);
      if ("error" in r) expect(r.error.reason).toBe("no-price");
    }
  });

  it("skips rows with missing external id or provider", () => {
    const noId = bootstrapIdentityFromRow(admitadRow({ product_id: "" }));
    expect(noId).toEqual({ error: { reason: "no-external-id", productId: "" } });
    const noProvider = bootstrapIdentityFromRow(admitadRow({ provider: "" }));
    if ("error" in noProvider) expect(noProvider.error.reason).toBe("no-provider");
  });
});

describe("identity stores", () => {
  it("noop store discards everything", async () => {
    const store = new NoopCanonicalIdentityStore();
    expect(await store.writeMany([{ source: "lowest_prices_today", providerId: "admitad", externalId: "a", canonicalProductId: "p", canonicalOfferId: "o", confidence: "suggested", identifiers: [] }])).toBe(0);
    expect(await store.count()).toBe(0);
    expect(await store.getByExternalId("lowest_prices_today", "admitad", "a")).toBeNull();
    expect(store.kind).toBe("noop");
  });

  it("in-memory store dedupes on external key", async () => {
    const store = new InMemoryCanonicalIdentityStore();
    const rec = { source: "lowest_prices_today" as const, providerId: "admitad", externalId: "a", canonicalProductId: "p", canonicalOfferId: "o", confidence: "suggested" as const, identifiers: [] as string[] };
    expect(await store.writeMany([rec])).toBe(1);
    expect(await store.writeMany([{ ...rec, canonicalProductId: "p2" }])).toBe(0);
    expect(await store.count()).toBe(1);
    const found = await store.getByExternalId("lowest_prices_today", "admitad", "a");
    expect(found?.canonicalProductId).toBe("p");
    expect(store.all()).toHaveLength(1);
  });

  it("local JSON-lines store writes to file (safe non-production target)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "canon-identity-"));
    const filePath = path.join(dir, "identity.jsonl");
    const store = new LocalJsonIdentityStore(filePath);
    const rec = { source: "lowest_prices_today" as const, providerId: "admitad", externalId: "x-1", canonicalProductId: "canon:aaa", canonicalOfferId: "po:admitad:x-1", confidence: "suggested" as const, identifiers: [] as string[] };
    expect(await store.writeMany([rec])).toBe(1);
    expect(await store.count()).toBe(1);
    expect(fs.existsSync(filePath)).toBe(true);
    const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).canonicalProductId).toBe("canon:aaa");
    const found = await store.getByExternalId("lowest_prices_today", "admitad", "x-1");
    expect(found?.canonicalOfferId).toBe("po:admitad:x-1");
  });

  it("factory defaults to noop; file requires a path; memory works", () => {
    expect(createIdentityStore().kind).toBe("noop");
    expect(createIdentityStore("memory").kind).toBe("memory");
    expect(() => createIdentityStore("file")).toThrow(/filePath/);
    expect(createIdentityStore("file", { filePath: path.join(os.tmpdir(), "x.jsonl") }).kind).toBe("file");
  });

  it("supabase store no-ops on error and returns count on success", async () => {
    const failing = {
      from: () => ({ insert: async () => ({ error: new Error("boom") }) }),
    } as unknown as SupabaseLikeClient;
    expect(await new SupabaseCanonicalIdentityStore(failing).writeMany([{ source: "lowest_prices_today", providerId: "admitad", externalId: "a", canonicalProductId: "p", canonicalOfferId: "o", confidence: "suggested", identifiers: [] }])).toBe(0);

    const ok = {
      from: (_table: string) => {
        void _table;
        return { insert: async () => ({ error: null }) };
      },
    } as unknown as SupabaseLikeClient;
    expect(await new SupabaseCanonicalIdentityStore(ok).writeMany([{ source: "lowest_prices_today", providerId: "admitad", externalId: "a", canonicalProductId: "p", canonicalOfferId: "o", confidence: "suggested", identifiers: [] }])).toBe(1);
  });
});

describe("identity backfill", () => {
  const fixtureRows = (): IdentityInputRow[] =>
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "scripts", "fixtures", "lowest-prices-backfill-fixture.json"), "utf8"),
    ).rows as IdentityInputRow[];

  it("backfills against the fixture with expected stats", async () => {
    const store = new InMemoryCanonicalIdentityStore();
    const stats = await backfillLowestPricesRows(fixtureRows(), { store, skipExisting: true });
    expect(stats.totalRows).toBe(10);
    expect(stats.mapped).toBe(8); // 1 no-title + 1 zero-price skipped
    expect(stats.skipped).toBe(2);
    expect(stats.duplicateExternalKeys).toBe(0);
    expect(stats.uniqueProducts).toBe(5); // earbuds×3, desk×1, vacuum×2, led×1, mouse×1
    expect(stats.byProvider.admitad).toEqual({ rows: 10, mapped: 8 });
    expect(await store.count()).toBe(8);
  });

  it("skipExisting=true avoids rewriting external keys on a second run", async () => {
    const store = new InMemoryCanonicalIdentityStore();
    const first = await backfillLowestPricesRows(fixtureRows(), { store });
    expect(first.mapped).toBe(8);
    const second = await backfillLowestPricesRows(fixtureRows(), { store });
    expect(second.mapped).toBe(0);
    expect(second.existingSkipped).toBe(8);
    expect(await store.count()).toBe(8);
  });

  it("counts duplicate external refs inside one batch", async () => {
    const store = new InMemoryCanonicalIdentityStore();
    const rows = [admitadRow(), admitadRow()];
    const stats = await backfillLowestPricesRows(rows, { store });
    expect(stats.mapped).toBe(1);
    expect(stats.duplicateExternalKeys).toBe(1);
    expect(await store.count()).toBe(1);
  });
});