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
import { getConnectorForIntegration } from "@/lib/sync/connectors";
import { isImportProviderId } from "@/lib/sync/providers";
import type { ImportProviderId } from "@/lib/sync/providers/types";
import type { ExternalProduct, SyncContext, SyncRunResult } from "@/lib/sync/types";
import type { SupabaseDb } from "@/lib/supabase/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

function resolveImportProvider(ctx: SyncContext): ImportProviderId | null {
  return isImportProviderId(ctx.integrationType) ? ctx.integrationType : null;
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

  for (const product of products) {
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

      if (created) result.itemsCreated += 1;
      else if (!skipped) result.itemsUpdated += 1;
    } catch {
      result.itemsFailed += 1;
    }
  }
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

  for (const product of products) {
    try {
      let externalRowId: string | null = null;
      if (provider) {
        const external = await upsertExternalProduct(supabase, provider, ctx.storeId, product);
        externalRowId = external?.id ?? null;
      }

      const { data: canonical } = await db(supabase)
        .from("products")
        .select("id")
        .eq("slug", product.slug)
        .maybeSingle();

      const productId =
        canonical?.id ??
        (await mergeExternalProductToCatalog(supabase, ctx, product, externalRowId)).productId;

      if (provider) {
        await upsertExternalPrice(supabase, provider, ctx.storeId, product, externalRowId, productId);
      }
      await mergeExternalPriceToCatalog(supabase, ctx, provider, product, productId);
      result.itemsUpdated += 1;
    } catch {
      result.itemsFailed += 1;
    }
  }
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
      const { data: dbProduct } = await db(supabase)
        .from("products")
        .select("id")
        .eq("slug", product.slug)
        .maybeSingle();
      if (!dbProduct?.id) continue;

      await mergeExternalImagesToCatalog(supabase, product, dbProduct.id);
      result.itemsUpdated += 1;
    } catch {
      result.itemsFailed += 1;
    }
  }
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
