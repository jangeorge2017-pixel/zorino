import { isUsableRemoteProductImageUrl } from "@/lib/images/product-image";
import {
  cleanTitle,
  decodeHtmlEntities,
  getAttribute,
  parseMoney,
  resolveUrl,
} from "@/lib/integrations/egypt-stores/parse";
import type { ScraperStoreConfig, ScrapedListing } from "@/lib/sync/scraper/types";

type Candidate = {
  title?: unknown;
  price?: unknown;
  image?: unknown;
  url?: unknown;
  id?: unknown;
  category?: unknown;
  originalPrice?: unknown;
  currency?: unknown;
  rating?: unknown;
  reviewCount?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function asText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  const record = asRecord(value);
  if (record) {
    for (const key of ["value", "@value", "amount", "current", "raw", "name", "text"]) {
      const nested = record[key];
      if (typeof nested === "string" || typeof nested === "number") return String(nested).trim();
    }
  }
  return "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  const record = asRecord(value);
  if (record) {
    for (const key of ["value", "amount", "current", "raw", "minPrice"]) {
      const nested = record[key];
      if (nested !== undefined && nested !== null) return parseMoney(asText(nested));
    }
  }
  return parseMoney(asText(value));
}

function asImage(value: unknown): string {
  if (Array.isArray(value)) return asImage(value[0]);
  const record = asRecord(value);
  if (record) return asText(firstValue(record, ["url", "src", "contentUrl", "thumbnailUrl", "imageUrl"]));
  return asText(value);
}

function normalizeImageUrl(value: unknown): string {
  let url = decodeHtmlEntities(asImage(value))
    .replace(/\\+\//g, "/")
    .replace(/\s+/g, "")
    .trim();
  if (url.startsWith("//")) url = `https:${url}`;
  if (/^http:\/\//i.test(url)) url = `https://${url.slice(7)}`;
  if (!/^https:\/\//i.test(url)) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || /\.svg($|\?)/i.test(parsed.pathname)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function hashId(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `s${(hash >>> 0).toString(36)}`;
}

function isStoreHost(url: string, host: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === host || hostname.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

function candidateFromObject(record: Record<string, unknown>): Candidate {
  const offers = asRecord(firstValue(record, ["offers", "offer"])) ?? {};
  const priceSpec = asRecord(firstValue(offers, ["priceSpecification"])) ?? {};
  const aggregateRating = asRecord(firstValue(record, ["aggregateRating"])) ?? {};
  return {
    title: firstValue(record, ["name", "title", "productName"]),
    price:
      firstValue(record, ["price"]) ??
      firstValue(offers, ["price", "lowPrice", "currentPrice", "salePrice"]) ??
      firstValue(priceSpec, ["price", "value"]),
    originalPrice:
      firstValue(record, ["originalPrice", "oldPrice"]) ??
      firstValue(offers, ["highPrice", "originalPrice", "regularPrice"]),
    image:
      firstValue(record, ["image", "images", "imageUrl", "thumbnail"]) ??
      firstValue(offers, ["image"]),
    url: firstValue(record, ["url", "link", "productUrl"]) ?? firstValue(offers, ["url"]),
    id: firstValue(record, ["sku", "productID", "productId", "id", "@id"]),
    category: firstValue(record, ["category", "categoryName"]),
    currency:
      firstValue(record, ["priceCurrency", "currency"]) ??
      firstValue(offers, ["priceCurrency", "currency"]),
    rating: firstValue(aggregateRating, ["ratingValue", "rating"]),
    reviewCount: firstValue(aggregateRating, ["reviewCount", "ratingCount"]),
  };
}

function walkJson(node: unknown, out: Candidate[], depth: number): void {
  if (depth > 10 || out.length > 600) return;
  if (Array.isArray(node)) {
    for (const child of node) walkJson(child, out, depth + 1);
    return;
  }
  const record = asRecord(node);
  if (!record) return;

  const type = asText(firstValue(record, ["@type"])).toLowerCase();
  const isProduct = type.includes("product") || type.includes("offer");
  const hasProductShape = Boolean(
    firstValue(record, ["name", "title"]) &&
      firstValue(record, ["price", "offers", "offer", "image", "images"]),
  );
  if (isProduct || hasProductShape) out.push(candidateFromObject(record));

  for (const key of [
    "@graph",
    "itemListElement",
    "item",
    "mainEntity",
    "products",
    "items",
    "results",
    "searchResults",
    "data",
    "pageProps",
    "initialState",
    "props",
    "list",
    "rows",
  ]) {
    const child = firstValue(record, [key]);
    if (child) walkJson(child, out, depth + 1);
  }
}

function extractStructuredCandidates(html: string): Candidate[] {
  const out: Candidate[] = [];
  const jsonLd = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLd.exec(html)) !== null) {
    try {
      const payload = match[1].replace(/^\s*\/\/<!\[CDATA\[|\]\]>\s*$/g, "");
      walkJson(JSON.parse(payload), out, 0);
    } catch {
      continue;
    }
  }

  const nextData = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (nextData) {
    try {
      walkJson(JSON.parse(nextData[1]), out, 0);
    } catch {}
  }
  return out;
}

function extractDomCandidates(html: string, config: ScraperStoreConfig): Candidate[] {
  const out: Candidate[] = [];
  const anchors = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]{0,4000}?)<\/a>/gi;
  let match: RegExpExecArray | null;
  let seen = 0;
  while ((match = anchors.exec(html)) !== null && seen < 800) {
    seen += 1;
    const productUrl = resolveUrl(match[1] ?? match[2] ?? match[3] ?? "", config.origin);
    if (!productUrl || !isStoreHost(productUrl, config.host)) continue;

    const chunk = match[4] ?? "";
    const imageTag = /<img\b[^>]*>/i.exec(chunk)?.[0] ?? "";
    const srcset = getAttribute(imageTag, "srcset")?.trim().split(/\s+/)[0];
    const image =
      getAttribute(imageTag, "data-src") ??
      getAttribute(imageTag, "src") ??
      getAttribute(imageTag, "data-lazy-src") ??
      srcset ??
      "";
    const text = cleanTitle(chunk.replace(/<[^>]*>/g, " ")).slice(0, 200);
    const priceMatch =
      /(?:EGP|E£|LE|£|\$|USD)\s*([\d,.]+)/i.exec(text) ??
      /\b([\d,.]+)\s*(?:EGP|E£|LE|USD)/i.exec(text);
    const dataPrice = getAttribute(chunk, "data-price") ?? getAttribute(chunk, "data-price-amount");

    out.push({
      title: getAttribute(imageTag, "alt") || text || undefined,
      price: dataPrice ?? priceMatch?.[1] ?? undefined,
      image,
      url: productUrl,
      id:
        getAttribute(match[0], "data-asin") ??
        getAttribute(match[0], "data-product-id") ??
        getAttribute(match[0], "data-id") ??
        undefined,
      category: "",
    });
  }
  return out;
}

function finalizeCandidate(candidate: Candidate, config: ScraperStoreConfig): ScrapedListing | null {
  const title = cleanTitle(asText(candidate.title));
  if (title.length < 4 || title.length > 300) return null;

  const productUrl = resolveUrl(asText(candidate.url), config.origin);
  if (!productUrl || !isStoreHost(productUrl, config.host)) return null;

  const imageUrl = normalizeImageUrl(candidate.image);
  if (!imageUrl || !isUsableRemoteProductImageUrl(imageUrl)) return null;

  const price = asNumber(candidate.price);
  if (price <= 0) return null;

  const rawCurrency = asText(candidate.currency).toUpperCase();
  const currency = /^(EGP|USD|EUR|GBP|SAR|AED)$/.test(rawCurrency) ? rawCurrency : config.currency;
  const originalPrice = asNumber(candidate.originalPrice);
  const rating = asNumber(candidate.rating);
  const reviewCount = asNumber(candidate.reviewCount);

  return {
    externalId: asText(candidate.id).slice(0, 120) || hashId(productUrl),
    title,
    price,
    currency,
    imageUrl,
    productUrl,
    category: asText(candidate.category).slice(0, 120),
    originalPrice: originalPrice > price ? originalPrice : undefined,
    rating: rating > 0 ? rating : undefined,
    reviewCount: reviewCount > 0 ? reviewCount : undefined,
    inStock: true,
  };
}

export function extractScrapedListings(
  html: string,
  config: ScraperStoreConfig,
): ScrapedListing[] {
  const candidates = [
    ...extractStructuredCandidates(html),
    ...extractDomCandidates(html, config),
  ];
  const seen = new Set<string>();
  const listings: ScrapedListing[] = [];

  for (const candidate of candidates) {
    const listing = finalizeCandidate(candidate, config);
    if (!listing) continue;
    const key = listing.productUrl.split("?")[0] ?? listing.productUrl;
    if (seen.has(key)) continue;
    seen.add(key);
    listings.push(listing);
    if (listings.length >= 600) break;
  }
  return listings;
}
