/**
 * ArabClicks feed → Search visibility bridge.
 *
 * The universal feed sync writes `products` + `product_offers`, but Search's DB
 * leg reads `lowest_prices_today` ONLY (see lib/integration/database-catalog.ts).
 * Without this bridge a synced ArabClicks offer is real in the database yet
 * invisible to Search and the homepage.
 *
 * Fidelity:
 *  - Only offers the sync just touched (`last_updated >= since`) are considered.
 *  - Only real merchant payloads: a row without a usable image, price, market
 *    (catalog scope) or currency is skipped — nothing is synthesized.
 *  - `lowest_prices_today` keeps the LOWEST offer per product+market: a cheaper
 *    existing row is never raised, an identical row is never rewritten.
 *  - The real merchant name stays in `store_name`; provider identity is the
 *    merchant's registered id when known (Never "arabclicks" — the network is
 *    not the store).
 *  - Best-effort: never throws into the caller.
 */

import type { SupabaseDb } from "@/lib/supabase/config";
import {
  normalizeProductImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/images/product-image";
import {
  CATALOG_COUNTRIES,
  CATALOG_CURRENCIES,
  isCatalogCountry,
  isCatalogCurrency,
} from "@/lib/integration/catalog-scope";
import { resolveProviderId } from "@/lib/providers/registry";
import { applyTrackingToUrl } from "@/lib/affiliate/tracking-engine";
import { ARABCLICKS_NETWORK_NAME } from "@/lib/sync/import/arabclicks-catalog";
import { shouldSkipBridgeWrite } from "@/lib/sync/import/lowest-prices-bridge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

const READ_PAGE = 500;
const UPSERT_BATCH = 500;
const DEFAULT_MAX_ROWS = 2_000;

type OfferRow = {
  product_id: string;
  store_name: string;
  country_code: string;
  price: number | string;
  currency: string;
  affiliate_url: string | null;
  product_store_url: string | null;
  in_stock: boolean | null;
  last_updated: string | null;
  products:
    | { title: string | null; main_image: string | null; global_sku: string | null }
    | { title: string | null; main_image: string | null; global_sku: string | null }[]
    | null;
};

function embeddedProduct(row: OfferRow) {
  if (!row.products) return null;
  return Array.isArray(row.products) ? (row.products[0] ?? null) : row.products;
}

export type ArabClicksBridgeResult = {
  candidates: number;
  rowsPrepared: number;
  written: number;
};

/**
 * Sink ArabClicks offers touched since `since` into `lowest_prices_today`.
 * Returns counts (never throws); `written` is the number of upserted rows.
 */
export async function bridgeArabClicksOffersToLowestPrices(
  supabase: SupabaseDb,
  options: { since: Date | string; maxRows?: number },
): Promise<ArabClicksBridgeResult> {
  const result: ArabClicksBridgeResult = { candidates: 0, rowsPrepared: 0, written: 0 };
  const sinceIso =
    options.since instanceof Date ? options.since.toISOString() : options.since;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;

  const offers: OfferRow[] = [];
  try {
    for (let offset = 0; offset < maxRows; offset += READ_PAGE) {
      const upper = Math.min(offset + READ_PAGE, maxRows) - 1;
      const { data, error } = await db(supabase)
        .from("product_offers")
        .select(
          "product_id, store_name, country_code, price, currency, affiliate_url, " +
            "product_store_url, in_stock, last_updated, " +
            "products!inner(title, main_image, global_sku)",
        )
        .eq("network_name", ARABCLICKS_NETWORK_NAME)
        .gte("last_updated", sinceIso)
        .order("last_updated", { ascending: true })
        .range(offset, upper);
      if (error) break;
      const page = (data ?? []) as OfferRow[];
      offers.push(...page);
      if (page.length < upper - offset + 1) break;
    }
  } catch {
    return result;
  }

  result.candidates = offers.length;
  if (offers.length === 0) return result;

  // Existing lowest offers for the involved products (one batched read).
  const existing = new Map<
    string,
    { price: number; imageUrl: string }
  >();
  const productIds = Array.from(new Set(offers.map((row) => row.product_id)));
  for (let i = 0; i < productIds.length; i += READ_PAGE) {
    try {
      const { data } = await db(supabase)
        .from("lowest_prices_today")
        .select("product_id, country_code, currency, lowest_price, image_url")
        .in("country_code", [...CATALOG_COUNTRIES])
        .in("currency", [...CATALOG_CURRENCIES])
        .in("product_id", productIds.slice(i, i + READ_PAGE));
      for (const row of (data ?? []) as {
        product_id: string;
        country_code: string;
        currency: string;
        lowest_price: number | string;
        image_url: string | null;
      }[]) {
        existing.set(`${row.product_id}|${row.country_code}|${row.currency}`, {
          price: Number(row.lowest_price),
          imageUrl: row.image_url ?? "",
        });
      }
    } catch {
      // best-effort read; an empty map only means "no known cheaper row"
    }
  }

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];

  for (const offer of offers) {
    const product = embeddedProduct(offer);
    const title = product?.title?.trim() ?? "";
    const countryCode = offer.country_code?.toUpperCase() ?? "";
    const currency = offer.currency?.toUpperCase() ?? "";
    if (!title) continue;
    if (!isCatalogCountry(countryCode) || !isCatalogCurrency(currency)) continue;

    const price = Number(offer.price);
    if (!Number.isFinite(price) || price <= 0) continue;

    const image = normalizeProductImageUrl(product?.main_image ?? "");
    if (!image || image === PRODUCT_IMAGE_PLACEHOLDER) continue;

    const key = `${offer.product_id}|${countryCode}|${currency}`;
    if (shouldSkipBridgeWrite(existing.get(key) ?? null, price, image)) continue;

    const affiliateUrl = offer.affiliate_url
      ? applyTrackingToUrl(offer.affiliate_url, "arabclicks")
      : null;

    rows.push({
      product_id: offer.product_id,
      country_code: countryCode,
      currency,
      product_name: title,
      product_slug: product?.global_sku || offer.product_id,
      image_url: image,
      emoji: null,
      lowest_price: price,
      original_price: null,
      discount_percent: 0,
      savings_amount: 0,
      store_id: null,
      store_name: offer.store_name,
      provider: resolveProviderId(offer.store_name),
      affiliate_url: affiliateUrl,
      external_url: offer.product_store_url ?? null,
      is_new_low: false,
      price_recorded_at: offer.last_updated ?? now,
      computed_at: now,
    });

    // Keep the loop's view consistent when the same product repeats in-run.
    existing.set(key, { price, imageUrl: image });
  }

  result.rowsPrepared = rows.length;
  if (rows.length === 0) return result;

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    try {
      const { error } = await db(supabase)
        .from("lowest_prices_today")
        .upsert(rows.slice(i, i + UPSERT_BATCH), {
          onConflict: "product_id,country_code,currency",
          ignoreDuplicates: false,
        });
      if (!error) result.written += Math.min(UPSERT_BATCH, rows.length - i);
    } catch {
      // best-effort per batch
    }
  }

  return result;
}
