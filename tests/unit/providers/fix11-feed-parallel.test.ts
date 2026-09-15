/**
 * Fix 11 regression guards — parallel Admitad multi-feed fan-out.
 *
 * Fix 11 scope (see diagnosis): `fetchAdmitadFeedProducts()` used to download
 * every merchant feed serially, so a cold cache paid the full serial ~N
 * feed-download time and regularly lost the caller's deadline race (Search 8s
 * fan-out, homepage 5s catalog budget, PDP 8s) — leaving Admitad absent from
 * cold results. Now every feed download starts concurrently, each bounded by
 * the SAME per-feed timeout and the shared wall-clock deadline, results keep
 * feed order, and a failed feed is skipped (failure isolation preserved).
 * The Admitad Search connector passes a deadline under the engine's fan-out
 * budget so its parallel feeds settle real partial results onto the page.
 *
 * Non-goals locked here: no provider removed, no result-limit / ranking /
 * affiliate / DB / env changes, no fabricated data. Fixes 1–10 intact.
 *
 * Mocking: suite runs with isolate:false + singleFork:true where per-module
 * `vi.mock` is unreliable, so this file uses deterministic exported test seams
 * (controlled promises — no network) plus the live-binding-spy engine pattern.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  fetchAdmitadFeedProducts,
  setAdmitadFeedFetchForTests,
  resetAdmitadFeedFetcherForTests,
} from "@/lib/integrations/admitad/feed-fetcher";
import {
  getAllAdmitadFeeds,
  setAdmitadDiscoveryRunnerForTests,
  resetAdmitadDiscoveryForTests,
} from "@/lib/integrations/admitad/config";
import type { AdmitadMerchantProgram } from "@/lib/integrations/admitad/merchant-discovery";
import type { AdmitadFeedOffer } from "@/lib/integrations/admitad/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import { PROVIDER_IDS, LIVE_PROVIDER_IDS } from "@/lib/providers/registry";
import type { ProviderAdapter } from "@/lib/providers/adapter";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import { searchProducts } from "@/lib/search/engine";
import { getAllProviderAdapters } from "@/lib/providers/adapter-registry";
import * as adapterRegistry from "@/lib/providers/adapter-registry";
import * as providerConfig from "@/lib/integration/provider-config";
import { resetRealCatalogProductCountForTests } from "@/lib/integration/database-catalog";
import { admitadSearchConnector } from "@/lib/search/connectors/admitad";
import * as feedFetcherModule from "@/lib/integrations/admitad/feed-fetcher";

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

function offer(
  id: number,
  name: string,
  price = 10,
  overrides: Partial<AdmitadFeedOffer> = {},
): AdmitadFeedOffer {
  return {
    id: String(id),
    name,
    price,
    oldprice: null,
    currencyId: "USD",
    description: "",
    vendor: "Merchant",
    url: `https://merchant.example/product/${id}.html`,
    image: `https://img.example/${id}.jpg`,
    modified_time: "",
    ...overrides,
  };
}

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

/** Seed discovery with N merchant feeds so the fetcher has real feeds. */
async function seedFeeds(n: number) {
  const merchants = Array.from({ length: n }, (_, i) =>
    program(`Merchant ${i + 1}`, 100 + i),
  );
  setAdmitadDiscoveryRunnerForTests(async () => ({
    activeMerchantPrograms: merchants,
  }));
  const feeds = await getAllAdmitadFeeds();
  expect(feeds).toHaveLength(n);
  return feeds;
}

beforeEach(() => {
  process.env.ADMITAD_CLIENT_ID = "test-id";
  process.env.ADMITAD_CLIENT_SECRET = "test-secret";
});

afterEach(() => {
  restore(savedEnv);
  resetAdmitadDiscoveryForTests();
  resetAdmitadFeedFetcherForTests();
  vi.restoreAllMocks();
  resetRealCatalogProductCountForTests();
  providerConfig.resetProviderEvidenceForTests();
});

describe("Fix 11: parallel multi-feed fan-out (no more serial ~N downloads)", () => {
  it("downloads ALL candidate feeds concurrently (peak concurrency == feed count)", async () => {
    await seedFeeds(4);

    let inFlight = 0;
    let maxInFlight = 0;
    const blocker = new Promise<void>((resolve) => {
      // Released only after the test observes the concurrency spike.
      setTimeout(resolve, 120);
    });
    setAdmitadFeedFetchForTests(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await blocker;
      inFlight -= 1;
      return [offer(1, "Mouse")];
    });

    const feeds = await fetchAdmitadFeedProducts({ deadlineMs: 2_000 });
    expect(maxInFlight).toBe(4); // serial would be 1
    expect(feeds).toHaveLength(4);
  });

  it("completes within the wall-clock deadline even when one feed stalls forever", async () => {
    await seedFeeds(3);
    let stalled = false;
    setAdmitadFeedFetchForTests(async (url) => {
      if (url.includes("feed.example/102")) {
        stalled = true;
        return new Promise<AdmitadFeedOffer[]>(() => {});
      }
      return [offer(1, "Mouse")];
    });

    const started = Date.now();
    const feeds = await fetchAdmitadFeedProducts({ deadlineMs: 120 });
    const elapsed = Date.now() - started;

    expect(stalled).toBe(true); // the stall began…
    expect(elapsed).toBeLessThan(2_000); // …but never held the run hostage
    // The stalled feed is dropped; the two healthy feeds returned.
    expect(feeds).toHaveLength(2);
  });

  it("respects the caller deadline when per-feed timeout is larger", async () => {
    await seedFeeds(2);
    let receivedTimeoutMs = 0;
    setAdmitadFeedFetchForTests(async (_url, opts) => {
      receivedTimeoutMs = opts.timeoutMs ?? 0;
      return [offer(1, "Mouse")];
    });

    await fetchAdmitadFeedProducts({
      deadlineMs: 90,
      timeoutPerFeedMs: 20_000,
    });
    // The per-feed budget is bounded by the shared wall-clock deadline.
    expect(receivedTimeoutMs).toBe(90);
  });

  it("preserves feed order in results (later feeds resolving first stay ordered)", async () => {
    await seedFeeds(3);
    const delays: Record<string, number> = {
      "https://feed.example/100.xml": 80,
      "https://feed.example/101.xml": 10,
      "https://feed.example/102.xml": 40,
    };
    setAdmitadFeedFetchForTests(async (url) => {
      await new Promise((resolve) => setTimeout(resolve, delays[url] ?? 0));
      return [offer(Number(url.match(/100(\d)/)?.[1] ?? 0), "Mouse")];
    });

    const feeds = await fetchAdmitadFeedProducts({ deadlineMs: 2_000 });
    expect(feeds.map((f) => f.feedSlug)).toEqual([
      "admitad-100",
      "admitad-101",
      "admitad-102",
    ]);
  });

  it("skips a failed feed and still returns all healthy feeds (failure isolation)", async () => {
    await seedFeeds(3);
    setAdmitadFeedFetchForTests(async (url) => {
      if (url.includes("feed.example/101")) {
        throw new Error("feed 500");
      }
      return [offer(1, "Mouse")];
    });

    const feeds = await fetchAdmitadFeedProducts({ deadlineMs: 2_000 });
    expect(feeds.map((f) => f.feedSlug)).toEqual([
      "admitad-100",
      "admitad-102",
    ]);
  });

  it("serves subsequent calls from the feed cache without re-downloading", async () => {
    await seedFeeds(2);
    let downloads = 0;
    setAdmitadFeedFetchForTests(async () => {
      downloads += 1;
      return [offer(1, "Mouse")];
    });

    const first = await fetchAdmitadFeedProducts({ deadlineMs: 2_000 });
    expect(downloads).toBe(2);
    expect(first).toHaveLength(2);

    const second = await fetchAdmitadFeedProducts({ deadlineMs: 2_000 });
    expect(downloads).toBe(2); // cache hit, no new downloads
    expect(second.map((f) => f.feedSlug)).toEqual(first.map((f) => f.feedSlug));
  });

  it("honors maxFeeds slicing and caps each feed at maxProductsPerFeed", async () => {
    await seedFeeds(5);
    let seenMaxOffers = -1;
    setAdmitadFeedFetchForTests(async (_url, opts) => {
      seenMaxOffers = opts.maxOffers ?? -1;
      return Array.from({ length: 10 }, (_, i) => offer(i, `Item ${i}`));
    });

    const feeds = await fetchAdmitadFeedProducts({
      maxFeeds: 3,
      maxProductsPerFeed: 4,
      deadlineMs: 2_000,
    });
    expect(feeds).toHaveLength(3); // only the first 3 feeds fetched
    expect(seenMaxOffers).toBe(4); // per-feed cap passed to the downloader
  });

  it("empty feed list returns empty (no downloads, never fabricates)", async () => {
    let downloads = 0;
    setAdmitadFeedFetchForTests(async () => {
      downloads += 1;
      return [offer(1, "Mouse")];
    });
    setAdmitadDiscoveryRunnerForTests(async () => ({
      activeMerchantPrograms: [],
    }));

    const feeds = await fetchAdmitadFeedProducts({ deadlineMs: 2_000 });
    expect(feeds).toHaveLength(0);
    expect(downloads).toBe(0);
  });
});

describe("Fix 11: Admitad search connector settles within the fan-out deadline", () => {
  it("calls fetchAdmitadFeedProducts with a deadline under the engine budget", async () => {
    await seedFeeds(2);
    const spy = vi
      .spyOn(feedFetcherModule, "fetchAdmitadFeedProducts")
      .mockResolvedValue([]);

    await admitadSearchConnector.search("mouse");

    // The engine races every connector at PROVIDER_FETCH_TIMEOUT_MS (8s); the
    // Admitad connector must hand a deadline under it so its parallel feeds
    // settle real partial results before the engine drops this provider.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]?.deadlineMs).toBe(7_000);
  });

  it("returns real feed products through the standard normalization", async () => {
    await seedFeeds(2);
    setAdmitadFeedFetchForTests(async () => [
      offer(1, "Wireless Mouse Logitech", 19),
      offer(2, "Gaming Mouse RGB", 29),
    ]);

    const listings = await admitadSearchConnector.search("mouse");
    expect(listings.length).toBeGreaterThan(0);
    for (const l of listings) {
      expect(l.providerId).toBe("admitad");
      expect(l.externalId.length).toBeGreaterThan(0);
      expect(l.price).toBeGreaterThan(0);
      expect(l.productUrl).toMatch(/^https:\/\//);
      expect(l.imageUrl).toMatch(/^https:\/\//);
    }
  });
});

describe("Fix 11: Fixes 1–10 behavior remains intact", () => {
  // A real device-shaped query + matching titles so relevance keeps all four.
  // Distinct from Fix 8/9/10 queries — the shared fork keeps the engine's
  // fairSearchCache across files, so a duplicated key would replay its items.
  const S11_QUERY = "samsung galaxy s25 ultra fix11";

  function listing(id: SearchProviderId): RawProviderListing {
    return {
      providerId: id,
      externalId: `fix11-${id}-1`,
      title: `Samsung Galaxy S25 Ultra 256GB fix11 ${id}`,
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
          ? "https://go.admitad.com/click/fix11"
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

    const items = await searchProducts(S11_QUERY, 20);

    const stores = new Set(items.map((i) => i.storeSlug));
    expect(stores.has("aliexpress")).toBe(true);
    expect(stores.has("ebay")).toBe(true);
    expect(stores.has("cjdropshipping")).toBe(true);
    expect(stores.has("admitad")).toBe(true);

    const admitadItem = items.find((i) => i.storeSlug === "admitad");
    expect(admitadItem?.affiliateUrl).toBe(
      "https://go.admitad.com/click/fix11",
    );

    // Fix 8 wiring: the DB supplement still receives the 8s timeout.
    expect(dbSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), {
      timeoutMs: 8_000,
    });
  });

  it("provider registry / defaults / paging contract are unchanged (Fixes 1–10)", () => {
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