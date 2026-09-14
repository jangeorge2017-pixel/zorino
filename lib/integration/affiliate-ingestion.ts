/**
 * Generic affiliate URL ingestion engine (Phase 5).
 *
 * For each DECLARATIVE ingestion source (a provider + a list of affiliate
 * URLs), the engine:
 *   1. Resolves redirects to get the final destination URL.
 *   2. Detects product identifiers in the resolved URL (GENERIC — no
 *      provider-specific detection forks).
 *   3. Looks up an EXTRACTION STRATEGY by the detected product FORMAT
 *      (e.g. "asin"), never by provider id, and attempts extraction.
 *   4. Returns NormalizedCatalogItems for real products.
 *   5. Logs destination-only URLs (store homepages, landing pages).
 *
 * No provider-specific special cases exist in the engine. The DETECTION
 * patterns are product-format patterns; EXTRACTION strategies are registered
 * against product formats and may internally know one format's API (e.g. the
 * "asin" strategy talks to the Amazon Creators API because ASIN is an Amazon
 * identifier — but the engine routes to it purely by detected format).
 *
 * Adding a new provider = adding a declarative source entry (+ registering a
 * product-format extraction strategy when its URLs resolve to a format we can
 * extract). No changes to Home, Deals, Search, or any consumer page are needed.
 */

import { unstable_cache } from "next/cache";
import type { NormalizedCatalogItem, ProviderOffer } from "@/lib/integration/catalog-types";
import { normalizeProductImageUrl } from "@/lib/images/product-image";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductDetection =
  | { found: false; reason: string }
  | { found: true; productId: string; productType: string };

/**
 * A declarative ingestion source. `providerId` is the acquisition layer the
 * URLs belong to; the engine treats every source identically.
 */
export type ProviderIngestionSource = {
  /** Provider registry id (acquisition layer) the URLs belong to. */
  providerId: string;
  /** Human-readable provider name */
  name: string;
  /** URL-safe slug used for routing and marketplace balance */
  slug: string;
  /** List of affiliate URLs to process */
  urls: { id: string; affiliateUrl: string }[];
};

/**
 * A product-format extraction strategy. Registered against the product TYPE
 * detected in a resolved URL (e.g. "asin"), NOT against a provider id.
 */
export type IngestionExtractor = (
  detection: Extract<ProductDetection, { found: true }>,
  affiliateUrl: string,
  resolvedUrl: string,
) => Promise<NormalizedCatalogItem | null>;

// ---------------------------------------------------------------------------
// Extraction strategy registry (keyed by product format)
// ---------------------------------------------------------------------------

const extractionStrategies = new Map<string, IngestionExtractor>();

/** Modeled after the extractor registry: tracks whether built-ins are seeded. */
let builtInExtractorsRegistered = false;

/** Register an extractor for a detected product format (e.g. "asin"). */
export function registerExtractionStrategy(
  productType: string,
  extractor: IngestionExtractor,
): void {
  extractionStrategies.set(productType, extractor);
}

/** Look up an extractor by the detected product format. */
export function getExtractionStrategy(
  productType: string,
): IngestionExtractor | undefined {
  return extractionStrategies.get(productType);
}

/** Reset the registry (tests / hot reload) so built-ins register again. */
export function resetExtractionStrategiesForTests(): void {
  extractionStrategies.clear();
  builtInExtractorsRegistered = false;
}

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

const RESOLVE_TIMEOUT_MS = 5_000;

/**
 * Follow HTTP redirects and return the final destination URL.
 * Returns the original URL if resolution fails.
 */
export async function resolveRedirect(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "ZorinoBot/1.0 (+https://www.zorino.org)" },
    });
    clearTimeout(timer);
    return res.url || url;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Generic product detection (product-format patterns, no provider forks)
// ---------------------------------------------------------------------------

const PRODUCT_URL_PATTERNS: Array<{ regex: RegExp; type: string }> = [
  // Amazon ASIN patterns
  { regex: /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i, type: "asin" },
  // eBay item patterns
  { regex: /\/itm\/(\d+)(?:[/?]|$)/i, type: "ebay-item" },
  // Generic /product/ or /products/ with slug/ID
  { regex: /\/products?\/([a-z0-9_-]+)(?:[/?]|$)/i, type: "product-slug" },
  // Numeric product pages ending with .html
  { regex: /\/(\d{5,})\.html(?:[/?]|$)/i, type: "numeric-product" },
  // /item/ or /p/ with ID
  { regex: /\/(?:item|p)\/(\d{5,})(?:[/?]|$)/i, type: "item-id" },
];

/**
 * Detect product identifiers in a URL.
 * Checks the path and query string against known product-format patterns.
 */
export function detectProductFromUrl(url: string): ProductDetection {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const full = path + parsed.search;

    for (const { regex, type } of PRODUCT_URL_PATTERNS) {
      const match = full.match(regex);
      if (match) {
        return { found: true, productId: match[1], productType: type };
      }
    }

    return { found: false, reason: "No product identifier detected in URL" };
  } catch {
    return { found: false, reason: "Invalid URL" };
  }
}

// ---------------------------------------------------------------------------
// Built-in product-format extraction strategies
// ---------------------------------------------------------------------------

/**
 * Host guard: is this destination an Amazon property?
 * ASIN is an Amazon identifier, so the "asin" strategy must never fire on
 * another network's resolved URL — one network's links can never trigger
 * another network's extractor.
 */
export function isAmazonHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === "amazon.com" || host.endsWith(".amazon.com") || /^amazon\./.test(host);
  } catch {
    return false;
  }
}

/**
 * "asin" product-format strategy — extracts real product data from the Amazon
 * Creators API. Routed by the engine PURELY by detected product format
 * ("asin"), never by provider id; the host guard (`isAmazonHost`) makes sure
 * it cannot accidentally fire on another network's URLs.
 */
export async function extractAmazonAsin(
  detection: Extract<ProductDetection, { found: true }>,
  affiliateUrl: string,
  resolvedUrl: string,
): Promise<NormalizedCatalogItem | null> {
  if (detection.productType !== "asin") return null;
  if (!isAmazonHost(resolvedUrl)) return null;

  try {
    const { createAmazonClientFromEnv } = await import(
      "@/lib/integrations/amazon/client"
    );
    const client = createAmazonClientFromEnv();
    if (!client) return null;

    const results = await client.searchByKeyword(detection.productId, {
      itemCount: 1,
    });
    const item = results[0];
    if (!item) return null;

    return amazonItemToCatalogItem(item, affiliateUrl);
  } catch {
    return null;
  }
}

function amazonItemToCatalogItem(
  item: {
    asin: string;
    title: string;
    imageUrl: string;
    price?: number;
    listPrice?: number;
    rating?: number;
    reviewCount?: number;
    currency?: string;
  },
  affiliateUrl: string,
): NormalizedCatalogItem {
  const price = item.price ?? 0;
  const originalPrice = item.listPrice ?? price;
  const discount =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;
  const slug = item.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60);

  const offer: ProviderOffer = {
    providerId: "amazon",
    storeSlug: "amazon",
    storeName: "Amazon",
    externalId: item.asin,
    price,
    originalPrice,
    currency: item.currency ?? "USD",
    countryCode: "US",
    productUrl: `https://www.amazon.com/dp/${item.asin}`,
    affiliateUrl,
    inStock: true,
  };

  return {
    id: `amazon-${item.asin}`,
    slug,
    title: item.title,
    imageUrl: normalizeProductImageUrl(item.imageUrl),
    emoji: "📦",
    categorySlug: "electronics",
    rating: item.rating ?? 0,
    reviewCount: item.reviewCount ?? 0,
    countryCode: "US",
    currency: item.currency ?? "USD",
    price,
    originalPrice,
    discount,
    discountType: "percentage",
    offers: [offer],
    providerIds: ["amazon"],
    fetchedAt: new Date().toISOString(),
  };
}

function ensureBuiltInExtractors(): void {
  if (builtInExtractorsRegistered) return;
  builtInExtractorsRegistered = true;
  registerExtractionStrategy("asin", extractAmazonAsin);
}

// ---------------------------------------------------------------------------
// All configured ingestion sources (DECLARATIVE — no per-source detection)
// ---------------------------------------------------------------------------

async function buildIngestionSources(): Promise<ProviderIngestionSource[]> {
  const { AMAZON_US_SEED_LINKS } = await import("@/lib/amazon/seed-links");
  const { ADMITAD_STORE_LINKS } = await import("@/lib/affiliate/admitad-registry");

  return [
    {
      providerId: "amazon",
      name: "Amazon",
      slug: "amazon",
      urls: AMAZON_US_SEED_LINKS,
    },
    {
      providerId: "admitad",
      name: "Alibaba",
      slug: "alibaba",
      urls: ADMITAD_STORE_LINKS.map((l) => ({
        id: l.storeSlug,
        affiliateUrl: l.affiliateUrl,
      })),
    },
  ];
}

// ---------------------------------------------------------------------------
// Processing engine (one generic loop for every source)
// ---------------------------------------------------------------------------

export type IngestionEntry = {
  source: string;
  sourceSlug: string;
  affiliateUrl: string;
  resolvedUrl: string;
  detection: ProductDetection;
  catalogItem: NormalizedCatalogItem | null;
};

/**
 * Process ONE declarative ingestion source through the single generic engine
 * loop. Exported for tests / admin diagnostics; production entry points call
 * it via `getIngestedCatalogItems` / `getIngestionReport`.
 */
export async function processSource(
  source: ProviderIngestionSource,
): Promise<IngestionEntry[]> {
  ensureBuiltInExtractors();

  const entries = await Promise.all(
    source.urls.map(async (entry) => {
      const resolvedUrl = entry.affiliateUrl
        ? await resolveRedirect(entry.affiliateUrl)
        : "";
      const detection = detectProductFromUrl(resolvedUrl);
      let catalogItem: NormalizedCatalogItem | null = null;

      if (detection.found) {
        const extractor = getExtractionStrategy(detection.productType);
        if (extractor) {
          catalogItem = await extractor(
            detection,
            entry.affiliateUrl,
            resolvedUrl,
          );
        }
      }

      return {
        source: source.name,
        sourceSlug: source.slug,
        affiliateUrl: entry.affiliateUrl,
        resolvedUrl,
        detection,
        catalogItem,
      };
    }),
  );

  const products = entries.filter((e) => e.catalogItem !== null).length;
  const destOnly = entries.filter((e) => e.catalogItem === null).length;
  if (entries.length > 0) {
    console.log(
      `[ingestion] ${source.name}: ${source.urls.length} URLs → ${products} products, ${destOnly} destination-only`,
    );
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Public API — cached
// ---------------------------------------------------------------------------

const REVALIDATE_SECONDS = 60 * 60; // 1 hour

export const getIngestedCatalogItems = unstable_cache(
  async (): Promise<NormalizedCatalogItem[]> => {
    const sources = await buildIngestionSources();
    const allEntries = await Promise.all(sources.map(processSource));

    return allEntries
      .flat()
      .map((e) => e.catalogItem)
      .filter((item): item is NormalizedCatalogItem => item !== null);
  },
  ["affiliate-ingestion:v1"],
  { revalidate: REVALIDATE_SECONDS, tags: ["affiliate-ingestion"] },
);

/**
 * Get detailed ingestion report for debugging / admin display.
 * Returns every processed entry with its resolution result.
 */
export async function getIngestionReport(): Promise<IngestionEntry[]> {
  const sources = await buildIngestionSources();
  const allEntries = await Promise.all(sources.map(processSource));
  return allEntries.flat();
}