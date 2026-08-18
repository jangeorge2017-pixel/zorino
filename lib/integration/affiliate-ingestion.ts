/**
 * Generic affiliate URL ingestion pipeline.
 *
 * For each configured provider, processes a list of affiliate URLs:
 *   1. Resolves redirects to get the final destination URL.
 *   2. Detects product identifiers in the resolved URL.
 *   3. If a product is detected, attempts extraction via the provider's API.
 *   4. Returns NormalizedCatalogItems for real products.
 *   5. Logs destination-only URLs (store homepages, landing pages).
 *
 * Adding a new provider = adding a ProviderIngestionSource entry below.
 * No changes to Home, Deals, Search, or any consumer page are needed.
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

export type ProviderIngestionSource = {
  /** Human-readable provider name */
  name: string;
  /** URL-safe slug used for routing and marketplace balance */
  slug: string;
  /** List of affiliate URLs to process */
  urls: { id: string; affiliateUrl: string }[];
  /**
   * Given a resolved destination URL, detect whether it identifies
   * a specific product and extract an identifier if so.
   */
  detectProduct: (resolvedUrl: string) => ProductDetection;
  /**
   * Given a detected product identifier, attempt to fetch real product
   * data from the provider's API. Return null if extraction fails.
   */
  extractProduct?: (
    detection: Extract<ProductDetection, { found: true }>,
    affiliateUrl: string,
  ) => Promise<NormalizedCatalogItem | null>;
};

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
// Generic product detection patterns
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
 * Checks the path and query string against known patterns.
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
// Amazon provider — processes amazon.com seed links
// ---------------------------------------------------------------------------

function detectAmazonProduct(resolvedUrl: string): ProductDetection {
  return detectProductFromUrl(resolvedUrl);
}

async function extractAmazonProduct(
  detection: Extract<ProductDetection, { found: true }>,
  affiliateUrl: string,
): Promise<NormalizedCatalogItem | null> {
  if (detection.productType !== "asin") return null;

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

// ---------------------------------------------------------------------------
// Admitad provider — processes admitad tracking links
// ---------------------------------------------------------------------------

function detectAdmitadProduct(resolvedUrl: string): ProductDetection {
  return detectProductFromUrl(resolvedUrl);
}

async function extractAdmitadProduct(
  detection: Extract<ProductDetection, { found: true }>,
  _affiliateUrl: string,
): Promise<NormalizedCatalogItem | null> {
  // Admitad links redirect to third-party stores.
  // Without a provider-specific API for each destination store,
  // we cannot reliably extract product data.
  // When Admitad provides a product-feed API in the future,
  // implement extraction here.
  void detection;
  return null;
}

// ---------------------------------------------------------------------------
// All configured ingestion sources
// ---------------------------------------------------------------------------

async function buildIngestionSources(): Promise<ProviderIngestionSource[]> {
  const { AMAZON_US_SEED_LINKS } = await import("@/lib/amazon/seed-links");
  const { ADMITAD_STORE_LINKS } = await import("@/lib/affiliate/admitad-registry");

  return [
    {
      name: "Amazon",
      slug: "amazon",
      urls: AMAZON_US_SEED_LINKS,
      detectProduct: detectAmazonProduct,
      extractProduct: extractAmazonProduct,
    },
    {
      name: "Alibaba",
      slug: "alibaba",
      urls: ADMITAD_STORE_LINKS.map((l) => ({
        id: l.storeSlug,
        affiliateUrl: l.affiliateUrl,
      })),
      detectProduct: detectAdmitadProduct,
      extractProduct: extractAdmitadProduct,
    },
  ];
}

// ---------------------------------------------------------------------------
// Processing engine
// ---------------------------------------------------------------------------

type IngestionEntry = {
  source: string;
  sourceSlug: string;
  affiliateUrl: string;
  resolvedUrl: string;
  detection: ProductDetection;
  catalogItem: NormalizedCatalogItem | null;
};

async function processSource(
  source: ProviderIngestionSource,
): Promise<IngestionEntry[]> {
  const entries = await Promise.all(
    source.urls.map(async (entry) => {
      const resolvedUrl = await resolveRedirect(entry.affiliateUrl);
      const detection = source.detectProduct(resolvedUrl);
      let catalogItem: NormalizedCatalogItem | null = null;

      if (detection.found && source.extractProduct) {
        catalogItem = await source.extractProduct(detection, entry.affiliateUrl);
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
