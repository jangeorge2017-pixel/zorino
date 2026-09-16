/**
 * Search-relevance regression guards.
 *
 * This suite locks the four code-confirmed Search Relevance bugs identified in
 * the live diagnosis (www.zorino.org, iPhone 15 / iPhone 15 Pro Max / AirPods
 * Pro / Samsung Galaxy S24 / MacBook Pro queries):
 *
 *  Bug 1 — DB supplement bypassed relevance scoring. Rows that merely matched a
 *          short substring ("15", "pro", "max") landed on page 1 between real
 *          devices. Fixed: DB rows now pass `analyzeSearchListing`; tier
 *          "none" and "repair" rows are dropped before balancing.
 *  Bug 2 — Replacement-part titles escaped the repair/accessory term sets
 *          ("back glass", "rear glass", "glass housing", "rear housing",
 *          "chassis", "chasis", "housing", "capacity battery", "100% capacity",
 *          "battery new oem"). Fixed: vocabulary added.
 *  Bug 3 — Short tokens matched as substrings everywhere ("pro" ⊂
 *          "waterproof"/"professional"/"Projektor"; "15" ⊂ "x15-box"), and
 *          device-shaped unrelated titles grabbed a free "series" slot via the
 *          `else { tier = "series" }` fallback. Fixed: word-boundary matching
 *          (titleContainsWord, Postgres \m…\M regex) + overlap>=50 gate.
 *  Bug 4 — One DB card was interleaved after every live card. Fixed: relevant
 *          DB results are appended AFTER the live block.
 *
 * Mocking: suite runs with isolate:false + singleFork:true where per-module
 * `vi.mock` is unreliable, so this file uses live-binding spies, deterministic
 * feed seams (setAdmitadFeedFetchForTests), and the exported engine/test seams.
 * Queries are distinct across the shared fork so fairSearchCache never replays
 * items cached by Fix 8/10/11 files.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { analyzeSearchListing, titleContainsWord } from "@/lib/search/relevance";
import type { ProviderAdapter } from "@/lib/providers/adapter";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";
import { searchProducts } from "@/lib/search/engine";
import * as providerConfig from "@/lib/integration/provider-config";
import * as providerEvidence from "@/lib/integration/provider-evidence";
import * as adapterRegistry from "@/lib/providers/adapter-registry";
import { resetRealCatalogProductCountForTests } from "@/lib/integration/database-catalog";
import { admitadSearchConnector } from "@/lib/search/connectors/admitad";
import {
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

const dbCatalog = () => import("@/lib/integration/database-catalog");

const CRED_KEYS = ["ADMITAD_CLIENT_ID", "ADMITAD_CLIENT_SECRET"] as const;

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

function resetEvidenceState() {
  providerConfig.resetProviderEvidenceForTests();
  providerEvidence.resetProviderEvidenceForTests();
}

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

afterEach(() => {
  restore(savedEnv);
  resetAdmitadDiscoveryForTests();
  resetAdmitadFeedFetcherForTests();
  vi.restoreAllMocks();
  resetRealCatalogProductCountForTests();
  resetEvidenceState();
});

// ─── Bug 3: word-boundary matching ──────────────────────────────────────────

describe("Bug 3: short tokens match as whole words only (no substring floods)", () => {
  it("'pro' is not inside 'waterproof' / 'professional' / 'Projektor'", () => {
    expect(titleContainsWord("waterproof action camera", "pro")).toBe(false);
    expect(titleContainsWord("professional studio monitor", "pro")).toBe(false);
    expect(titleContainsWord("android tv-projektor 4k", "pro")).toBe(false);
  });

  it("'pro' is a word inside 'MacBook Pro 14'", () => {
    expect(titleContainsWord("Apple MacBook Pro 14 m3 max", "pro")).toBe(true);
  });

  it("'15' is not inside 'x15-box' but is inside 'iPhone 15'", () => {
    expect(titleContainsWord("etoe x15-box filter kit", "15")).toBe(false);
    expect(titleContainsWord("apple iphone 15 128gb", "15")).toBe(true);
  });

  it("substring leaks no longer promote unrelated devices to a series slot", () => {
    // Previously "Android TV-Projektor" matched the "pro" substring and took
    // tier "series" for a "macbook pro" query. Now: overlap 0 → nothing.
    expect(
      analyzeSearchListing("ETOE Whale Pro Android TV-Projektor 4K", "macbook pro").tier,
    ).toBe("none");

    // "GT2 Pro Smartwatch" matched "pro" and ranked above genuine earbuds.
    // Word-boundary still sees "pro", but 1/2 token overlap (35) < 50 → none.
    expect(
      analyzeSearchListing("ETOE Whale GT2 Pro Smartwatch 2", "airpods pro").tier,
    ).toBe("none");

    // Unrelated devices competing with "macbook pro" get dropped, not "series".
    expect(
      analyzeSearchListing("Waterproof Sport Smartwatch GPS", "macbook pro").tier,
    ).toBe("none");
    expect(
      analyzeSearchListing("Professional Studio Microphone", "macbook pro").tier,
    ).toBe("none");
  });

  it("genuine matches keep their exact/model/series tiers", () => {
    expect(
      analyzeSearchListing("Apple MacBook Pro 16 M3 Max 512GB", "macbook pro").tier,
    ).toBe("exact");
    expect(
      analyzeSearchListing("Apple AirPods Pro (2nd Gen) MagSafe", "airpods pro").tier,
    ).not.toBe("none");
    expect(
      analyzeSearchListing("Apple iPhone 15 Pro Max 256GB Unlocked GSM", "iphone 15 pro max").tier,
    ).toBe("exact");
    expect(
      analyzeSearchListing("Samsung Galaxy S24 128GB Unlocked", "samsung galaxy s24").isDevice,
    ).toBe(true);
  });

  it("device-shaped titles that genuinely overlap most tokens keep a series slot", () => {
    // Same series (Galaxy S FE) still ranks as series for a Galaxy S query.
    expect(
      analyzeSearchListing(
        "Samsung Galaxy S23 FE 5G 128GB Unlocked GSM Smartphone",
        "samsung galaxy s24",
      ).tier,
    ).toBe("series");
    // A device with most query tokens intact but an uncertain brand/model is
    // still kept (≥50% word overlap), never hard-dropped.
    expect(
      analyzeSearchListing(
        "Apple Pro Max 15 OLED Display 256GB",
        "iphone 15 pro max",
      ).tier,
    ).not.toBe("none");
  });
});

// ─── Bug 2: accessory / replacement-part vocabulary ─────────────────────────

describe("Bug 2: replacement hardware is classified as repair/accessory", () => {
  it("rear-glass / housing / chassis parts are repair parts, not exact devices", () => {
    for (const junk of [
      "Apple iPhone 15 pro max rear back glass housing chasis",
      "Apple iPhone 15 Pro Max Back Glass Repair",
      "iPhone 15 Pro Max Glass Housing Rear Assembly",
      "iPhone 15 Pro Max Rear Housing Chassis Replace",
    ]) {
      const result = analyzeSearchListing(junk, "iphone 15 pro max");
      expect(result.tier).toBe("repair");
    }
  });

  it("replacement battery parts are repair parts, not exact devices", () => {
    for (const junk of [
      "Apple iPhone 15 Pro Max Battery New OEM Genuine 100% Capacity Battery Health",
      "iPhone 15 Pro Max 100% Capacity Battery Replacement",
      "iPhone 15 Pro Max Capacity Battery Grade A Mah",
    ]) {
      const result = analyzeSearchListing(junk, "iphone 15 pro max");
      expect(result.tier).toBe("repair");
    }
  });

  it("genuine used phones mentioning battery health stay genuine devices", () => {
    expect(
      analyzeSearchListing(
        "Apple iPhone 15 Pro Max 256GB - Battery Health 88% Unlocked GSM",
        "iphone 15 pro max",
      ).tier,
    ).toBe("exact");
  });
});

// ─── Bug 3: Admitad connector feed matching ─────────────────────────────────

describe("Bug 3: Admitad connector matches query words by whole word, not substring", () => {
  beforeEach(() => {
    process.env.ADMITAD_CLIENT_ID = "test-id";
    process.env.ADMITAD_CLIENT_SECRET = "test-secret";
  });

  it("excludes waterproof/professional products from a 'macbook pro' search", async () => {
    await seedFeeds(1);
    setAdmitadFeedFetchForTests(async () => [
      offer(1, "Apple MacBook Pro 14 M3 512GB"),
      offer(2, "Professional Studio Monitor Stand"),
      offer(3, "Waterproof Sleeve Cover 15.6 inch"),
    ]);

    const listings = await admitadSearchConnector.search("macbook pro");

    const titles = listings.map((l) => l.title);
    expect(titles).toContain("Apple MacBook Pro 14 M3 512GB");
    expect(titles).not.toContain("Professional Studio Monitor Stand");
    // "Waterproof" must not match "pro"; it also lacks "macbook" → excluded.
    expect(titles).not.toContain("Waterproof Sleeve Cover 15.6 inch");
  });

  it("still returns real MacBook offers (genuine matches preserved)", async () => {
    await seedFeeds(1);
    setAdmitadFeedFetchForTests(async () => [
      offer(1, "Apple MacBook Pro 16 M4 Max 1TB"),
      offer(2, "Keyboard Cover Skin for MacBook Pro 16"),
    ]);

    const listings = await admitadSearchConnector.search("macbook pro");
    const titles = listings.map((l) => l.title);

    const macbook = titles.find((t) => t.includes("MacBook Pro 16 M4"));
    expect(macbook).toBeTruthy();
    for (const l of listings) {
      expect(l.price).toBeGreaterThan(0);
      expect(l.productUrl).toMatch(/^https:\/\//);
    }
  });
});

// ─── Bug 1 + Bug 4: engine DB supplement is relevance-gated and appended ────

describe("Bug 1 + Bug 4: engine DB supplement", () => {
  // Each test must use a distinct query because fairSearchCache persists
  // across the shared vitest fork (isolate:false, singleFork:true).

  function liveListing(
    id: SearchProviderId,
    externalId: string,
    title: string,
    price: number,
  ): RawProviderListing {
    return {
      providerId: id,
      externalId,
      title,
      imageUrl: `https://img.example/${id}-${externalId}.jpg`,
      price,
      originalPrice: Math.round(price * 1.2),
      discount: 16,
      currency: "USD",
      storeName: id.charAt(0).toUpperCase() + id.slice(1),
      category: "Smartphones",
      rating: 4.6,
      reviewCount: 40,
      inStock: true,
      productUrl: `https://merchant.example/${id}-${externalId}`,
      affiliateUrl: `https://affiliate.example/${id}-${externalId}`,
      countryCode: "US",
    };
  }

  function fakeAdapter(
    id: SearchProviderId,
    listing: RawProviderListing,
  ): ProviderAdapter {
    return {
      id,
      name: id,
      async isAvailable() {
        return true;
      },
      normalize() {
        return listing;
      },
      normalizeBatch() {
        return [listing];
      },
      async search() {
        return { providerId: id, listings: [listing], durationMs: 8 };
      },
    };
  }

  function dbItem(
    id: string,
    name: string,
    storeSlug: string,
    over: Partial<SearchResultItem> = {},
  ): SearchResultItem {
    const base: SearchResultItem = {
      id: `db-${id}`,
      name,
      imageSrc: `https://img.example/db-${id}.jpg`,
      emoji: "🛍️",
      price: 649,
      originalPrice: 899,
      discount: 28,
      store: "Admitad Merchant",
      storeSlug,
      rating: 0,
      reviewCount: 0,
      inStock: true,
      category: "smartphones",
      currency: "USD",
      countryCode: "US",
      affiliateUrl: `https://go.admitad.com/click/${id}`,
    };
    return { ...base, ...over };
  }

  const AL = liveListing(
    "aliexpress",
    "al-ip15pm",
    "Apple iPhone 15 Pro Max 256GB ZR1 Unlocked Smartphone GSM",
    899.99,
  );
  const EBAY = liveListing(
    "ebay",
    "ebay-ip15pm",
    "Apple iPhone 15 Pro Max 512GB ZR1 Unlocked (Renewed)",
    1049.99,
  );

  const DB_RELEVANT = dbItem(
    "ippm-128",
    "Apple iPhone 15 Pro Max 128GB ZR1 Unlocked GSM Smartphone",
    "aliexpress",
  );

  beforeEach(() => {
    vi.spyOn(providerConfig, "getActiveProductionProviders").mockResolvedValue([
      "aliexpress",
      "ebay",
    ]);
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([
      fakeAdapter("aliexpress", AL),
      fakeAdapter("ebay", EBAY),
    ]);
  });

  it("drops junk DB rows regardless of discount (relevance gate, not provider filter)", async () => {
    const junk = [
      dbItem("mask", "Facial Lifting Firming Mask 15 Pcs", "aliexpress", {
        discount: 90,
      }),
      dbItem("fountain", "Cat Water Fountain Filter 15-Count", "aliexpress", {
        discount: 92,
      }),
      dbItem("flag", "Flag Rope 15 Meter Outdoor Hanging Banner", "ebay", {
        discount: 95,
      }),
      dbItem("ruler", "Bookbinding Ruler Kit 15-Count Steel", "ebay", {
        discount: 99,
      }),
    ];
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([
      ...junk,
      DB_RELEVANT,
    ]);

    const items = await searchProducts("iphone 15 pro max zr1", 20);

    const junkNames = new Set(junk.map((j) => j.name));
    for (const item of items) {
      expect(junkNames.has(item.name)).toBe(false);
    }
    const relevant = items.find((i) => i.name === DB_RELEVANT.name);
    expect(relevant).toBeTruthy();
  });

  it("drops DB repair rows (back glass / battery parts)", async () => {
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([
      dbItem(
        "glass",
        "Apple iPhone 15 Pro Max ZR1 rear back glass housing chasis",
        "aliexpress",
      ),
      dbItem(
        "batt",
        "Apple iPhone 15 Pro Max ZR1 Battery New OEM Genuine 100% Capacity",
        "ebay",
      ),
      DB_RELEVANT,
    ]);

    const items = await searchProducts("iphone 15 pro max zr2", 20);
    const names = new Set(items.map((i) => i.name));

    expect(names.has("Apple iPhone 15 Pro Max ZR1 rear back glass housing chasis")).toBe(false);
    expect(names.has("Apple iPhone 15 Pro Max ZR1 Battery New OEM Genuine 100% Capacity")).toBe(
      false,
    );
    expect(names.has(DB_RELEVANT.name)).toBe(true);
  });

  it("appends relevant DB rows AFTER the live block (no one-per-card interleave)", async () => {
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([
      DB_RELEVANT,
    ]);

    const items = await searchProducts("iphone 15 pro max zr3", 20);

    // Both live cards lead the page contiguously.
    const firstTwo = items.slice(0, 2).map((i) => i.id).sort();
    expect(firstTwo).toEqual(
      [
        `aliexpress-${AL.externalId}`,
        `ebay-${EBAY.externalId}`,
      ].sort(),
    );
    // The single relevant DB row is appended after the live block.
    expect(items[2]?.name).toBe(DB_RELEVANT.name);
    expect(items).toHaveLength(3);
  });

  it("relevance-orders + appends multiple DB rows after live; junk stays out", async () => {
    const dbSecond = dbItem("ippm-512p", "Apple iPhone 15 Pro 512GB ZR1 factory unlocked", "ebay");
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([
      dbItem("mask", "Facial Lifting Firming Mask 15 Pcs", "aliexpress", {
        discount: 90,
      }),
      DB_RELEVANT,
      dbSecond,
    ]);

    const items = await searchProducts("iphone 15 pro max zr4", 20);

    const names = items.map((i) => i.name);
    expect(names.filter((n) => n.includes("Facial Lifting"))).toHaveLength(0);
    // live block (2) is contiguous first; both relevant DB rows follow after.
    const dbIdx = [DB_RELEVANT.name, dbSecond.name].map((n) => names.indexOf(n));
    expect(dbIdx.every((i) => i >= 2)).toBe(true);
    expect(dbIdx.filter((i) => i >= 0)).toHaveLength(2);
  });
});