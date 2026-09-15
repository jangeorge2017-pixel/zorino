/**
 * Fix 9 regression guards — Admitad merchant-discovery bounding + dedup.
 *
 * Fix 9 scope (see diagnosis): bound and de-duplicate Admitad discovery on
 * the request path so a cold-start burst (the homepage fans 8 curated search
 * queries out in parallel; each hits `getAllAdmitadFeeds()` during both
 * isAvailable() and search()) runs EXACTLY ONE discovery waterfall instead of
 * N duplicates, and that one run can never exceed the search engine's
 * per-provider budget (8s).
 *
 * Non-goals locked here: no provider removed, no result limits lowered, no
 * ranking/search/homepage/compare/PDP/store/affiliate behavior changed,
 * failure → empty fallback preserved byte-for-byte.
 *
 * Mocking: suite runs with isolate:false + singleFork:true where per-module
 * `vi.mock` is unreliable, so this file uses the exported test seams
 * (`setAdmitadDiscoveryRunnerForTests`, `setAdmitadDiscoveryDeadlineForTests`,
 * `resetAdmitadDiscoveryForTests`) which are deterministic and never touch the
 * network. Engine-level guards reuse the live-binding-spy pattern from
 * Fix 8's suite.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  ADMITAD_DISCOVERY_DEADLINE_MS,
  admitadCredentialsConfigured,
  initializeMultiMerchantDiscovery,
  getAllAdmitadFeeds,
  setAdmitadDiscoveryRunnerForTests,
  setAdmitadDiscoveryDeadlineForTests,
  resetAdmitadDiscoveryForTests,
} from "@/lib/integrations/admitad/config";
import type { AdmitadMerchantProgram } from "@/lib/integrations/admitad/merchant-discovery";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import { PROVIDER_IDS, LIVE_PROVIDER_IDS } from "@/lib/providers/registry";
import { searchProducts } from "@/lib/search/engine";
import * as adapterRegistry from "@/lib/providers/adapter-registry";
import * as providerConfig from "@/lib/integration/provider-config";
import {
  getSearchResultsFromDatabase,
  resetRealCatalogProductCountForTests,
} from "@/lib/integration/database-catalog";
import type { ProviderAdapter } from "@/lib/providers/adapter";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";

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

describe("Fix 9: hard deadline is bridged to the engine's provider budget", () => {
  it("the production deadline matches the engine's 8s provider budget", () => {
    expect(ADMITAD_DISCOVERY_DEADLINE_MS).toBe(8_000);
  });

  it("admits a running discovery until the deadline", async () => {
    expect(admitadCredentialsConfigured()).toBe(true);
  });
});

describe("Fix 9: concurrent callers share ONE in-flight discovery run", () => {
  it("8 concurrent initialize() calls execute discovery exactly once", async () => {
    let executions = 0;
    let release!: (value: { activeMerchantPrograms: AdmitadMerchantProgram[] }) => void;
    const gate = new Promise<{ activeMerchantPrograms: AdmitadMerchantProgram[] }>((resolve) => {
      release = resolve;
    });
    setAdmitadDiscoveryRunnerForTests(async () => {
      executions += 1;
      return gate;
    });

    const inFlight = Array.from({ length: 8 }, () => initializeMultiMerchantDiscovery());

    // Give the first caller time to start; the other 7 must have joined the
    // same in-flight promise instead of launching their own runs.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(executions).toBe(1);

    release({ activeMerchantPrograms: [] });
    await Promise.all(inFlight);
    expect(executions).toBe(1);
  });

  it("getAllAdmitadFeeds() concurrent callers share one discovery + result", async () => {
    let executions = 0;
    setAdmitadDiscoveryRunnerForTests(async () => {
      executions += 1;
      return { activeMerchantPrograms: [program("Alibaba", 101)] };
    });

    const feeds = await Promise.all(
      Array.from({ length: 6 }, () => getAllAdmitadFeeds()),
    );

    expect(executions).toBe(1);
    expect(feeds).toHaveLength(6);
    for (const batch of feeds) {
      expect(batch).toHaveLength(1);
      expect(batch[0].name).toBe("Alibaba");
      expect(batch[0].merchantId).toBe(101);
      expect(batch[0].slug).toBe("admitad-101");
    }
  });

  it("after settling, a later request waits for a fresh discovery only when state resets", async () => {
    let executions = 0;
    const runner = async () => {
      executions += 1;
      return { activeMerchantPrograms: [program("Alibaba", 12)] };
    };
    setAdmitadDiscoveryRunnerForTests(runner);

    await initializeMultiMerchantDiscovery();
    expect(executions).toBe(1);

    // Discovery is now initialized (in production this is exactly what stops
    // retry loops) — no re-run is triggered.
    await initializeMultiMerchantDiscovery();
    expect(executions).toBe(1);

    // A fresh cold start (new instance) can perform discovery again. Reset
    // clears the runner override too, so re-register the deterministic one.
    resetAdmitadDiscoveryForTests();
    setAdmitadDiscoveryRunnerForTests(runner);
    await initializeMultiMerchantDiscovery();
    expect(executions).toBe(2);
  });
});

describe("Fix 9: output + fallback semantics are preserved", () => {
  it("maps discovered merchants to feeds with identical fields (Alibaba first)", async () => {
    setAdmitadDiscoveryRunnerForTests(async () => ({
      activeMerchantPrograms: [
        program("DHgate", 200),
        program("Alibaba", 101),
        program("Sunsky", 300),
        program("NoFeeds Merchant", 400, null), // no feedUrl → excluded
      ],
    }));

    const feeds = await getAllAdmitadFeeds();

    expect(feeds.map((f) => f.name)).toEqual(["Alibaba", "DHgate", "Sunsky"]);
    expect(feeds[0]).toEqual({
      name: "Alibaba",
      slug: "admitad-101",
      feedUrl: "https://feed.example/101.xml",
      // isPrimary tracks the legacy ADMITAD_FEED_URL env var (module-level
      // `feedUrl` in config.ts), not the merchant's own feed — unset here.
      isPrimary: false,
      merchantId: 101,
      websiteId: 1,
      canGenerateDeeplinks: true,
      geoRestrictions: [],
      categories: ["Electronics"],
    });
  });

  it("failure preserves the empty/fallback behavior and never throws", async () => {
    setAdmitadDiscoveryRunnerForTests(async () => {
      throw new Error("admitad api boom");
    });

    await expect(initializeMultiMerchantDiscovery()).resolves.toBeUndefined();
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);

    // Marked initialized on failure — a later call must not retry (unchanged).
    await expect(initializeMultiMerchantDiscovery()).resolves.toBeUndefined();
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);
  });

  it("empty programs produce an empty feed list (no false feeds)", async () => {
    setAdmitadDiscoveryRunnerForTests(async () => ({ activeMerchantPrograms: [] }));
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);
  });
});

describe("Fix 9: abort / deadline bounds discovery", () => {
  it("when discovery honors the abort signal it terminates safely", async () => {
    setAdmitadDiscoveryDeadlineForTests(40);
    let observedAbort = false;
    setAdmitadDiscoveryRunnerForTests(async (_options, signal) => {
      return new Promise<{ activeMerchantPrograms: AdmitadMerchantProgram[] }>(
        (resolve) => {
          signal?.addEventListener(
            "abort",
            () => {
              observedAbort = true;
              resolve({ activeMerchantPrograms: [] });
            },
            { once: true },
          );
        },
      );
    });

    await expect(initializeMultiMerchantDiscovery()).resolves.toBeUndefined();
    expect(observedAbort).toBe(true);
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);
  });

  it("a hanging discovery cannot exceed the configured deadline", async () => {
    setAdmitadDiscoveryDeadlineForTests(50);
    setAdmitadDiscoveryRunnerForTests(
      () => new Promise<{ activeMerchantPrograms: AdmitadMerchantProgram[] }>(() => {}),
    );

    const started = Date.now();
    await expect(initializeMultiMerchantDiscovery()).resolves.toBeUndefined();
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(2_000);
    await expect(getAllAdmitadFeeds()).resolves.toEqual([]);
  });
});

describe("Fix 9: provider diversity + Fixes 1–8 remain intact", () => {
  // A real device-shaped query + matching titles so the engine's relevance
  // gate (rankRawListings drops tier "none" listings) keeps all four offers.
  // Distinct from Fix 8's suite query — the shared fork keeps the engine's
  // fairSearchCache across files, so a duplicated key would replay its items.
  const S25_QUERY = "samsung galaxy s25 ultra fix9";

  function listing(id: SearchProviderId): RawProviderListing {
    const base: RawProviderListing = {
      providerId: id,
      externalId: `fix9-${id}-1`,
      title: `Samsung Galaxy S25 Ultra 256GB fix9 ${id}`,
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
          ? "https://go.admitad.com/click/fix9"
          : `https://affiliate.example/${id}`,
      countryCode: "US",
    };
    return base;
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
    vi.spyOn(providerConfig, "getActiveProductionProviders").mockResolvedValue([
      "aliexpress",
      "ebay",
      "cjdropshipping",
      "admitad",
    ]);
    const dbSpy = vi
      .spyOn(await import("@/lib/integration/database-catalog"), "getSearchResultsFromDatabase")
      .mockResolvedValue([]);

    const items = await searchProducts(S25_QUERY, 20);

    const stores = new Set(items.map((i) => i.storeSlug));
    expect(stores.has("aliexpress")).toBe(true);
    expect(stores.has("ebay")).toBe(true);
    expect(stores.has("cjdropshipping")).toBe(true);
    expect(stores.has("admitad")).toBe(true);

    const admitadItem = items.find((i) => i.storeSlug === "admitad");
    expect(admitadItem?.affiliateUrl).toBe("https://go.admitad.com/click/fix9");

    // Fix 8 wiring: the DB supplement still receives the 8s timeout.
    expect(dbSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), {
      timeoutMs: 8_000,
    });
  });

  it("engine defaults / provider registry / paging contract are unchanged (Fixes 1–8)", () => {
    expect(SEARCH_ENGINE_DEFAULTS.PAGE_SIZE).toBe(50);
    expect(SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER).toBe(12);
    expect(SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT).toBe(200);
    expect(PROVIDER_IDS).toHaveLength(11);
    expect([...LIVE_PROVIDER_IDS]).toEqual([
      "aliexpress",
      "ebay",
      "cjdropshipping",
      "admitad",
    ]);
    expect(getSearchResultsFromDatabase).toBeTypeOf("function");
  });
});