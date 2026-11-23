import {
  buildProviderSyncContext,
  getSyncStoreMeta,
} from "@/lib/integration/provider-context";
import type { ProductionProviderId } from "@/lib/integration/constants";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import { saveCatalogItemsAs } from "@/lib/integration/catalog-saver";
import {
  isUsableRemoteProductImageUrl,
  normalizeProductImageUrl,
} from "@/lib/images/product-image";
import { getSearchConnector } from "@/lib/search/connectors/registry";
import { getProviderAdapter, isImportProviderId } from "@/lib/sync/providers";
import { slugifyTitle } from "@/lib/sync/providers/shared/product-utils";
import { rawListingToExternalProduct } from "@/lib/sync/providers/shared/storefront-catalog";
import { fetchFallbackProducts } from "@/lib/sync/scraper";
import { QUERY_TIMEOUT_MS, STORE_TIMEOUT_MS, withTimeout } from "@/lib/sync/timeout";
import type { ExternalProduct, SyncContext } from "@/lib/sync/types";

export type ProviderStoreSyncOptions = {
  providerId: ProductionProviderId;
  queries?: string[];
  maxProducts?: number;
  maxPages?: number;
  pageSize?: number;
  countryCode?: string;
  currency?: string;
  abortSignal?: AbortSignal;
};

export type SyncDropReason =
  | "missing-id"
  | "missing-title"
  | "missing-url"
  | "invalid-price"
  | "invalid-product-url"
  | "bad-image"
  | "duplicate";

export type SyncAttemptDiagnostic = {
  source: "adapter" | "connector" | "scraper";
  query?: string;
  status?: number;
  title?: string;
  error?: string;
  rawCount?: number;
  usableCount?: number;
};

export type ProviderStoreSyncResult = {
  listings: number;
  saved: number;
  source: "adapter" | "connector" | "scraper";
  error?: string;
  diagnostics: {
    attempts: SyncAttemptDiagnostic[];
    rawTotal: number;
    usableAfterSanitize: number;
    sanitizeDrops: Record<SyncDropReason, number>;
    fallbackUsed: boolean;
  };
};

const STORE_WEBSITES: Partial<Record<ProductionProviderId, string>> = {
  amazon: "https://www.amazon.com",
  "amazon-eg": "https://www.amazon.eg",
  aliexpress: "https://www.aliexpress.com",
  ebay: "https://www.ebay.com",
  cjdropshipping: "https://cjdropshipping.com",
  admitad: "https://admitad.com",
  walmart: "https://www.walmart.com",
  bestbuy: "https://www.bestbuy.com",
  temu: "https://www.temu.com",
  noon: "https://www.noon.com/egypt-en/",
  jumia: "https://www.jumia.com.eg",
  carrefour: "https://www.carrefouregypt.com",
  btech: "https://btech.com",
  twob: "https://www.2b.com.eg",
  dubaiphone: "https://www.dubaiphone.net",
  raneen: "https://www.raneen.com",
  eldokan: "https://www.eldokan.com",
};

function positiveIntEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function querySyncContext(
  ctx: SyncContext,
  query: string,
  maxPages: number,
  pageSize: number,
): SyncContext {
  return {
    ...ctx,
    jobConfig: {
      ...ctx.jobConfig,
      keywords: [query],
      maxPages,
      pageSize,
    },
  };
}

function emptyDropCounts(): Record<SyncDropReason, number> {
  return {
    "missing-id": 0,
    "missing-title": 0,
    "missing-url": 0,
    "invalid-price": 0,
    "invalid-product-url": 0,
    "bad-image": 0,
    duplicate: 0,
  };
}

function sanitizeProduct(
  product: ExternalProduct,
  drops: Record<SyncDropReason, number>,
): ExternalProduct | null {
  if (!product.externalId) {
    drops["missing-id"] += 1;
    return null;
  }
  if (!product.title) {
    drops["missing-title"] += 1;
    return null;
  }
  if (!product.productUrl) {
    drops["missing-url"] += 1;
    return null;
  }
  if (!Number.isFinite(product.price) || product.price <= 0) {
    drops["invalid-price"] += 1;
    return null;
  }
  if (!/^https?:\/\//i.test(product.productUrl)) {
    drops["invalid-product-url"] += 1;
    return null;
  }

  const imageUrl = normalizeProductImageUrl(product.imageUrl);
  if (!isUsableRemoteProductImageUrl(imageUrl)) {
    drops["bad-image"] += 1;
    return null;
  }

  return {
    ...product,
    imageUrl,
    imageUrls: [imageUrl, ...(product.imageUrls ?? []).filter((url) => url !== product.imageUrl)],
    currency: product.currency || "EGP",
    countryCode: product.countryCode || "EG",
  };
}

function sanitizeAndDedupe(
  products: ExternalProduct[],
  drops: Record<SyncDropReason, number> = emptyDropCounts(),
): ExternalProduct[] {
  const seen = new Set<string>();
  return products
    .map((product) => sanitizeProduct(product, drops))
    .filter((product): product is ExternalProduct => product !== null)
    .filter((product) => {
      if (seen.has(product.externalId)) {
        drops.duplicate += 1;
        return false;
      }
      seen.add(product.externalId);
      return true;
    });
}

function toCatalogItems(
  providerId: ProductionProviderId,
  products: ExternalProduct[],
  maxProducts: number,
): NormalizedCatalogItem[] {
  const meta = getSyncStoreMeta(providerId);
  const seen = new Set<string>();
  const items: NormalizedCatalogItem[] = [];

  for (const product of products) {
    if (items.length >= maxProducts) break;
    const externalId = slugifyTitle(product.externalId) || slugifyTitle(product.title);
    if (!externalId || seen.has(externalId)) continue;
    seen.add(externalId);

    const price = product.price;
    const originalPrice =
      Number.isFinite(product.originalPrice ?? 0) && (product.originalPrice ?? 0) > price
        ? (product.originalPrice as number)
        : price;
    const discount =
      Number.isFinite(product.discount ?? 0) && (product.discount ?? 0) > 0
        ? (product.discount as number)
        : originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;

    items.push({
      id: `${providerId}-${externalId}`,
      slug: `${providerId}-${externalId}`,
      title: product.title,
      imageUrl: product.imageUrl,
      emoji: "",
      categorySlug: product.categorySlug || "general",
      rating: product.rating || 0,
      reviewCount: product.reviewCount || 0,
      countryCode: product.countryCode,
      currency: product.currency,
      price,
      originalPrice,
      discount,
      discountType: product.discountType ?? "percentage",
      offers: [
        {
          providerId,
          storeSlug: meta.storeSlug,
          storeName: meta.name,
          externalId,
          price,
          originalPrice,
          currency: product.currency,
          countryCode: product.countryCode,
          productUrl: product.productUrl,
          affiliateUrl: product.affiliateUrl || product.productUrl,
          inStock: product.inStock !== false,
        },
      ],
      providerIds: [providerId],
      fetchedAt: new Date().toISOString(),
    });
  }

  return items;
}

export async function runProviderSyncStore(
  options: ProviderStoreSyncOptions,
): Promise<ProviderStoreSyncResult> {
  const { providerId } = options;
  const queries = (options.queries ?? []).filter(Boolean);
  const maxProducts = Math.max(options.maxProducts ?? 150, 1);
  const maxPages = Math.max(
    options.maxPages ?? positiveIntEnv("SYNC_SCRAPER_PAGES", 3),
    1,
  );
  const pageSize = Math.max(
    options.pageSize ?? positiveIntEnv("SYNC_SCRAPER_PAGE_SIZE", 24),
    1,
  );
  const ctx = buildProviderSyncContext(providerId, {
    countryCode: options.countryCode ?? "EG",
    currency: options.currency ?? "EGP",
    jobConfig: {
      keywords: queries,
      maxPages,
      pageSize,
    },
  });

  const controller = new AbortController();
  const abortFromParent = (): void => controller.abort();
  options.abortSignal?.addEventListener("abort", abortFromParent, { once: true });
  if (options.abortSignal?.aborted) controller.abort();

  const startedAt = Date.now();
  const storeTimer = setTimeout(() => controller.abort(), STORE_TIMEOUT_MS);
  const queryTimeout = (): number =>
    Math.max(1, Math.min(QUERY_TIMEOUT_MS, STORE_TIMEOUT_MS - (Date.now() - startedAt)));

  let source: ProviderStoreSyncResult["source"] = "adapter";
  let stepError: string | undefined;
  const attempts: SyncAttemptDiagnostic[] = [];
  const sanitizeDrops = emptyDropCounts();
  const seenExternalIds = new Set<string>();
  let rawTotal = 0;
  let usableTotal = 0;
  let savedTotal = 0;
  let savedItems = 0;
  let fallbackUsed = false;

  const meta = getSyncStoreMeta(providerId);
  const saveOptions = {
    providerId,
    store: {
      slug: meta.storeSlug,
      name: meta.name,
      website: STORE_WEBSITES[providerId] ?? "https://www.zorino.com",
      integrationType: meta.integrationType,
      supportedRegions: [ctx.countryCode],
      supportedCurrencies: [ctx.currency],
    },
  };

  const saveBatch = async (
    products: ExternalProduct[],
  ): Promise<{ usable: number; saved: number }> => {
    if (products.length === 0 || controller.signal.aborted) return { usable: 0, saved: 0 };
    rawTotal += products.length;

    const fresh = products.filter((product) => {
      if (!product.externalId || seenExternalIds.has(product.externalId)) return false;
      seenExternalIds.add(product.externalId);
      return true;
    });
    const usable = sanitizeAndDedupe(fresh, sanitizeDrops);
    usableTotal += usable.length;
    if (usable.length === 0 || savedItems >= maxProducts) {
      return { usable: usable.length, saved: 0 };
    }

    const items = toCatalogItems(providerId, usable, maxProducts - savedItems);
    if (items.length === 0) return { usable: usable.length, saved: 0 };

    try {
      const saved = await saveCatalogItemsAs(items, saveOptions);
      savedItems += items.length;
      savedTotal += saved;
      return { usable: usable.length, saved };
    } catch (error) {
      stepError = error instanceof Error ? error.message.slice(0, 200) : "catalog-save-failed";
      console.error(`[provider-sync] ${providerId} save failed: ${stepError}`);
      return { usable: usable.length, saved: 0 };
    }
  };

  const buildResult = (timeoutError?: string): ProviderStoreSyncResult => ({
    listings: rawTotal,
    saved: savedTotal,
    source,
    error:
      timeoutError ??
      stepError ??
      (usableTotal === 0 ? "no-usable-listings" : undefined),
    diagnostics: {
      attempts: [...attempts],
      rawTotal,
      usableAfterSanitize: usableTotal,
      sanitizeDrops: { ...sanitizeDrops },
      fallbackUsed,
    },
  });

  const runStore = async (): Promise<ProviderStoreSyncResult> => {
    if (isImportProviderId(providerId)) {
      const adapter = getProviderAdapter(providerId);
      if (!adapter.isConfigured()) {
        stepError = "adapter-not-configured";
        attempts.push({ source: "adapter", error: stepError, rawCount: 0 });
      } else {
        for (const query of queries) {
          if (controller.signal.aborted) break;
          const fetched = await withTimeout(
            `adapter ${providerId} "${query}"`,
            adapter.fetchProducts(querySyncContext(ctx, query, maxPages, pageSize)),
            queryTimeout(),
          );
          if (!fetched.ok) {
            attempts.push({ source: "adapter", query, error: fetched.error, rawCount: 0 });
            continue;
          }
          const batch = await saveBatch(fetched.value);
          attempts.push({
            source: "adapter",
            query,
            rawCount: fetched.value.length,
            usableCount: batch.usable,
          });
        }
      }
    } else {
      source = "connector";
      const connector = getSearchConnector(providerId);
      if (!connector) {
        stepError = "connector-not-found";
        attempts.push({ source: "connector", error: stepError, rawCount: 0 });
      } else if (!(await connector.isAvailable())) {
        stepError = "connector-unavailable";
        attempts.push({ source: "connector", error: stepError, rawCount: 0 });
      } else {
        for (const query of queries) {
          if (controller.signal.aborted) break;
          const fetched = await withTimeout(
            `connector ${providerId} "${query}"`,
            connector.search(query, {
              pageSize,
              maxPages,
              countryCode: ctx.countryCode,
              currency: ctx.currency,
            }),
            queryTimeout(),
          );
          if (!fetched.ok) {
            attempts.push({ source: "connector", query, error: fetched.error, rawCount: 0 });
            continue;
          }
          const products = fetched.value
            .map((listing) => rawListingToExternalProduct(providerId, listing, ctx))
            .filter((product): product is ExternalProduct => product !== null);
          const batch = await saveBatch(products);
          attempts.push({
            source: "connector",
            query,
            rawCount: fetched.value.length,
            usableCount: batch.usable,
          });
        }
      }
    }

    if (usableTotal === 0 && !controller.signal.aborted) {
      try {
        const fallback = await fetchFallbackProducts(providerId, ctx, {
          signal: controller.signal,
          timeoutMs: queryTimeout(),
        });
        const batch = await saveBatch(fallback);
        attempts.push({
          source: "scraper",
          rawCount: fallback.length,
          usableCount: batch.usable,
          error: batch.usable === 0 ? "no-usable-listings" : undefined,
        });
        if (batch.usable > 0) {
          source = "scraper";
          stepError = undefined;
          fallbackUsed = true;
        }
      } catch (error) {
        stepError = error instanceof Error ? error.message.slice(0, 200) : "scraper-failed";
        attempts.push({ source: "scraper", error: stepError, rawCount: 0 });
      }
    }

    return buildResult(controller.signal.aborted ? "store-timeout" : undefined);
  };

  try {
    const outcome = await withTimeout(`store ${providerId}`, runStore(), STORE_TIMEOUT_MS);
    return outcome.ok ? outcome.value : buildResult(outcome.error);
  } finally {
    clearTimeout(storeTimer);
    options.abortSignal?.removeEventListener("abort", abortFromParent);
  }
}
