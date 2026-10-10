import {
  mergeExternalDealToCatalog,
  mergeExternalImagesToCatalog,
  mergeExternalPriceToCatalog,
  mergeExternalProductToCatalog,
} from "@/lib/sync/import/merger";
import {
  getExternalIdsForStore,
  upsertExternalPrice,
  upsertExternalProduct,
} from "@/lib/sync/import/repository";
import {
  bridgeImportedProductsToLowestPrices,
  type BridgedProduct,
} from "@/lib/sync/import/lowest-prices-bridge";
import { getConnectorForIntegration } from "@/lib/sync/connectors";
import { isImportProviderId } from "@/lib/sync/providers";
import type { ImportProviderId } from "@/lib/sync/providers/types";
import type { ExternalProduct, SyncContext, SyncRunResult } from "@/lib/sync/types";
import type { SupabaseDb } from "@/lib/supabase/config";
import {
  advanceIdsCursor,
  ALIEXPRESS_CHUNK_RESULT_COUNT,
  startIdsCursor,
  startSweepCursor,
  type AliExpressImportCursor,
} from "@/lib/integrations/aliexpress/import-cursor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

function resolveImportProvider(ctx: SyncContext): ImportProviderId | null {
  return isImportProviderId(ctx.integrationType) ? ctx.integrationType : null;
}

/**
 * Write ONE imported product end-to-end (external row → canonical merge →
 * price snapshot → images). Shared by the full sweep and the chunked sweep so
 * both paths behave identically. Never throws into the caller.
 */
async function writeImportedProduct(
  supabase: SupabaseDb,
  ctx: SyncContext,
  provider: ImportProviderId | null,
  product: ExternalProduct,
  bridged: BridgedProduct[],
  result: SyncRunResult,
): Promise<void> {
  try {
    let externalRowId: string | null = null;
    if (provider) {
      const external = await upsertExternalProduct(supabase, provider, ctx.storeId, product);
      externalRowId = external?.id ?? null;
    }

    const { productId, created, skipped } = await mergeExternalProductToCatalog(
      supabase,
      ctx,
      product,
      externalRowId
    );

    if (provider) {
      await upsertExternalPrice(supabase, provider, ctx.storeId, product, externalRowId, productId);
    }
    await mergeExternalPriceToCatalog(supabase, ctx, provider, product, productId);

    if (!skipped) {
      await mergeExternalImagesToCatalog(supabase, product, productId);
    }

    bridged.push({ product, productId });

    if (created) result.itemsCreated += 1;
    else if (!skipped) result.itemsUpdated += 1;
  } catch {
    result.itemsFailed += 1;
  }
}

/** Merge one price-updated product into the canonical catalog. */
async function writeImportedPriceUpdate(
  supabase: SupabaseDb,
  ctx: SyncContext,
  provider: ImportProviderId | null,
  product: ExternalProduct,
  bridged: BridgedProduct[],
  result: SyncRunResult,
): Promise<void> {
  try {
    let externalRowId: string | null = null;
    if (provider) {
      const external = await upsertExternalProduct(supabase, provider, ctx.storeId, product);
      externalRowId = external?.id ?? null;
    }

    const { productId } = await mergeExternalProductToCatalog(
      supabase,
      ctx,
      product,
      externalRowId
    );

    if (provider) {
      await upsertExternalPrice(supabase, provider, ctx.storeId, product, externalRowId, productId);
    }
    await mergeExternalPriceToCatalog(supabase, ctx, provider, product, productId);
    bridged.push({ product, productId });
    result.itemsUpdated += 1;
  } catch {
    result.itemsFailed += 1;
  }
}

export async function importProductsFromProvider(
  supabase: SupabaseDb,
  ctx: SyncContext,
  result: SyncRunResult
): Promise<void> {
  const provider = resolveImportProvider(ctx);
  const connector = getConnectorForIntegration(ctx.integrationType);
  const products = await connector.fetchProducts(ctx);
  result.itemsFetched += products.length;

  const bridged: BridgedProduct[] = [];
  for (const product of products) {
    await writeImportedProduct(supabase, ctx, provider, product, bridged, result);
  }

  // Surface freshly-imported inventory in the Search DB leg (lowest_prices_today).
  await bridgeImportedProductsToLowestPrices(supabase, ctx, provider, bridged);

  const { refreshUniversalCatalogAggregates } = await import("@/services/marketplace-engine");
  await refreshUniversalCatalogAggregates({ limit: 200 });
}

export async function importPricesFromProvider(
  supabase: SupabaseDb,
  ctx: SyncContext,
  result: SyncRunResult
): Promise<void> {
  const provider = resolveImportProvider(ctx);
  const connector = getConnectorForIntegration(ctx.integrationType);

  const externalIds =
    provider !== null
      ? await getExternalIdsForStore(supabase, provider, ctx.storeId)
      : [];

  let priceUpdates: Pick<
    ExternalProduct,
    "externalId" | "price" | "originalPrice" | "currency" | "inStock"
  >[] = [];

  if (externalIds.length > 0 && connector.isConfigured()) {
    priceUpdates = await connector.fetchPrices(ctx, externalIds);
    result.itemsFetched += priceUpdates.length;
  }

  const products =
    priceUpdates.length > 0 && provider
      ? await hydratePriceUpdates(supabase, provider, ctx.storeId, priceUpdates)
      : await connector.fetchProducts(ctx);

  if (priceUpdates.length === 0) {
    result.itemsFetched += products.length;
  }

  const bridged: BridgedProduct[] = [];
  for (const product of products) {
    await writeImportedPriceUpdate(supabase, ctx, provider, product, bridged, result);
  }

  // Surface freshly-imported / re-priced inventory in the Search DB leg.
  await bridgeImportedProductsToLowestPrices(supabase, ctx, provider, bridged);
}

export async function importDealsFromProvider(
  supabase: SupabaseDb,
  ctx: SyncContext,
  result: SyncRunResult
): Promise<void> {
  const connector = getConnectorForIntegration(ctx.integrationType);
  const deals = await connector.fetchDeals(ctx);
  result.itemsFetched += deals.length;

  for (const deal of deals) {
    try {
      const { data: source } = await db(supabase)
        .from("product_sources")
        .select("product_id")
        .eq("store_id", ctx.storeId)
        .eq("external_product_id", deal.externalProductId)
        .maybeSingle();

      if (!source?.product_id) continue;

      await mergeExternalDealToCatalog(supabase, ctx, deal, source.product_id);
      result.itemsUpdated += 1;
    } catch {
      result.itemsFailed += 1;
    }
  }
}

export async function importImagesFromProvider(
  supabase: SupabaseDb,
  ctx: SyncContext,
  result: SyncRunResult
): Promise<void> {
  const connector = getConnectorForIntegration(ctx.integrationType);
  const products = await connector.fetchProducts(ctx);

  for (const product of products) {
    try {
      const { productId } = await mergeExternalProductToCatalog(supabase, ctx, product, null);
      await mergeExternalImagesToCatalog(supabase, product, productId);
      result.itemsUpdated += 1;
    } catch {
      result.itemsFailed += 1;
    }
  }
}

/**
 * Chunked, resumable product import (AliExpress sweep).
 *
 * Runs keyword×page micro-batches until the wall-clock deadline or the sweep is
 * fully consumed, then hands back the next cursor to persist. The caller stores
 * the cursor (see `lib/integrations/aliexpress/import-cursor.ts`) so the NEXT
 * cron invocation resumes exactly where this one stopped instead of re-fetching
 * the whole sweep or getting killed by the serverless/Cloudflare limits.
 */
export type ChunkedImportOutcome = {
  /** True when the whole sweep was consumed and the cursor should reset. */
  done: boolean;
  /** Cursor to persist for the next invocation (null when done/incomplete fetch). */
  nextCursor: AliExpressImportCursor | null;
  processed: number;
};

export async function importProductsChunked(
  supabase: SupabaseDb,
  ctx: SyncContext,
  result: SyncRunResult,
  options: {
    cursor: AliExpressImportCursor | null;
    deadlineAt: number;
    persist?: (cursor: AliExpressImportCursor | null) => Promise<void>;
  },
): Promise<ChunkedImportOutcome> {
  const provider = resolveImportProvider(ctx);
  const connector = getConnectorForIntegration(ctx.integrationType) as unknown as {
    fetchProductsChunk?: (
      ctx: SyncContext,
      cursor: AliExpressImportCursor | null,
    ) => Promise<{
      products: ExternalProduct[];
      next: AliExpressImportCursor | null;
      done: boolean;
    }>;
    isConfigured(): boolean;
  };

  if (typeof connector.fetchProductsChunk !== "function") {
    return { done: true, nextCursor: null, processed: 0 };
  }

  let cursor = options.cursor ?? startSweepCursor();
  let processed = 0;

  while (Date.now() < options.deadlineAt) {
    const chunk = await connector.fetchProductsChunk(ctx, cursor);
    if (chunk.products.length === 0) {
      if (chunk.done) return { done: true, nextCursor: null, processed };
      // No usable items but more pages? Persist the next cursor and bail.
      await options.persist?.(chunk.next);
      return { done: chunk.done, nextCursor: chunk.next, processed };
    }

    result.itemsFetched += chunk.products.length;
    const bridged: BridgedProduct[] = [];
    let interrupted = false;
    for (const product of chunk.products) {
      if (Date.now() >= options.deadlineAt) {
        interrupted = true;
        break;
      }
      await writeImportedProduct(supabase, ctx, provider, product, bridged, result);
      processed += 1;
    }
    await bridgeImportedProductsToLowestPrices(supabase, ctx, provider, bridged);

    if (interrupted) {
      // Stay on THIS page: the next invocation re-fetches it and finishes the
      // unwritten products (upserts are idempotent) instead of skipping them.
      await options.persist?.(cursor);
      return { done: false, nextCursor: cursor, processed };
    }

    if (chunk.done) {
      await options.persist?.(null);
      return { done: true, nextCursor: null, processed };
    }
    if (!chunk.next) {
      await options.persist?.(null);
      return { done: true, nextCursor: null, processed };
    }

    // Persist after every chunk so a hard cap mid-loop never loses progress;
    // the next invocation resumes exactly at this page (idempotent upserts).
    cursor = chunk.next;
    await options.persist?.(cursor);
  }

  return { done: false, nextCursor: cursor, processed };
}

/** Chunked, resumable image import (AliExpress sweep, images only). */
export async function importImagesChunked(
  supabase: SupabaseDb,
  ctx: SyncContext,
  result: SyncRunResult,
  options: {
    cursor: AliExpressImportCursor | null;
    deadlineAt: number;
    persist?: (cursor: AliExpressImportCursor | null) => Promise<void>;
  },
): Promise<ChunkedImportOutcome> {
  const connector = getConnectorForIntegration(ctx.integrationType) as unknown as {
    fetchProductsChunk?: (
      ctx: SyncContext,
      cursor: AliExpressImportCursor | null,
    ) => Promise<{
      products: ExternalProduct[];
      next: AliExpressImportCursor | null;
      done: boolean;
    }>;
    isConfigured(): boolean;
  };

  if (typeof connector.fetchProductsChunk !== "function") {
    return { done: true, nextCursor: null, processed: 0 };
  }

  let cursor = options.cursor ?? startSweepCursor();
  let processed = 0;

  while (Date.now() < options.deadlineAt) {
    const chunk = await connector.fetchProductsChunk(ctx, cursor);
    if (chunk.products.length === 0) {
      await options.persist?.(chunk.next);
      return { done: chunk.done, nextCursor: chunk.next, processed };
    }

    result.itemsFetched += chunk.products.length;
    let interrupted = false;
    for (const product of chunk.products) {
      if (Date.now() >= options.deadlineAt) {
        interrupted = true;
        break;
      }
      try {
        const { productId } = await mergeExternalProductToCatalog(supabase, ctx, product, null);
        await mergeExternalImagesToCatalog(supabase, product, productId);
        result.itemsUpdated += 1;
        processed += 1;
      } catch {
        result.itemsFailed += 1;
      }
    }

    if (interrupted) {
      await options.persist?.(cursor);
      return { done: false, nextCursor: cursor, processed };
    }

    if (chunk.done || !chunk.next) {
      await options.persist?.(null);
      return { done: true, nextCursor: null, processed };
    }
    cursor = chunk.next;
    await options.persist?.(cursor);
  }

  return { done: false, nextCursor: cursor, processed };
}

/** Chunked, resumable price refresh over stored external ids (offset cursor). */
export async function importPricesChunked(
  supabase: SupabaseDb,
  ctx: SyncContext,
  result: SyncRunResult,
  options: {
    cursor: AliExpressImportCursor | null;
    deadlineAt: number;
    batchSize?: number;
    persist?: (cursor: AliExpressImportCursor | null) => Promise<void>;
  },
): Promise<ChunkedImportOutcome> {
  const provider = resolveImportProvider(ctx);
  const connector = getConnectorForIntegration(ctx.integrationType);

  const externalIds =
    provider !== null
      ? await getExternalIdsForStore(supabase, provider, ctx.storeId)
      : [];

  if (externalIds.length === 0) {
    return { done: true, nextCursor: null, processed: 0 };
  }

  const requestedBatch = options.batchSize ?? ALIEXPRESS_CHUNK_RESULT_COUNT;
  const batchSize = Math.max(1, Math.trunc(requestedBatch) || ALIEXPRESS_CHUNK_RESULT_COUNT);
  const start = options.cursor ?? startIdsCursor();
  const startOffset = start.type === "ids" ? Math.max(0, Math.trunc(start.offset) || 0) : 0;
  let offset = startOffset;
  let processed = 0;

  while (offset < externalIds.length && Date.now() < options.deadlineAt) {
    const batch = externalIds.slice(offset, offset + batchSize);
    let parts: Pick<
      ExternalProduct,
      "externalId" | "price" | "originalPrice" | "currency" | "inStock"
    >[] = [];

    if (connector.isConfigured() && batch.length > 0) {
      parts = await connector.fetchPrices(ctx, batch);
      result.itemsFetched += parts.length;
    }

    const products =
      parts.length > 0 && provider
        ? await hydratePriceUpdates(supabase, provider, ctx.storeId, parts)
        : [];

    const bridged: BridgedProduct[] = [];
    let interrupted = false;
    for (const product of products) {
      if (Date.now() >= options.deadlineAt) {
        interrupted = true;
        break;
      }
      await writeImportedPriceUpdate(supabase, ctx, provider, product, bridged, result);
      processed += 1;
    }
    await bridgeImportedProductsToLowestPrices(supabase, ctx, provider, bridged);

    const { next, done } = advanceIdsCursor(offset, externalIds.length, batchSize);
    if (interrupted) {
      await options.persist?.({ type: "ids", offset });
      return { done: false, nextCursor: { type: "ids", offset }, processed };
    }
    if (done) {
      await options.persist?.(null);
      return { done: true, nextCursor: null, processed };
    }
    offset = (next as { type: "ids"; offset: number }).offset;
    await options.persist?.({ type: "ids", offset });
  }

  return { done: false, nextCursor: { type: "ids", offset }, processed };
}

async function hydratePriceUpdates(
  supabase: SupabaseDb,
  provider: ImportProviderId,
  storeId: string,
  updates: Pick<
    ExternalProduct,
    "externalId" | "price" | "originalPrice" | "currency" | "inStock"
  >[]
): Promise<ExternalProduct[]> {
  const hydrated: ExternalProduct[] = [];

  for (const update of updates) {
    const { data: row } = await db(supabase)
      .from("external_products")
      .select("*")
      .eq("provider", provider)
      .eq("store_id", storeId)
      .eq("external_id", update.externalId)
      .maybeSingle();

    if (!row) continue;

    hydrated.push({
      externalId: update.externalId,
      title: row.title,
      slug: row.slug,
      categorySlug: row.category_slug ?? "phones",
      imageUrl: row.image_url,
      price: update.price,
      originalPrice: update.originalPrice,
      currency: update.currency,
      countryCode: row.country_code ?? "US",
      inStock: update.inStock,
      productUrl: row.product_url ?? "",
      brand: row.brand ?? undefined,
      rating: row.rating ?? undefined,
      reviewCount: row.review_count ?? 0,
    });
  }

  return hydrated;
}