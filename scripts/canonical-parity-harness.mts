/**
 * Phase 4 — canonical old-vs-new parity harness runner.
 *
 * Run via:  npx tsx scripts/canonical-parity-harness.mts
 *   (uses the `tsx` loader so the `@/` alias resolves; plain `node` will not work)
 *
 * Fixture mode (default, hermetic): replays deterministic captured listings
 * through BOTH the legacy assembly and the canonical pipeline and compares the
 * published bytes per surface. Live mode (CANONICAL_PARITY_LIVE=1) additionally
 * compares the two runtime paths over real connectors — requires provider
 * credentials and a network; inspect before running.
 *
 * Prints a short summary and writes `scripts/.parity-report.json`.
 */

import {
  runSearchFixtureParity,
  runCompareFixtureParity,
  runCatalogFixtureParity,
  runPdpFixtureParity,
  type SurfaceParityReport,
} from "@/lib/canonical/consumption/parity-harness";
import type { NormalizedSearchListing } from "@/lib/search/types";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { CompareOffer } from "@/services/compare";
import type { ProductDetail } from "@/lib/data/product-detail";

const QUERIES = [
  "wireless earbuds",
  "laptop",
  "smart watch",
  "gaming mouse",
  "robot vacuum",
  "bluetooth speaker",
  "mechanical keyboard",
  "phone stand",
];

const IMAGES: Record<string, string> = {
  aliexpress: "https://img.alicdn.com/imgextra/fixture-parity-aliexpress.jpg",
  ebay: "https://i.ebayimg.com/images/g/fixture-parity-ebay.jpg",
  cjdropshipping: "https://cdn.cjdropshipping.com/fixture-parity-cj.jpg",
  admitad: "https://static.admitad.com/fixture-parity-admitad.jpg",
};

function listing(q: string, provider: string, n: number, invalid: boolean): NormalizedSearchListing | null {
  if (invalid) {
    // Canonical violation that still passes relevance: missing external id.
    return {
      id: `${provider}-fixture-bad-${n}`,
      providerId: provider,
      externalId: "",
      title: `${q} Special Edition ${n}`,
      price: 9.99,
      originalPrice: 19.99,
      discount: 50,
      currency: "USD",
      imageUrl: IMAGES[provider],
      productUrl: "https://fixture.example.com/bad",
      affiliateUrl: "https://fixture.example.com/bad/go",
      rating: 4.2,
      reviewCount: 10,
      inStock: true,
      storeName: provider,
      storeSlug: provider,
      countryCode: "US",
      category: "Electronics",
      matchTier: "model" as const,
      relevanceScore: 900,
      isDevice: true,
    };
  }
  if (n === 1) {
    return {
      id: `${provider}-fixture-${n}`,
      providerId: provider,
      externalId: `fixture-${provider}-${n}`,
      title: `${q} Deluxe`,
      price: 49.99,
      originalPrice: 79.99,
      discount: 37,
      currency: "USD",
      imageUrl: IMAGES[provider],
      productUrl: `https://fixture.example.com/${provider}/${n}`,
      affiliateUrl: `https://fixture.example.com/${provider}/${n}/go`,
      rating: 4.7,
      reviewCount: 640,
      inStock: true,
      storeName: provider,
      storeSlug: provider,
      countryCode: "US",
      category: "Electronics",
      matchTier: "model" as const,
      relevanceScore: 900,
      isDevice: true,
    };
  }
  return {
    id: `${provider}-fixture-${n}`,
    providerId: provider,
    externalId: `fixture-${provider}-${n}`,
    title: `${q} Lite ${n}`,
    price: 29.99,
    originalPrice: 49.99,
    discount: 40,
    currency: "USD",
    imageUrl: IMAGES[provider],
    productUrl: `https://fixture.example.com/${provider}/${n}`,
    affiliateUrl: `https://fixture.example.com/${provider}/${n}/go`,
    rating: 4.4,
    reviewCount: 210,
    inStock: true,
    storeName: provider,
    storeSlug: provider,
    countryCode: "US",
    category: "Electronics",
matchTier: "model" as const,
relevanceScore: 900,
isDevice: true,
    };
  }

const PROVIDERS = ["aliexpress", "ebay", "cjdropshipping", "admitad"];

function fixturePool(query: string): NormalizedSearchListing[] {
  const pool: NormalizedSearchListing[] = [];
  for (const provider of PROVIDERS) {
    pool.push(listing(query, provider, 1, false)!);
    pool.push(listing(query, provider, 2, false)!);
  }
  // Two canonical violations per query (missing external id → G1).
  pool.push(listing(query, "aliexpress", 99, true)!);
  pool.push(listing(query, "ebay", 98, true)!);
  return pool;
}

function catalogFixtures(): NormalizedCatalogItem[] {
  const mk = (id: string, offers: NormalizedCatalogItem["offers"]): NormalizedCatalogItem => {
    const price = offers[0]?.price ?? 0;
    const originalPrice = offers[0]?.originalPrice ?? 0;
    const discount =
      originalPrice > price && price > 0
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0;
    return {
      id,
      slug: `${id}-slug`,
      title: `Fixture Catalog ${id}`,
      imageUrl: IMAGES.aliexpress,
      emoji: "📦",
      categorySlug: "electronics",
      price,
      originalPrice,
      discount,
      discountType: "percentage",
      currency: "USD",
      countryCode: "US",
      rating: 4.3,
      reviewCount: 88,
      providerIds: ["aliexpress"],
      offers,
      fetchedAt: "2026-01-01T00:00:00.000Z",
    };
  };
  const baseOffer: NormalizedCatalogItem["offers"][number] = {
    providerId: "aliexpress",
    storeSlug: "aliexpress",
    storeName: "AliExpress",
    externalId: "cat-ext-1",
    price: 34.5,
    originalPrice: 55,
    currency: "USD",
    countryCode: "US",
    productUrl: "https://fixture.example.com/cat/1",
    inStock: true,
  };
  const zeroOffer: NormalizedCatalogItem["offers"][number] = {
    ...baseOffer,
    externalId: "cat-ext-zero",
    price: 0,
    productUrl: "https://fixture.example.com/cat/zero",
  };
  return [
    mk("cat-1", [baseOffer]),
    mk("cat-2", [baseOffer, zeroOffer]),
  ];
}

function pdpFixture(): ProductDetail {
  const make = (id: string, price: number, url: string): CompareOffer => ({
    id,
    productId: "product-pdp",
    storeId: "aliexpress",
    price,
    originalPrice: 60,
    currency: "USD",
    discountPercent: price > 0 ? Math.round(((60 - price) / 60) * 100) : 0,
    externalProductId: `ext-${id}`,
    externalUrl: url,
    store: {
      id: "aliexpress",
      name: "AliExpress",
      slug: "aliexpress",
      website: "https://www.aliexpress.com",
      integrationType: "aliexpress",
      commissionRate: 5,
      supportedRegions: ["US"],
      supportedCurrencies: ["USD"],
      isActive: true,
    },
    inStock: true,
    isCurrent: true,
    recordedAt: "2026-01-01T00:00:00.000Z",
  });
  return {
    product: { id: "product-pdp", name: "Fixture PDP Product", slug: "fixture-pdp", imageUrl: IMAGES.aliexpress, reviewCount: 3, currency: "USD", inStock: true, tags: [], isActive: true },
    comparison: {
      product: { id: "product-pdp", name: "Fixture PDP Product", slug: "fixture-pdp", imageUrl: IMAGES.aliexpress, reviewCount: 3, currency: "USD", inStock: true, tags: [], isActive: true },
      offers: [make("o1", 40, "https://fixture.example.com/o1"), make("o2", 0, "https://fixture.example.com/o2")],
      lowestPrice: 40,
      highestPrice: 60,
      highestDiscount: 33,
      savingsVsHighest: 20,
      savingsPercent: 33,
      providerCount: 1,
      cheapestStoreName: "AliExpress",
      highestDiscountStoreName: "AliExpress",
    },
    categoryName: "Electronics",
  } as unknown as ProductDetail;
}

async function main(): Promise<void> {
  const reports: SurfaceParityReport[] = [];

  for (const query of QUERIES) {
    reports.push(runSearchFixtureParity(query, fixturePool(query), 50));
  }
  for (const query of QUERIES) {
    reports.push(runCompareFixtureParity(query, fixturePool(query), 50));
  }
  reports.push(runCatalogFixtureParity(catalogFixtures()));
  reports.push(runPdpFixtureParity(pdpFixture()));

  const live = (process.env.CANONICAL_PARITY_LIVE ?? "").toLowerCase() === "1";
  if (live) {
    const { runSearchLiveParity } = await import("@/lib/canonical/consumption/parity-harness");
    for (const query of QUERIES.slice(0, 3)) {
      reports.push(await runSearchLiveParity(query));
    }
  }

  // eslint-disable-next-line no-console
  console.log("SURFACE | MODE  | VERDICT | ID-MATCH | REJECTIONS | SUMMARY");
  let failures = 0;
  for (const report of reports) {
    const row =
      `${report.surface.padEnd(8)} | ${report.mode.padEnd(5)} | ` +
      `${report.verdict.padEnd(7)} | ${(report.itemMatchRate * 100).toFixed(1).padStart(6)}% | ` +
      `${String(report.canonicalRejections).padStart(9)} | ${report.summary}`;
    // eslint-disable-next-line no-console
    console.log(row);
    if (report.verdict === "fail") failures += 1;
  }

  const out = { generatedAt: new Date().toISOString(), live, reports };
  await import("node:fs/promises").then((fs) =>
    fs.writeFile("scripts/.parity-report.json", JSON.stringify(out, null, 2)),
  );
  // eslint-disable-next-line no-console
  console.log(`\nReport written to scripts/.parity-report.json — verdicts: ${reports.length} runs, ${failures} failure(s).`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("parity harness failed:", error);
  process.exitCode = 1;
});
