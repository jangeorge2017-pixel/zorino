import type { AdmitadFeedOffer } from "./types";
import { getAllAdmitadFeeds, FEED_CACHE_TTL_MS } from "./config";

type CachedFeed = {
  offers: AdmitadFeedOffer[];
  fetchedAt: number;
};

const feedCache = new Map<string, CachedFeed>();

/** Check if any feed has been loaded into memory (non-blocking). */
export function isAdmitadFeedReady(): boolean {
  for (const cached of feedCache.values()) {
    if (Date.now() - cached.fetchedAt < FEED_CACHE_TTL_MS) {
      return true;
    }
  }
  return false;
}

/** Default bounds for the live catalog/search path (overridable via env). */
const DEFAULT_MAX_FEEDS = Number(process.env.ADMITAD_CATALOG_MAX_FEEDS ?? 4);
const DEFAULT_MAX_PRODUCTS_PER_FEED = Number(
  process.env.ADMITAD_CATALOG_MAX_PRODUCTS_PER_FEED ?? 400,
);
const DEFAULT_TIMEOUT_PER_FEED_MS = 20_000;
const DEFAULT_DEADLINE_MS = 25_000;

export type FeedFetchOptions = {
  maxFeeds?: number;
  maxProductsPerFeed?: number;
  timeoutPerFeedMs?: number;
  deadlineMs?: number;
};

/** Match a single element value, tolerating optional "g:" prefix, CDATA
 *  wrappers, and whitespace/newlines inside the value (common in real feeds). */
function extractTagValue(xml: string, tag: string): string | null {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cdata = xml.match(
    new RegExp(`<(?:g:)?${escaped}(?:[^>]*)>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</(?:g:)?${escaped}>`),
  );
  if (cdata) return cdata[1].trim();
  const plain = xml.match(
    new RegExp(`<(?:g:)?${escaped}(?:[^>]*)>([^<]*)</(?:g:)?${escaped}>`),
  );
  if (plain) return plain[1].trim();
  return null;
}

function extractTag(xml: string, tag: string): string | null {
  // Try g: namespace first (Google Merchant format), then plain tag.
  return extractTagValue(xml, `g:${tag}`) ?? extractTagValue(xml, tag);
}

/** Pull the first image URL out of a raw description's embedded <img>. */
function imageFromDescription(description: string): string | null {
  if (!description) return null;
  const m = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1].trim() : null;
}

/**
 * Extract a product image from a parsed offer element, trying every standard
 * Admitad feed image tag: Google Merchant (image_link, additional_image_link),
 * plain (image, picture, photo), then any <img> embedded in the description.
 * Returns "" when the feed genuinely carries no image (never fabricates one).
 */
function extractOfferImage(xml: string, description: string): string {
  const candidates = [
    extractTag(xml, "image_link"),
    extractTag(xml, "image"),
    extractTag(xml, "picture"),
    extractTag(xml, "photo"),
    // Google's additional_image_link can carry several space-separated URLs —
    // take the first one.
    extractTag(xml, "additional_image_link")?.split(/\s+/)[0],
    imageFromDescription(description),
  ];
  for (const c of candidates) {
    if (c && /^https?:\/\//i.test(c)) return c;
  }
  return "";
}

function parsePriceValue(raw: string): number | null {
  if (!raw) return null;
  const num = parseFloat(raw.replace(/[^\d.]/g, ""));
  return isNaN(num) || num <= 0 ? null : num;
}

function parseOfferElement(xml: string): AdmitadFeedOffer | null {
  let id: string | null = null;
  let name: string | null = null;
  let priceStr: string | null = null;
  let oldpriceStr: string | null = null;
  let currencyId: string | null = null;
  let url: string | null = null;
  let image: string | null = null;
  let vendor: string | null = null;
  let description: string | null = null;
  let modified_time: string | null = null;

  const offerMatch = xml.match(/<offer\s+id="(\d+)"/);
  if (offerMatch) {
    id = offerMatch[1];
    name = extractTag(xml, "name");
    priceStr = extractTag(xml, "price");
    oldpriceStr = extractTag(xml, "oldprice");
    currencyId = extractTag(xml, "currencyId");
    url = extractTag(xml, "url");
    vendor = extractTag(xml, "vendor");
    description = extractTag(xml, "description");
    modified_time = extractTag(xml, "modified_time");
    // Feeds vary between <g:image_link>, <image>, <picture>, <photo> and
    // <g:additional_image_link> (see extractOfferImage). Recover the first
    // real image the feed provides — never fabricate one.
    image = extractOfferImage(xml, description ?? "");
  } else {
    id = extractTag(xml, "id");
    name = extractTag(xml, "title");
    priceStr = extractTag(xml, "price");
    url = extractTag(xml, "link");
    description = extractTag(xml, "description");
    image = extractOfferImage(xml, description ?? "");
    const priceMatch = priceStr?.match(/([A-Z]{3})$/);
    currencyId = priceMatch ? priceMatch[1] : "USD";
  }

  if (!id || !name || !priceStr) return null;
  const price = parsePriceValue(priceStr);
  if (!price) return null;
  const oldprice = oldpriceStr && oldpriceStr !== "None" ? parsePriceValue(oldpriceStr) : null;

  return {
    id,
    name: decodeXmlEntities(name),
    price,
    oldprice: oldprice && !isNaN(oldprice) ? oldprice : null,
    currencyId: currencyId || "USD",
    description: description ? decodeXmlEntities(description) : "",
    vendor: vendor && vendor !== "None" ? decodeXmlEntities(vendor) : "",
    url: url ? decodeXmlEntities(url) : "",
    image: image ? decodeXmlEntities(image) : "",
    modified_time: modified_time || "",
  };
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Streaming XML fetch with EARLY EXIT: stops reading (and downloading) as soon
 * as maxOffers offers have been parsed, and returns partial data when the
 * request times out mid-stream. Partial data is still real provider data.
 */
async function fetchFeedFromUrl(
  feedUrl: string,
  opts: { timeoutMs?: number; maxOffers?: number } = {},
): Promise<AdmitadFeedOffer[]> {
  const { timeoutMs = 30_000, maxOffers = Infinity } = opts;

  const response = await fetch(feedUrl, {
    headers: { "User-Agent": "ZorinoBot/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Admitad feed HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Admitad feed: response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const offers = new Map<string, AdmitadFeedOffer>();
  let buffer = "";

  const consumeBuffer = () => {
    const offerRegex = /<(?:offer\s+id="\d+"[^>]*|entry)>[\s\S]*?<\/(?:offer|entry)>/g;
    let match;
    while ((match = offerRegex.exec(buffer)) !== null) {
      const offer = parseOfferElement(match[0]);
      if (offer && !offers.has(offer.id)) {
        offers.set(offer.id, offer);
      }
    }
    const lastIncomplete = Math.max(
      buffer.lastIndexOf("<offer"),
      buffer.lastIndexOf("<entry"),
    );
    buffer = lastIncomplete > 0 ? buffer.slice(lastIncomplete) : "";
  };

  try {
    for (;;) {
      if (offers.size >= maxOffers) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      consumeBuffer();
    }
  } catch (err) {
    console.warn(
      `[admitad] feed stream interrupted after ${offers.size} offers:`,
      err instanceof Error ? err.message : err,
    );
  } finally {
    try {
      await reader.cancel();
    } catch {
      // reader already closed
    }
  }

  return Array.from(offers.values()).slice(0, maxOffers);
}

/**
 * Bounded multi-feed fetch shared by the live catalog pre-warm and the search
 * connector. Uses ONLY discovered merchant-program feeds (real program data).
 * Each feed is capped at maxProductsPerFeed and the whole run respects a wall
 * clock deadline so pages stay responsive even on a cold cache.
 */
export async function fetchAdmitadFeedProducts(
  options: FeedFetchOptions = {},
): Promise<
  { offers: AdmitadFeedOffer[]; feedName: string; feedSlug: string }[]
> {
  const maxFeeds = options.maxFeeds ?? DEFAULT_MAX_FEEDS;
  const maxProductsPerFeed =
    options.maxProductsPerFeed ?? DEFAULT_MAX_PRODUCTS_PER_FEED;
  const timeoutPerFeedMs = options.timeoutPerFeedMs ?? DEFAULT_TIMEOUT_PER_FEED_MS;
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const startedAt = Date.now();

  const results: {
    offers: AdmitadFeedOffer[];
    feedName: string;
    feedSlug: string;
  }[] = [];

  // Real-data only: discovered merchant programs exclusively. When discovery
  // is unavailable this returns [] and the DB catalog still supplies items.
  const feeds = await getAllAdmitadFeeds();

  for (const feed of feeds.slice(0, maxFeeds)) {
    if (results.length > 0 && Date.now() - startedAt > deadlineMs) {
      console.log(
        `[admitad] catalog feed budget reached (${Date.now() - startedAt}ms) — skipping remaining feeds`,
      );
      break;
    }

    const cached = feedCache.get(feed.slug);
    if (cached && Date.now() - cached.fetchedAt < FEED_CACHE_TTL_MS) {
      results.push({
        offers: cached.offers,
        feedName: feed.name,
        feedSlug: feed.slug,
      });
      continue;
    }

    try {
      console.log(
        `[admitad] fetching feed "${feed.name}" from URL (budget ${maxProductsPerFeed})...`,
      );
      const capped = await fetchFeedFromUrl(feed.feedUrl, {
        timeoutMs: timeoutPerFeedMs,
        maxOffers: maxProductsPerFeed,
      });
      console.log(`[admitad] feed "${feed.name}": ${capped.length} products`);

      feedCache.set(feed.slug, { offers: capped, fetchedAt: Date.now() });
      results.push({ offers: capped, feedName: feed.name, feedSlug: feed.slug });
    } catch (error) {
      console.error(
        `[admitad] feed "${feed.name}" fetch failed:`,
        error instanceof Error ? error.message : error,
      );
      // Real-data only: never fall back to mock products. A failed feed is
      // skipped; remaining feeds and the database catalog still supply items.
    }
  }

  return results;
}
