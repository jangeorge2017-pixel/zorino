/**
 * Bridge imported provider rows into the Search surface.
 *
 * Search's DB leg reads `lowest_prices_today` ONLY. Admitad ingestion writes
 * that table, but provider imports (AliExpress / eBay / Amazon) write only
 * `external_products` + `products` + `prices` — so their inventory feeds the
 * Homepage / Compare / PDP surfaces but never appears in Search. This bridge
 * sinks each real imported US/USD product (with a usable image + price) into
 * `lowest_prices_today` so it surfaces in Search immediately.
 *
 * Fidelity:
 *  - Only REAL imported payloads are written (nothing is synthesized).
 *  - The table is the LOWEST offer per product: an existing cheaper row is
 *    never overwritten by a pricier one.
 *  - Rows without a usable image/price are skipped.
 *  - Best-effort: a bridge failure never fails the import run.
 */

import type { SupabaseDb } from "@/lib/supabase/config";
import {
  normalizeProductImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/images/product-image";
import { getSyncStoreMeta } from "@/lib/integration/provider-context";
import type { ImportProviderId } from "@/lib/sync/providers/types";
import type { ExternalProduct, SyncContext } from "@/lib/sync/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

export type BridgedProduct = {
  product: ExternalProduct;
  productId: string;
};

function computeDiscountPercent(price: number, originalPrice: number | null): number {
  if (!originalPrice || originalPrice <= price || price <= 0) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 10000) / 100;
}

/** Resolve a friendly store display name for the row's NOT NULL store_name. */
async function resolveStoreName(
  supabase: SupabaseDb,
  ctx: SyncContext,
  provider: ImportProviderId,
): Promise<string> {
  try {
    const { data } = await db(supabase)
      .from("stores")
      .select("name")
      .eq("id", ctx.storeId)
      .maybeSingle();
    if (data?.name) return data.name as string;
  } catch {
    // fall through to the provider display name
  }
  return getSyncStoreMeta(provider).name;
}

/**
 * Sink imported US/USD products into `lowest_prices_today`. Returns the number
 * of rows written. Never throws into the caller.
 */
export async function bridgeImportedProductsToLowestPrices(
  supabase: SupabaseDb,
  ctx: SyncContext,
  provider: ImportProviderId | null,
  items: BridgedProduct[],
): Promise<number> {
  if (!provider || items.length === 0) return 0;

  // Keep the LAST occurrence per canonical product id, after validity filters.
  const candidates = new Map<string, BridgedProduct>();
  for (const item of items) {
    const { product, productId } = item;
    if (!productId) continue;
    if (product.countryCode !== "US" || product.currency !== "USD") continue;
    if (!product.title || product.price <= 0) continue;
    const image = normalizeProductImageUrl(product.imageUrl);
    if (!image || image === PRODUCT_IMAGE_PLACEHOLDER) continue;
    candidates.set(productId, item);
  }
  if (candidates.size === 0) return 0;

  // Read existing lowest prices so a cheaper row is never raised.
  const existingPrices = new Map<string, number>();
  const ids = [...candidates.keys()];
  for (let i = 0; i < ids.length; i += 150) {
    try {
      const { data } = await db(supabase)
        .from("lowest_prices_today")
        .select("product_id, lowest_price")
        .eq("country_code", "US")
        .eq("currency", "USD")
        .in("product_id", ids.slice(i, i + 150));
      for (const row of (data ?? []) as { product_id: string; lowest_price: number }[]) {
        existingPrices.set(row.product_id, Number(row.lowest_price));
      }
    } catch {
      // best-effort read
    }
  }

  const storeName = await resolveStoreName(supabase, ctx, provider);
  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];

  for (const { product, productId } of candidates.values()) {
    if (!productId) continue;
    const existing = existingPrices.get(productId);
    if (existing !== undefined && product.price > existing + 0.001) continue;

    const image = normalizeProductImageUrl(product.imageUrl);
    const originalPrice =
      product.originalPrice && product.originalPrice > product.price
        ? product.originalPrice
        : null;

    rows.push({
      product_id: productId,
      country_code: "US",
      currency: "USD",
      product_name: product.title,
      product_slug: product.slug || productId,
      image_url: image,
      emoji: product.emoji ?? null,
      lowest_price: product.price,
      original_price: originalPrice,
      discount_percent: computeDiscountPercent(product.price, originalPrice),
      savings_amount: originalPrice ? Math.max(0, originalPrice - product.price) : 0,
      store_id: ctx.storeId,
      store_name: storeName,
      provider,
      affiliate_url: product.affiliateUrl ?? product.productUrl ?? null,
      external_url: product.productUrl ?? null,
      is_new_low: false,
      price_recorded_at: now,
      computed_at: now,
    });
  }

  let written = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    try {
      const { error } = await db(supabase)
        .from("lowest_prices_today")
        .upsert(batch, {
          onConflict: "product_id,country_code,currency",
          ignoreDuplicates: false,
        });
      if (!error) written += batch.length;
    } catch {
      // best-effort per batch
    }
  }

  return written;
}
