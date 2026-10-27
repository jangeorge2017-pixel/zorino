/**
 * Admitad → global multi-store schema (products + product_offers).
 *
 * Admitad is a NETWORK: one API account carries many real merchants. Each
 * accepted offer is written as its own `product_offers` row using the real
 * merchant name from the feed, the `Admitad` network identity, and the offer's
 * real market country. Products are keyed by a namespaced global SKU
 * (`admitad:<campaign>:<offer>`) so numeric offer ids from different campaigns
 * can never overwrite each other.
 *
 * Real data only: rows without a merchant name, price, or destination URL are
 * skipped, never fabricated. Writes are additive to the legacy catalog save and
 * bounded by an optional deadline so a cron run cannot wedge on this step.
 */

import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import { ADMITAD_PROVIDER_ID } from "@/lib/integrations/admitad/config";
import {
  buildProviderGlobalSku,
  syncGlobalProductOffer,
  type GlobalOfferIdentity,
} from "@/lib/sync/import/global-catalog";
import type { ExternalProduct } from "@/lib/sync/types";
import type { SupabaseDb } from "@/lib/supabase/config";

export const ADMITAD_NETWORK_NAME = "Admitad";

const DEFAULT_WRITE_CONCURRENCY = 6;

export type AdmitadGlobalWriteOptions = {
  deadlineAt?: number;
  maxItems?: number;
  concurrency?: number;
};

export type AdmitadGlobalWriteResult = {
  offersUpserted: number;
  failed: number;
  skipped: number;
  stoppedReason: "done" | "deadline" | "max-items";
};

function toExternalProduct(item: NormalizedCatalogItem): ExternalProduct | null {
  const offer = item.offers[0];
  if (!offer) return null;

  const productUrl = offer.productUrl || offer.affiliateUrl || "";
  const affiliateUrl = offer.affiliateUrl || productUrl;
  if (!productUrl || !affiliateUrl) return null;

  const title = item.title.trim();
  if (!title) return null;

  const campaignId = Number(item.id.split("-")[1]);
  const externalId = Number.isFinite(campaignId)
    ? `${campaignId}:${offer.externalId}`
    : item.id;

  return {
    externalId,
    title,
    slug: item.slug,
    description: title,
    categorySlug: item.categorySlug,
    imageUrl: item.imageUrl,
    price: offer.price,
    originalPrice: item.originalPrice,
    currency: item.currency,
    countryCode: item.countryCode,
    inStock: offer.inStock,
    productUrl,
    affiliateUrl,
  };
}

/**
 * Upsert every Admitad item into `products` + `product_offers`. Never throws
 * for row-level failures; returns real write/skip counts.
 */
export async function syncAdmitadItemsToGlobalSchema(
  supabase: SupabaseDb,
  items: readonly NormalizedCatalogItem[],
  options: AdmitadGlobalWriteOptions = {},
): Promise<AdmitadGlobalWriteResult> {
  const result: AdmitadGlobalWriteResult = {
    offersUpserted: 0,
    failed: 0,
    skipped: 0,
    stoppedReason: "done",
  };

  const limit = Math.min(items.length, options.maxItems ?? items.length);
  const deadlineAt = options.deadlineAt ?? Number.POSITIVE_INFINITY;
  const concurrency = Math.max(
    1,
    Math.min(options.concurrency ?? DEFAULT_WRITE_CONCURRENCY, limit || 1),
  );

  let nextIndex = 0;

  const worker = async () => {
    for (;;) {
      if (Date.now() >= deadlineAt) {
        result.stoppedReason = "deadline";
        return;
      }
      const index = nextIndex;
      if (index >= limit) {
        result.stoppedReason = limit < items.length ? "max-items" : "done";
        return;
      }
      nextIndex = index + 1;

      const item = items[index];
      const offer = item.offers[0];
      const storeName = offer?.storeName?.trim();
      if (!offer || !storeName) {
        result.skipped += 1;
        continue;
      }

      const product = toExternalProduct(item);
      if (!product) {
        result.skipped += 1;
        continue;
      }

      const identity: GlobalOfferIdentity = {
        storeName,
        networkName: ADMITAD_NETWORK_NAME,
        countryCode: item.countryCode,
      };

      try {
        const globalSku = buildProviderGlobalSku(ADMITAD_PROVIDER_ID, product);
        await syncGlobalProductOffer(supabase, product, identity, globalSku);
        result.offersUpserted += 1;
      } catch (err) {
        result.failed += 1;
        if (result.failed <= 5) {
          console.warn(
            `[admitad-global] offer write failed for ${item.slug}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return result;
}
