/**
 * Fix 10 regression guards — overlap Admitad discovery with provider fan-out.
 *
 * Fix 10 scope (see diagnosis): on warm instances where REAL known feeds are
 * already available, `getAllAdmitadFeeds()` must serve them immediately and let
 * a due discovery refresh run in the background, so the request path (search /
 * homepage fan-out → isAvailable() → getAllAdmitadFeeds()) never waits on a
 * discovery promise when usable feeds are already known. The cold-start path
 * (no usable feeds yet) keeps awaiting the single shared run — Fix 9's
 * in-flight dedup and 8s hard deadline are preserved exactly, and the
 * request path can NEVER prematurely wait for a refresh once feeds exist.
 *
 * Non-goals locked here: no provider removed, no feed-fetcher change, no
 * result-limit / ranking / affiliate / DB / env changes. Real data only —
 * feeds are only ever replaced by another REAL discovery run's output.
 *
 * Mocking: suite runs with isolate:false + singleFork:true where per-module
 * `vi.mock` is unreliable, so this file uses deterministic exported test seams
 * (controlled promises — no network) plus the live-binding-spy engine pattern.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  ADMITAD_DISCOVERY_DEADLINE_MS,
  ADMITAD_DISCOVERY_REFRESH_TTL_MS,
  getAllAdmitadFeeds,
  initializeMultiMerchantDiscovery,
  setAdmitadDiscoveryRunnerForTests,
  setAdmitadDiscoveryDeadlineForTests,
  setAdmitadDiscoveryRefreshTtlForTests,
  resetAdmitadDiscoveryForTests,
} from "@/lib/integrations/admitad/config";
import type { AdmitadMerchantProgram } from "@/lib/integrations/admitad/merchant-discovery";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import { PROVIDER_IDS, LIVE_PROVIDER_IDS } from "@/lib/providers/registry";
import type { ProviderAdapter } from "@/lib/providers/adapter";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import { searchProducts } from "@/lib/search/engine";
import { getAllProviderAdapters } from "@/lib/providers/adapter-registry";
import * as adapterRegistry from "@/lib/providers/adapter-registry";
import * as providerConfig from "@/lib/integration/provider-config";
import { resetRealCatalogProductCountForTests } from "@/lib/integration/database-catalog";

const CRED_KEYS = ["ADMITAD_CLIENT_ID", "ADMITAD_CLIENT_SECRET"] as const;

function program(
  merchantName: string,
  campaignId: number,
  feedUrl: string | null = `https://feed.example/${campaignId}.xml`,
): AdmitadMerchantProgram {
  return {
    campaignId,
    websiteId: 1,
    merchantName,
    feedUrl,
    feedUrls: feedUrl ? [feedUrl] : [],
    gotolink: `https://gotolink.example/${campaignId}`,
    canGenerateDeeplinks: true,
    connectionStatus: "active",
    geoRestrictions: [],
    categories: ["Electronics"],
    currency: "USD",
    siteUrl: "https://merchant.example",
  };
}

type DiscoveryResult = { activeMerchantPrograms: AdmitadMerchantProgram[] };

function saveEnv() {
  const saved: Record<string, string | undefined> = {};
  for (const k of CRED_KEYS) saved[k] = process.env[k];
  return saved;
}
function restore(saved: Record<string, string | undefined>) {
  for (const k of CRED_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

const savedEnv = saveEnv();

beforeEach(() => {
  process.env.ADMITAD_CLIENT_ID = "test-id";
  process.env.ADMITAD_CLIENT_SECRET = "test-secret";
});

afterEach(() => {
  restore(savedEnv);
  resetAdmitadDiscoveryForTests();
  vi.restoreAllMocks();
  resetRealCatalogProductCountForTests();
  providerConfig.resetProviderEvidenceForTests();
});

describe("Fix 10: known feeds are served immediately; discovery refreshes in the background", () => {
  it("request path returns known feeds WITHOUT waiting for the new discovery promise", async () => {
    // Cold start: complete ONE real discovery so known feeds exist.
    let executions = 0;
    setAdmitadDiscoveryRunnerForTests(async () => {
      executions += 1;
      return { activeMerchantPrograms: [program("Alibaba", 101)] };
    });
    const known = await getAllAdmitadFeeds();
    expect(known).toHaveLength(1);

    // A due refresh is now controller-blocked (never resolves until released).
    let refreshStarted = false;
    let releaseRefresh!: (value: DiscoveryResult) => void;
    const gate = new Promise<DiscoveryResult>((resolve) => {
      releaseRefresh = resolve;
    });
    setAdmitadDiscoveryRunnerForTests(async () => {
      executions += 1;
      refreshStarted = true;
      return gate;
    });
    setAdmitadDiscoveryRefreshTtlForTests(0); // force the refresh to be due

    // Caller #1 must NOT wait on the pending discovery promise.
    const started = Date.now();
    let settled = false;
    let returned: unknown;
    void getAllAdmitadFeeds().then((feeds) => {
      settled = true;
      returned = feeds;
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(refreshStarted).toBe(true); // new discovery (refresh) started…
    expect(settled).toBe(true); // …but the caller already returned known feeds
    expect(Date.now() - started).toBeLessThan(150); // no ~await on the refresh
    expect((returned as { name: string }[])[0]?.name).toBe("Alibaba");
    expect(executions).toBe(2);

    // Caller #2 during the still-pending refresh: served immediately, and the
    // background run is deduped — no third discovery starts.
    const second = await getAllAdmitadFeeds();
    expect(second.map((f) => f.name)).toEqual(["Alibaba"]);
    expect(executions).toBe(2);

    // The background refresh, once settled, replaces feeds with the NEW real
    // result — never a synthesized one.
    releaseRefresh({
      activeMerchantPrograms: [
        program("Alibaba", 101),
        program("DHgate", 200),
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    setAdmitadDiscoveryRefreshTtlForTests(null); // back to default TTL
    const refreshed = await getAllAdmitadFeeds();
    expect(refreshed.map((f) => f.name)).toEqual(["Alibaba", "DHgate"]);
  });

  it("within the refresh TTL, reads do NOT start any new discovery (no churn)", async () => {
    let executions = 0;
    setAdmitadDiscoveryRunnerForTests(async () => {
      executions += 1;
      return { activeMerchantPrograms: [program("Alibaba", 101)] };
    });
    await getAllAdmitadFeeds();
    expect(executions).toBe(1);

    // Repeated reads within the default TTL must not trigger re-discovery.
    await getAllAdmitadFeeds();
    await getAllAdmitadFeeds();
    await initializeMultiMerchantDiscovery();
    expect(executions).toBe(1);
    expect(ADMITAD_DISCOVERY_REFRESH_TTL_MS).toBeGreaterThan(0);
  });
});

describe("Fix 10: Fix 9 dedup + hard deadline remain intact", () => {
  it("concurrent cold callers still share ONE in-flight discovery (Fix 9 dedup)", async () => {
    let executions = 0;
    let release!: (value: DiscoveryResult) => void;
    const gate = new Promise<DiscoveryResult>((resolve) => {
      release = resolve;
    });
    setAdmitadDiscoveryRunnerForTests(async () => {
      executions += 1;
      return gate;
    });

    const inFlight = Array.from({ length: 6 }, () => getAllAdmitadFeeds());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(executions).toBe(1);

    release({ activeMerchantPrograms: [program("Alibaba", 7)] });
    const feeds = await Promise.all(inFlight);
    expect(executions).toBe(1);
    for (const batch of feeds) {
      expect(batch).toHaveLength(1);
      expect(batch[0].slug).toBe("admitad-7");
    }
  });

  it("a hanging discovery (cold start) cannot exceed the hard deadline", async () => {
    setAdmitadDiscoveryDeadlineForTests(60);
    setAdmitadDiscoveryRunnerForTests(
      () => new Promise<DiscoveryResult>(() => {}),
    );

    const started = Date.now();
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(ADMITAD_DISCOVERY_DEADLINE_MS).toBe(8_000);
  });
});

describe("Fix 10: cold-start / failure behavior is preserved", () => {
  it("no usable feeds keeps the safe cold-start behavior (empty, no retry loop)", async () => {
    let executions = 0;
    setAdmitadDiscoveryRunnerForTests(async () => {
      executions += 1;
      return { activeMerchantPrograms: [] };
    });
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);
    expect(executions).toBe(1);
  });

  it("a failing discovery never fabricates result feeds and settles empty", async () => {
    let executions = 0;
    setAdmitadDiscoveryRunnerForTests(async () => {
      executions += 1;
      throw new Error("admitad discovery boom");
    });
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);
    expect(executions).toBe(1);
  });

  it("successful discovery maps to identical feed semantics (provider output unchanged)", async () => {
    setAdmitadDiscoveryRunnerForTests(async () => ({
      activeMerchantPrograms: [
        program("DHgate", 200),
        program("Alibaba", 101),
        program("NoFeed Merchant", 400, null),
      ],
    }));

    const feeds = await getAllAdmitadFeeds();
    expect(feeds.map((f) => f.name)).toEqual(["Alibaba", "DHgate"]);
    expect(feeds[0]).toEqual({
      name: "Alibaba",
      slug: "admitad-101",
      feedUrl: "https://feed.example/101.xml",
      isPrimary: false,
      merchantId: 101,
      websiteId: 1,
      canGenerateDeeplinks: true,
      geoRestrictions: [],
      categories: ["Electronics"],
    });
  });
});

describe("Fix 10: all other providers remain active; search stays multi-provider", () => {
  // A real device-shaped query + matching titles so relevance keeps all four.
  // Distinct from Fix 8/9 queries — the shared fork keeps the engine's
  // fairSearchCache across files, so a duplicated key would replay its items.
  const S25_QUERY = "samsung galaxy s25 ultra fix10";

  function listing(id: SearchProviderId): RawProviderListing {
    return {
      providerId: id,
      externalId: `fix10-${id}-1`,
      title: `Samsung Galaxy S25 Ultra 256GB fix10 ${id}`,
      imageUrl: `https://img.example/${id}.jpg`,
      price: 42,
      originalPrice: 60,
      discount: 30,
      currency: "USD",
      storeName: id.charAt(0).toUpperCase() + id.slice(1),
      category: "Smartphones",
      rating: 4.5,
      reviewCount: 10,
      inStock: true,
      productUrl: `https://merchant.example/${id}`,
      affiliateUrl:
        id === "admitad"
          ? "https://go.admitad.com/click/fix10"
          : `https://affiliate.example/${id}`,
      countryCode: "US",
    };
  }

  function fakeAdapter(id: SearchProviderId): ProviderAdapter {
    return {
      id,
      name: id,
      async isAvailable() {
        return true;
      },
      normalize() {
        return listing(id);
      },
      normalizeBatch() {
        return [listing(id)];
      },
      async search() {
        return { providerId: id, listings: [listing(id)], durationMs: 8 };
      },
    };
  }

  const ALL_FOUR: SearchProviderId[] = [
    "aliexpress",
    "ebay",
    "cjdropshipping",
    "admitad",
  ];

  it("all four active providers still contribute to search (diversity unchanged)", async () => {
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue(
      ALL_FOUR.map(fakeAdapter),
    );
    vi.spyOn(providerConfig, "getActiveProductionProviders").mockResolvedValue(
      ALL_FOUR,
    );
    const dbSpy = vi
      .spyOn(
        await import("@/lib/integration/database-catalog"),
        "getSearchResultsFromDatabase",
      )
      .mockResolvedValue([]);

    const items = await searchProducts(S25_QUERY, 20);

    const stores = new Set(items.map((i) => i.storeSlug));
    expect(stores.has("aliexpress")).toBe(true);
    expect(stores.has("ebay")).toBe(true);
    expect(stores.has("cjdropshipping")).toBe(true);
    expect(stores.has("admitad")).toBe(true);

    const admitadItem = items.find((i) => i.storeSlug === "admitad");
    expect(admitadItem?.affiliateUrl).toBe(
      "https://go.admitad.com/click/fix10",
    );

    // Fix 8 wiring: the DB supplement still receives the 8s timeout.
    expect(dbSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), {
      timeoutMs: 8_000,
    });
  });

  it("provider registry / defaults / paging contract are unchanged (Fixes 1–9)", () => {
    expect(PROVIDER_IDS).toHaveLength(11);
    expect([...LIVE_PROVIDER_IDS]).toEqual([
      "aliexpress",
      "ebay",
      "cjdropshipping",
      "admitad",
    ]);
    const adapterIds = getAllProviderAdapters().map((a) => a.id);
    for (const id of ALL_FOUR) expect(adapterIds).toContain(id);
    expect(SEARCH_ENGINE_DEFAULTS.PAGE_SIZE).toBe(50);
    expect(SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER).toBe(12);
    expect(SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT).toBe(200);
  });
});

describe("Fix 10: deterministic local timing evidence (overlap vs serial)", () => {
  it("BEFORE-equivalent — cold start (no known feeds): request path waits for the discovery run", async () => {
    // The runner is controller-blocked and only ever released by the hard
    // deadline abort — exactly the serial behavior: with no usable feeds the
    // fully cold path MUST wait (safe behavior preserved), at a cost ≈ deadline.
    setAdmitadDiscoveryDeadlineForTests(80);
    setAdmitadDiscoveryRunnerForTests(
      () => new Promise<DiscoveryResult>(() => {}),
    );

    const started = Date.now();
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);
    const elapsed = Date.now() - started;

    // Serial wait observed: ≥ 50ms of an 80ms deadline (not sub-ms).
    expect(elapsed).toBeGreaterThanOrEqual(50);
    expect(elapsed).toBeLessThan(2_000);
  });

  it("AFTER — warm start (known feeds): request path returns while discovery refresh is still pending", async () => {
    let executions = 0;
    setAdmitadDiscoveryRunnerForTests(async () => {
      executions += 1;
      return { activeMerchantPrograms: [program("Alibaba", 101)] };
    });
    await getAllAdmitadFeeds(); // establish known feeds (1 run)

    // Now gate the refresh so it NEVER settles until released.
    let refreshStarted = false;
    let releaseRefresh!: (value: DiscoveryResult) => void;
    const gate = new Promise<DiscoveryResult>((resolve) => {
      releaseRefresh = resolve;
    });
    setAdmitadDiscoveryRunnerForTests(async () => {
      executions += 1;
      refreshStarted = true;
      return gate;
    });
    setAdmitadDiscoveryRefreshTtlForTests(0); // refresh is due immediately

    const started = Date.now();
    const feeds = await getAllAdmitadFeeds();
    const elapsed = Date.now() - started;

    expect(refreshStarted).toBe(true);
    expect(feeds.map((f) => f.name)).toEqual(["Alibaba"]);
    expect(executions).toBe(2);
    // Overlap observed: the request path did NOT wait ~deadline on the refresh.
    expect(elapsed).toBeLessThan(150);

    releaseRefresh({ activeMerchantPrograms: [program("Alibaba", 101)] });
    setAdmitadDiscoveryRefreshTtlForTests(null);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});