import { fetchStorefrontHtml } from "@/lib/sync/scraper/browser";
import { extractScrapedListings } from "@/lib/sync/scraper/extract";
import { SCRAPER_SEED_QUERIES, SCRAPER_STORES } from "@/lib/sync/scraper/stores";
import { mapProviderCategory } from "@/lib/sync/providers/shared/category-map";
import {
  finalizeExternalProduct,
  slugifyTitle,
} from "@/lib/sync/providers/shared/product-utils";
import type { ScraperStoreConfig, ScrapedListing } from "@/lib/sync/scraper/types";
import { QUERY_TIMEOUT_MS, withTimeout } from "@/lib/sync/timeout";
import type { ExternalProduct, SyncContext } from "@/lib/sync/types";

export { SCRAPER_SEED_QUERIES };

function positiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function toExternalProduct(
  ctx: SyncContext,
  config: ScraperStoreConfig,
  listing: ScrapedListing,
): ExternalProduct {
  return finalizeExternalProduct(ctx, {
    externalId: `${config.id}-${listing.externalId}`,
    title: listing.title,
    slug: slugifyTitle(listing.title),
    categorySlug: mapProviderCategory(listing.category, listing.title),
    imageUrl: listing.imageUrl,
    imageUrls: [listing.imageUrl],
    price: listing.price,
    originalPrice: listing.originalPrice,
    currency: listing.currency || ctx.currency,
    countryCode: ctx.countryCode,
    rating: listing.rating,
    reviewCount: listing.reviewCount,
    inStock: listing.inStock,
    productUrl: listing.productUrl,
  });
}

export async function fetchFallbackProducts(
  providerId: string,
  ctx: SyncContext,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<ExternalProduct[]> {
  if (process.env.SYNC_SCRAPER_ENABLED === "0") return [];

  const config = SCRAPER_STORES[providerId];
  if (!config) return [];

  const queries = (
    ctx.jobConfig?.keywords?.length ? ctx.jobConfig.keywords : config.seeds
  ).slice(0, positiveInt("SYNC_SCRAPER_QUERIES", SCRAPER_SEED_QUERIES.length));
  const pages = positiveInt("SYNC_SCRAPER_PAGES", 3);
  const maxProducts = positiveInt("SYNC_SCRAPER_MAX_PRODUCTS", 3000);
  const products: ExternalProduct[] = [];
  const seen = new Set<string>();
  const timeoutMs = Math.max(1, Math.floor(options?.timeoutMs ?? QUERY_TIMEOUT_MS));
  let consecutiveFailures = 0;

  queryLoop: for (const query of queries) {
    if (options?.signal?.aborted) break;
    for (let page = 1; page <= pages; page += 1) {
      if (products.length >= maxProducts || options?.signal?.aborted) break queryLoop;

      const fetched = await withTimeout(
        `scraper ${providerId} "${query}" page ${page}`,
        fetchStorefrontHtml(config.searchUrl(query, page), config),
        timeoutMs,
      );
      if (!fetched.ok) {
        consecutiveFailures += 1;
        console.warn(
          `[scraper-fallback] ${providerId} "${query}" page ${page}: ${fetched.error}`,
        );
        if (consecutiveFailures >= 3) break queryLoop;
        continue;
      }

      try {
        const listings = extractScrapedListings(fetched.value.html, config);
        if (listings.length === 0) {
          throw new Error(
            `zero-listings status=${fetched.value.status} title="${fetched.value.title}" url=${fetched.value.finalUrl}`,
          );
        }
        for (const listing of listings) {
          const product = toExternalProduct(ctx, config, listing);
          if (seen.has(product.externalId)) continue;
          seen.add(product.externalId);
          products.push(product);
          if (products.length >= maxProducts) break queryLoop;
        }
        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[scraper-fallback] ${providerId} "${query}" page ${page}: ${message.slice(0, 200)}`,
        );
        if (consecutiveFailures >= 3) break queryLoop;
      }
    }
  }

  console.log(`[scraper-fallback] ${providerId}: ${products.length} products`);
  return products;
}
