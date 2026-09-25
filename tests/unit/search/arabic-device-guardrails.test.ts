/**
 * Arabic handset/device guardrails (Feature "Arabic device query recognition").
 *
 * Arabic queries ("آيفون 15 برو ماكس", "سامسونج جالكسي S24") used to collapse
 * to digit-only tokens (queryTokens stripped non-ASCII), which left family
 * detection "unknown" → intent kind "category" → the strict device guard never
 * engaged. Accessory-saturated pages therefore leaked onto Arabic handset
 * searches. These tests lock Arabic into the SAME device/intent pipeline as
 * English: Arabic tokens survive tokenization, Arabic family words classify the
 * family, Arabic accessory words fire the query-accessory answer AND the
 * strict title drop, and Arabic genuine devices survive floors.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeSearchQueryIntent,
  detectProductFamily,
} from "@/lib/search/query-intent";
import {
  queryTokens,
  queryWantsAccessory,
  queryPinsDeviceFamily,
  pinsArabicDeviceFamily,
} from "@/lib/search/relevance";
import {
  hasAccessoryTerm,
  hasHandsetAccessoryTerm,
  isHandsetQuery,
  looksLikeGenuineDevice,
  passesStrictDeviceGuard,
} from "@/lib/search/accessory-exclusion";
import { searchProducts, setProviderFetchTimeoutForTests } from "@/lib/search/engine";
import * as adapterRegistry from "@/lib/providers/adapter-registry";
import * as providerConfig from "@/lib/integration/provider-config";
import type { ProviderAdapter } from "@/lib/providers/adapter";
import type { ConnectorSearchOptions } from "@/lib/search/connectors/types";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

const dbCatalog = () => import("@/lib/integration/database-catalog");

/* ------------------------- tokenization ------------------------- */

describe("Arabic device guardrails: tokenization", () => {
  it("keeps Arabic script tokens (was: digits only)", () => {
    expect(queryTokens("آيفون 15 برو ماكس")).toEqual(["آيفون", "15", "برو", "ماكس"]);
  });

  it("keeps English tokenization byte-identical", () => {
    expect(queryTokens("iPhone 15 Pro Max")).toEqual(["iphone", "15", "pro", "max"]);
  });
});

/* --------------------- family + intent classification --------------------- */

describe("Arabic device guardrails: family + intent", () => {
  it("classifies Arabic handset queries as phone family", () => {
    expect(detectProductFamily("آيفون 15 برو ماكس")).toBe("phone");
    expect(detectProductFamily("سامسونج جالكسي S24 الترا")).toBe("phone");
    expect(detectProductFamily("هاتف جوال للبيع")).toBe("phone");
  });

  it("classifies other Arabic families correctly", () => {
    expect(detectProductFamily("تلفزيون سامسونج")).toBe("tv-monitor");
    expect(detectProductFamily("ساعة ذكية شاومي")).toBe("smartwatch");
    expect(detectProductFamily("سماعات بلوتوث لاسلكية")).toBe("audio");
    expect(detectProductFamily("لابتوب ديل")).toBe("laptop");
    expect(detectProductFamily("آيباد برو")).toBe("tablet");
  });

  it("treats Arabic handset queries as DEVICE intent (strict guard engages)", () => {
    const i = analyzeSearchQueryIntent("آيفون 15 برو ماكس");
    expect(i.kind).toBe("device");
    expect(i.family).toBe("phone");
    expect(i.pinsDeviceFamily).toBe(true);

    // A lone "ايفون" behaves like a lone "iphone" → device, not category.
    expect(analyzeSearchQueryIntent("ايفون").kind).toBe("device");
  });

  it("treats a lone Arabic brand as a BRAND search (like 'samsung')", () => {
    expect(analyzeSearchQueryIntent("سامسونج").kind).toBe("brand");
    expect(analyzeSearchQueryIntent("شاومي").kind).toBe("brand");
    // Parity with English "phone": a lone generic noun is a category, not device.
    expect(analyzeSearchQueryIntent("هاتف").kind).toBe("category");
  });

  it("classifies Arabic accessory queries as ACCESSORY intent (guard stays off)", () => {
    expect(analyzeSearchQueryIntent("جراب ايفون").kind).toBe("accessory");
    expect(analyzeSearchQueryIntent("كفر ايفون 15").kind).toBe("accessory");
    expect(analyzeSearchQueryIntent("حماية شاشة زجاج مقوى لتلفون").kind).toBe("accessory");
    expect(queryWantsAccessory("جراب شفاف لايفون 15")).toBe(true);
  });

  it("pins Arabic device families on single-token queries", () => {
    expect(pinsArabicDeviceFamily("ايفون")).toBe(true);
    expect(pinsArabicDeviceFamily("سماعات")).toBe(true);
    expect(pinsArabicDeviceFamily("سامسونج")).toBe(false); // brand, mirrors English
    expect(queryPinsDeviceFamily("ايفون")).toBe(true);
    expect(queryPinsDeviceFamily("آيفون")).toBe(true); // hamza-normalised
  });

  it("detects Arabic handset queries lexically", () => {
    expect(isHandsetQuery("ايفون 15 برو ماكس")).toBe(true);
    expect(isHandsetQuery("سامسونج جالكسي S24")).toBe(true);
    expect(isHandsetQuery("سماعات بلوتوث")).toBe(false); // audio family
  });
});

/* ------------------- accessory-term matching (Arabic) ------------------- */

describe("Arabic device guardrails: accessory term matching", () => {
  it("flags Arabic accessory titles (cases, glass, protection, cables)", () => {
    expect(hasAccessoryTerm("جراب شفاف لايفون 15 برو ماكس")).toBe(true);
    expect(hasAccessoryTerm("حماية شاشة زجاج مقوى لسامسونج")).toBe(true);
    expect(hasAccessoryTerm("شاحن سريع 20 واط")).toBe(true);
    expect(hasAccessoryTerm("كابل USB سي ايفون")).toBe(true);
    expect(hasAccessoryTerm("حامل جوال للسيارة")).toBe(true);
  });

  it("normalises hamza / teh-marbuta / ya and the definite article", () => {
    expect(hasAccessoryTerm("الجراب الشفاف iPhone 15")).toBe(true); // ال prefix
    expect(hasAccessoryTerm("زجاج مقوى - حماية شاشة")).toBe(true); // حماية → حمايه
    expect(hasAccessoryTerm("غلاف سيليكون لآيفون")).toBe(true); // لآيفون stays a phone word, غلاف is the accessory
  });

  it("fires ear/head-phone words ONLY via the handset-only matcher", () => {
    expect(hasAccessoryTerm("سماعات لاسلكية")).toBe(false); // genuine audio product
    expect(hasHandsetAccessoryTerm("سماعات لاسلكية")).toBe(true); // but an accessory to a phone
    expect(hasHandsetAccessoryTerm("سماعة ايفون")).toBe(true);
  });

  it("does not fire on genuine Arabic device wording", () => {
    expect(hasAccessoryTerm("ايفون 15 برو ماكس 256 جيجابايت هاتف ذكي")).toBe(false);
    expect(hasAccessoryTerm("سامسونج جالكسي S24 الترا جديد")).toBe(false);
    expect(hasAccessoryTerm("جهاز لابتوب ديل اكس بي اس")).toBe(false);
  });

  it("keeps English accessory matching intact", () => {
    expect(hasAccessoryTerm("Silicone Case for iPhone 15")).toBe(true);
    expect(hasAccessoryTerm("Apple iPhone 15 Pro 256GB Unlocked")).toBe(false);
  });
});

/* ---------------------- strict device guard (Arabic) ---------------------- */

describe("Arabic device guardrails: strict guard", () => {
  const Q = "ايفون 15 برو ماكس"; // Arabic handset query

  it("passes genuine Arabic handsets above the $150 floor", () => {
    expect(passesStrictDeviceGuard("ايفون 15 برو ماكس 256 جيجا هاتف", 849, Q)).toBe(true);
    expect(passesStrictDeviceGuard("سامسونج جالكسي S24 الترا", 750, Q)).toBe(true);
  });

  it("hard-drops Arabic accessories regardless of price", () => {
    expect(passesStrictDeviceGuard("جراب شفاف لايفون 15 برو ماكس", 499, Q)).toBe(false);
    expect(passesStrictDeviceGuard("زجاج مقوي حماية شاشة", 1200, Q)).toBe(false);
    expect(passesStrictDeviceGuard("سماعات بلوتوث لايفون", 999, Q)).toBe(false);
  });

  it("hard-drops Arabic handsets under the absolute $150 floor", () => {
    expect(passesStrictDeviceGuard("ايفون 15 برو ماكس 128", 99, Q)).toBe(false);
    expect(passesStrictDeviceGuard("ايفون 15 هاتف", 8, Q)).toBe(false);
  });

  it("keeps genuine Arabic sub-$100 audio devices on non-handset queries", () => {
    expect(passesStrictDeviceGuard("سماعات بلوتوث جودة عالية", 55, "سماعات بلوتوث")).toBe(true);
    expect(looksLikeGenuineDevice("سماعات بلوتوث جودة عالية")).toBe(true);
  });

  it("drops Arabic accessories even on non-handset queries", () => {
    expect(passesStrictDeviceGuard("جراب سماعات", 55, "سماعات بلوتوث")).toBe(false);
  });

  it("keeps English guard behaviour untouched", () => {
    expect(passesStrictDeviceGuard("Apple iPhone 15 Pro 256GB", 849, "iphone 15 pro max")).toBe(true);
    expect(passesStrictDeviceGuard("Silicone Case for iPhone 15", 599, "iphone 15 pro max")).toBe(false);
  });
});

/* ---------------------- engine end-to-end (Arabic) ---------------------- */

function rawListing(overrides: Partial<RawProviderListing>): RawProviderListing {
  return {
    providerId: "aliexpress",
    externalId: "x",
    title: "listing",
    imageUrl: "https://x.example.com/img.jpg",
    price: 499,
    originalPrice: 120,
    discount: 0,
    currency: "USD",
    storeName: "Test Store",
    category: "Electronics",
    rating: 0,
    reviewCount: 0,
    salesCount: 0,
    inStock: true,
    productUrl: "https://x.example.com/p",
    affiliateUrl: "https://x.example.com/p?aff=1",
    ...overrides,
  };
}

function dbItem(overrides: Partial<SearchResultItem> & { name: string }): SearchResultItem {
  return {
    id: overrides.id ?? `db-${overrides.name}`,
    imageSrc: "https://x.example.com/img.jpg",
    emoji: "📦",
    price: 499,
    originalPrice: 120,
    discount: 0,
    store: "Admitad",
    storeSlug: "admitad",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    category: "General",
    ...overrides,
  };
}

type CapturingAdapter = ProviderAdapter & { captured: ConnectorSearchOptions[] };

function adapter(
  id: SearchProviderId,
  listings: RawProviderListing[],
): CapturingAdapter {
  const captured: ConnectorSearchOptions[] = [];
  const a: CapturingAdapter = {
    id,
    name: id,
    async isAvailable() {
      return true;
    },
    normalize() {
      return null;
    },
    normalizeBatch() {
      return [];
    },
    async search(_query: string, options?: ConnectorSearchOptions) {
      captured.push(options ?? {});
      return { providerId: id, listings, durationMs: 3 };
    },
    captured,
  };
  return a;
}

let uniq = 0;
const arabicDeviceQuery = () => `ايفون 15 برو ماكس حقيقي${Date.now()}-${uniq++}`;

beforeEach(() => {
  vi.spyOn(providerConfig, "getActiveProductionProviders").mockResolvedValue([
    "ebay",
    "aliexpress",
    "admitad",
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  setProviderFetchTimeoutForTests();
});

describe("Arabic device query — live-engine assembly", () => {
  it("drops Arabic accessories and sub-$150 handsets; genuine Arabic devices lead", async () => {
    const q = arabicDeviceQuery();
    const ebay = adapter("ebay", [
      rawListing({ providerId: "ebay", externalId: "eb-1", title: `ايفون 15 برو ماكس 256 جيجا هاتف ذكي ${q}`, price: 849 }),
      rawListing({ providerId: "ebay", externalId: "eb-2", title: `ايفون 15 برو ماكس 128 جيجا ${q}`, price: 99 }),
    ]);
    const ali = adapter("aliexpress", [
      rawListing({ providerId: "aliexpress", externalId: "al-1", title: `جراب شفاف لايفون 15 برو ماكس ${q}`, price: 12 }),
      rawListing({ providerId: "aliexpress", externalId: "al-2", title: `سماعات بلوتوث لايفون 15 برو ماكس ${q}`, price: 40 }),
      rawListing({ providerId: "aliexpress", externalId: "al-3", title: `سامسونج جالكسي S25 الترا هاتف جديد ${q}`, price: 750 }),
    ]);
    vi.spyOn(adapterRegistry, "getActiveProviderAdapters").mockResolvedValue([ebay, ali]);
    vi.spyOn(await dbCatalog(), "getSearchResultsFromDatabase").mockResolvedValue([
      dbItem({ id: "db-ar-device", name: `سامسونج جالكسي S24 الترا هاتف ذكي ${q}` }),
      dbItem({ id: "db-ar-case", name: `زجاج مقوي حماية شاشة ايفون ${q}` }),
    ]);

    const items = await searchProducts(q, 50, { optimizeForDeviceIntent: true });

    // Only the genuine Arabic handsets survive: the live case/earphone plus
    // the imported glass are hard-dropped, and the $99 handset hits the
    // absolute $150 floor.
    expect(items.length).toBe(3);
    expect(items.some((i) => /جراب|حمايه|زجاج|سماعه|سماعات/i.test(i.name))).toBe(false);
    for (const item of items) {
      expect(item.price).toBeGreaterThanOrEqual(150);
    }
    expect(items.some((i) => i.id === "db-ar-device")).toBe(true);
  });
});