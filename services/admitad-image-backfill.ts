/**
 * Admitad product-image backfill.
 *
 * The persisted canonical catalog (`lowest_prices_today`) was written by an
 * older feed parser that missed several image tags, so most real Admitad
 * merchants stored rows with an EMPTY image_url (only Alibaba had images).
 * The live feed parser now recovers those images (see feed-fetcher.ts), but
 * existing rows were never refreshed.
 *
 * This job re-reads the real merchant feeds with the fixed parser and patches
 * every persisted row that has a real image available but is still empty. It
 * never fabricates an image: a row is only updated when the matching feed
 * offer genuinely carries one. Matching uses the persisted `product_slug`
 * (`admitad-<campaignId>-<offerId>`), which is stable and real.
 *
 * Budget-aware: fetches one feed at a time and aborts once the wall-clock
 * deadline is hit, so it is safe to run inside the bundled cron.
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type AdmitadImageBackfillResult = {
  feedsChecked: number;
  offersWithImage: number;
  rowsScanned: number;
  rowsPatched: number;
  errors: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: unknown): any {
  return client;
}

/**
 * Patch empty `image_url` rows in `lowest_prices_today` from the real image
 * carried by the matching feed offer. Real-data only — an empty image is
 * restored from a genuine provider URL; nothing is invented.
 */
export async function backfillAdmitadImages(options: {
  maxFeeds?: number;
  maxProductsPerFeed?: number;
  timeoutPerFeedMs?: number;
  deadlineMs?: number;
} = {}): Promise<AdmitadImageBackfillResult> {
  const supabase = createSupabaseServiceClient();
  const result: AdmitadImageBackfillResult = {
    feedsChecked: 0,
    offersWithImage: 0,
    rowsScanned: 0,
    rowsPatched: 0,
    errors: [],
  };
  if (!supabase) {
    result.errors.push("Supabase not configured for backfill");
    return result;
  }

  const {
    maxFeeds = 12,
    maxProductsPerFeed = 800,
    timeoutPerFeedMs = 15_000,
    deadlineMs = 30_000,
  } = options;
  const startedAt = Date.now();

  const { getAllAdmitadFeeds } = await import(
    "@/lib/integrations/admitad/config"
  );
  const { fetchFeedOffersFromUrl } = await import(
    "@/lib/integrations/admitad/feed-fetcher"
  );
  const { normalizeProductImageUrl, PRODUCT_IMAGE_PLACEHOLDER } = await import(
    "@/lib/images/product-image"
  );

  let feeds: import("@/lib/integrations/admitad/types").AdmitadFeedConfig[] = [];
  try {
    feeds = await getAllAdmitadFeeds();
  } catch (err) {
    result.errors.push(
      `Feed discovery failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return result;
  }

  const sb = db(supabase);

  for (const feed of feeds.slice(0, maxFeeds)) {
    if (Date.now() - startedAt > deadlineMs) {
      result.errors.push(`Deadline reached after ${result.feedsChecked} feeds`);
      break;
    }
    result.feedsChecked++;

    // Fetch the real feed with the fixed parser.
    let offers: import("@/lib/integrations/admitad/types").AdmitadFeedOffer[] = [];
    try {
      offers = await fetchFeedOffersFromUrl(feed.feedUrl, {
        timeoutMs: timeoutPerFeedMs,
        maxOffers: maxProductsPerFeed,
      });
    } catch (err) {
      result.errors.push(
        `Feed "${feed.name}" fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    // Only real images apply to the persisted rows.
    const imageBySlug = new Map<string, string>();
    for (const offer of offers) {
      const image = normalizeProductImageUrl(offer.image || "");
      if (!image || image === PRODUCT_IMAGE_PLACEHOLDER) continue;
      const slug = `${feed.slug}-${offer.id}`;
      if (!imageBySlug.has(slug)) imageBySlug.set(slug, image);
    }
    result.offersWithImage += imageBySlug.size;
    if (imageBySlug.size === 0) continue;

    // Find persisted rows (US/USD provider=admitad) for this merchant with an
    // empty or null image_url whose product_slug is recoverable from the feed.
    const slugs = Array.from(imageBySlug.keys());
    const BATCH = 900;
    for (let i = 0; i < slugs.length; i += BATCH) {
      const batch = slugs.slice(i, i + BATCH);
      const { data: rows, error } = await sb
        .from("lowest_prices_today")
        .select("id, product_slug, image_url")
        .eq("provider", "admitad")
        .eq("country_code", "US")
        .eq("currency", "USD")
        .in("product_slug", batch)
        .or("image_url.is.null,image_url.eq.");
      if (error || !rows) continue;

      const updates: Array<{ id: string; image_url: string }> = [];
      for (const row of rows) {
        const real = imageBySlug.get(row.product_slug);
        if (real) {
          updates.push({ id: row.id, image_url: real });
        }
      }
      if (updates.length === 0) continue;

      // Group row ids by their target image, so one filtered UPDATE sets the
      // correct image per row (PostgREST update applies one value to all
      // matched rows). Only touches image_url — never other columns.
      const idsByImage = new Map<string, string[]>();
      for (const u of updates) {
        const list = idsByImage.get(u.image_url) ?? [];
        list.push(u.id);
        idsByImage.set(u.image_url, list);
      }

      for (const [imageUrl, ids] of idsByImage) {
        // Chunk ids to stay within Supabase per-request limits.
        for (let g = 0; g < ids.length; g += 200) {
          const idChunk = ids.slice(g, g + 200);
          const { error: upErr } = await sb
            .from("lowest_prices_today")
            .update({ image_url: imageUrl })
            .in("id", idChunk);
          if (upErr) {
            result.errors.push(
              `Patch error for feed "${feed.name}": ${upErr.message}`,
            );
          } else {
            result.rowsPatched += idChunk.length;
          }
        }
      }
    }
  }

  return result;
}
