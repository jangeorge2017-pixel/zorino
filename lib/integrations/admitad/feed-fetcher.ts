import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { AdmitadFeedOffer } from "./types";
import { ADMITAD_FEEDS, FEED_CACHE_TTL_MS } from "./config";
import { SEED_FEED_OFFERS } from "./seed";

type CachedFeed = {
  offers: AdmitadFeedOffer[];
  fetchedAt: number;
};

const feedCache = new Map<string, CachedFeed>();

/** Check if any feed has been loaded into memory (non-blocking). */
export function isAdmitadFeedReady(): boolean {
  for (const feed of ADMITAD_FEEDS) {
    const cached = feedCache.get(feed.slug);
    if (cached && Date.now() - cached.fetchedAt < FEED_CACHE_TTL_MS) {
      return true;
    }
  }
  return false;
}

function extractTag(xml: string, tag: string): string | null {
  // Try g: namespace first (Google Merchant format), then plain tag
  const gTag = `g:${tag}`;
  const gRegex = new RegExp(`<${gTag}>([^<]*)</${gTag}>`);
  const gMatch = xml.match(gRegex);
  if (gMatch) return gMatch[1].trim();
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
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
    image = extractTag(xml, "image");
    vendor = extractTag(xml, "vendor");
    description = extractTag(xml, "description");
    modified_time = extractTag(xml, "modified_time");
  } else {
    id = extractTag(xml, "id");
    name = extractTag(xml, "title");
    priceStr = extractTag(xml, "price");
    url = extractTag(xml, "link");
    image = extractTag(xml, "image_link");
    description = extractTag(xml, "description");
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
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function fetchFeedFromUrl(feedUrl: string): Promise<AdmitadFeedOffer[]> {
  const response = await fetch(feedUrl, {
    headers: { "User-Agent": "ZorinoBot/1.0" },
    signal: AbortSignal.timeout(25_000),
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

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const offerRegex = /<(?:offer\s+id="\d+"[^>]*|entry)>[\s\S]*?<\/(?:offer|entry)>/g;
    let match;
    while ((match = offerRegex.exec(buffer)) !== null) {
      const offer = parseOfferElement(match[0]);
      if (offer && !offers.has(offer.id)) {
        offers.set(offer.id, offer);
      }
    }

    const lastIncomplete = Math.max(buffer.lastIndexOf("<offer"), buffer.lastIndexOf("<entry"));
    if (lastIncomplete > 0) {
      buffer = buffer.slice(lastIncomplete);
    } else {
      const lastTag = buffer.lastIndexOf("<");
      buffer = lastTag > 0 ? buffer.slice(lastTag) : "";
    }
  }

  if (buffer.includes("<offer") || buffer.includes("<entry>")) {
    const flushRegex = /<(?:offer\s+id="\d+"[^>]*|entry)>[\s\S]*?<\/(?:offer|entry)>/g;
    let flushMatch;
    while ((flushMatch = flushRegex.exec(buffer)) !== null) {
      const offer = parseOfferElement(flushMatch[0]);
      if (offer && !offers.has(offer.id)) {
        offers.set(offer.id, offer);
      }
    }
  }

  return Array.from(offers.values());
}

async function fetchFeedFromDisk(filePath: string): Promise<AdmitadFeedOffer[]> {
  const content = fs.readFileSync(filePath, "utf-8");
  const offers = new Map<string, AdmitadFeedOffer>();
  const offerRegex = /<offer\s+id="\d+"[^>]*>[\s\S]*?<\/offer>/g;
  let match;
  while ((match = offerRegex.exec(content)) !== null) {
    const offer = parseOfferElement(match[0]);
    if (offer && !offers.has(offer.id)) {
      offers.set(offer.id, offer);
    }
  }
  return Array.from(offers.values());
}

export async function fetchAdmitadFeedProducts(): Promise<
  { offers: AdmitadFeedOffer[]; feedName: string; feedSlug: string }[]
> {
  const results: {
    offers: AdmitadFeedOffer[];
    feedName: string;
    feedSlug: string;
  }[] = [];

  for (const feed of ADMITAD_FEEDS) {
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
      let offers: AdmitadFeedOffer[];

      const diskPath = path.join(
        os.tmpdir(),
        `admitad-feed-${feed.slug}.xml`
      );
      if (fs.existsSync(diskPath)) {
        console.log(
          `[admitad] loading feed "${feed.name}" from disk cache: ${diskPath}`
        );
        offers = await fetchFeedFromDisk(diskPath);
      } else {
        console.log(`[admitad] fetching feed "${feed.name}" from URL...`);
        offers = await fetchFeedFromUrl(feed.feedUrl);
        console.log(
          `[admitad] feed "${feed.name}": ${offers.length} unique products`
        );
      }

      feedCache.set(feed.slug, { offers, fetchedAt: Date.now() });
      results.push({ offers, feedName: feed.name, feedSlug: feed.slug });
    } catch (error) {
      console.error(
        `[admitad] feed "${feed.name}" fetch failed:`,
        error instanceof Error ? error.message : error
      );
      // Fallback: use seed offers so the homepage always shows Alibaba products
      // even when the live feed URL is unreachable (e.g. Vercel serverless).
      if (SEED_FEED_OFFERS.length > 0) {
        console.log(
          `[admitad] using ${SEED_FEED_OFFERS.length} seed offers as fallback for "${feed.name}"`
        );
        feedCache.set(feed.slug, {
          offers: SEED_FEED_OFFERS,
          fetchedAt: Date.now(),
        });
        results.push({
          offers: SEED_FEED_OFFERS,
          feedName: feed.name,
          feedSlug: feed.slug,
        });
      }
    }
  }

  return results;
}
