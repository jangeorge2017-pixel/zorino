import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { AdmitadFeedOffer } from "./types";
import { ADMITAD_FEEDS, FEED_CACHE_TTL_MS } from "./config";

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

function parseOfferElement(xml: string): AdmitadFeedOffer | null {
  const idMatch = xml.match(/<offer\s+id="(\d+)">/);
  if (!idMatch) return null;
  const id = idMatch[1];

  const name = extractTag(xml, "name");
  const priceStr = extractTag(xml, "price");
  const oldpriceStr = extractTag(xml, "oldprice");
  const url = extractTag(xml, "url");
  const currencyId = extractTag(xml, "currencyId");
  const description = extractTag(xml, "description");
  const vendor = extractTag(xml, "vendor");
  const image = extractTag(xml, "image");
  const modified_time = extractTag(xml, "modified_time");

  if (!name || !priceStr || !url) return null;

  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) return null;

  const oldprice =
    oldpriceStr && oldpriceStr !== "None" ? parseFloat(oldpriceStr) : null;

  return {
    id,
    name: decodeXmlEntities(name),
    price,
    oldprice: oldprice && !isNaN(oldprice) ? oldprice : null,
    currencyId: currencyId || "USD",
    description: description ? decodeXmlEntities(description) : "",
    vendor: vendor && vendor !== "None" ? decodeXmlEntities(vendor) : "",
    url: decodeXmlEntities(url),
    image: image ? decodeXmlEntities(image) : "",
    modified_time: modified_time || "",
  };
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
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

    const offerRegex = /<offer\s+id="\d+">[\s\S]*?<\/offer>/g;
    let match;
    while ((match = offerRegex.exec(buffer)) !== null) {
      const offer = parseOfferElement(match[0]);
      if (offer && !offers.has(offer.id)) {
        offers.set(offer.id, offer);
      }
    }

    const lastIncomplete = buffer.lastIndexOf("<offer");
    if (lastIncomplete > 0) {
      buffer = buffer.slice(lastIncomplete);
    } else {
      const lastTag = buffer.lastIndexOf("<");
      buffer = lastTag > 0 ? buffer.slice(lastTag) : "";
    }
  }

  if (buffer.includes("<offer")) {
    const offer = parseOfferElement(buffer);
    if (offer && !offers.has(offer.id)) {
      offers.set(offer.id, offer);
    }
  }

  return Array.from(offers.values());
}

async function fetchFeedFromDisk(filePath: string): Promise<AdmitadFeedOffer[]> {
  const content = fs.readFileSync(filePath, "utf-8");
  const offers = new Map<string, AdmitadFeedOffer>();
  const offerRegex = /<offer\s+id="\d+">[\s\S]*?<\/offer>/g;
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
    }
  }

  return results;
}
