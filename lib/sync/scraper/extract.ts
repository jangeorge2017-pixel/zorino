import { isUsableRemoteProductImageUrl } from "@/lib/images/product-image";
import {
  cleanTitle,
  decodeHtmlEntities,
  getAttribute,
  resolveUrl,
} from "@/lib/integrations/egypt-stores/parse";
import { categoryForScraperQuery } from "@/lib/sync/scraper/stores";
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

function parseScraperNumber(raw: string): number {
  const normalized = raw
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\u066c/g, "")
    .replace(/\u066b/g, ".");
  const match = /([\d][\d.,\s]*)/.exec(normalized);
  if (!match) return 0;

  let compact = match[1].replace(/\s+/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    compact =
      lastComma > lastDot
        ? compact.replace(/\./g, "").replace(/,/g, ".")
        : compact.replace(/,/g, "");
  } else if (lastComma >= 0) {
    compact = /,\d{1,2}$/.test(compact)
      ? compact.replace(/\./g, "").replace(/,/g, ".")
      : compact.replace(/,/g, "");
  }

  const value = Number.parseFloat(compact);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  const record = asRecord(value);
  if (record) {
    for (const key of ["value", "amount", "current", "raw", "minPrice"]) {
      const nested = record[key];
      if (nested !== undefined && nested !== null) return parseScraperNumber(asText(nested));
    }
  }
  return parseScraperNumber(asText(value));
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

function pickSrcsetUrl(value: string | null): string {
  if (!value) return "";
  let best = "";
  let bestScore = -1;
  for (const part of value.split(",")) {
    const [rawUrl, ...descriptors] = part.trim().split(/\s+/);
    if (!rawUrl) continue;
    const descriptor = descriptors.join(" ");
    const width = /(\d+)w/i.exec(descriptor);
    const density = /(\d+(?:\.\d+)?)x/i.exec(descriptor);
    const score = width ? Number(width[1]) : density ? Number(density[1]) * 1000 : 1;
    if (score > bestScore) {
      bestScore = score;
      best = rawUrl;
    }
  }
  return best;
}

function pickImageAttribute(imageTag: string): string {
  for (const attribute of [
    "data-srcset",
    "data-lazy-srcset",
    "data-original",
    "data-src",
    "data-lazy-src",
    "srcset",
    "src",
  ]) {
    const value = getAttribute(imageTag, attribute);
    const candidate = /srcset$/i.test(attribute) ? pickSrcsetUrl(value) : value;
    if (candidate && normalizeImageUrl(candidate)) return candidate;
  }
  return "";
}

function canonicalCurrency(value: unknown, fallback: string): string {
  const raw = asText(value).toUpperCase();
  if (!raw) return fallback.toUpperCase();
  if (raw.includes("EGP") || /^(E£|LE)$/.test(raw)) return "EGP";
  if (raw.includes("USD") || raw === "$" || raw === "US$") return "USD";
  if (raw.includes("SAR")) return "SAR";
  if (raw.includes("AED")) return "AED";
  if (raw.includes("GBP") || raw === "£") return "GBP";
  if (raw.includes("EUR") || raw === "€") return "EUR";
  return raw.replace(/[^A-Z]/g, "") || fallback.toUpperCase();
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

function canonicalProductUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|gbraid$|wbraid$|ref$|refsrc$|aff_)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
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
    const sourceTag = /<source\b[^>]*>/i.exec(chunk)?.[0] ?? "";
    const image = pickImageAttribute(imageTag) || pickImageAttribute(sourceTag);
    const text = cleanTitle(chunk.replace(/<[^>]*>/g, " ")).slice(0, 200);
    const currencyToken = /(EGP|E£|\bLE\b|USD|\$|SAR|AED)/i.exec(text)?.[0] ?? "";
    const currencyPattern = "EGP|E£|\\\\bLE\\\\b|USD|\\\\$|£|SAR|AED";
    const priceMatch =
      new RegExp(`(?:${currencyPattern})\\s*([\\d,.]+)`, "i").exec(text) ??
      new RegExp(`([\\d,.]+)\\s*(?:${currencyPattern})`, "i").exec(text);
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
      currency: currencyToken || undefined,
    });
  }
  return out;
}

function finalizeCandidate(
  candidate: Candidate,
  config: ScraperStoreConfig,
  query?: string,
): ScrapedListing | null {
  const title = cleanTitle(asText(candidate.title));
  if (title.length < 4 || title.length > 300) return null;

  const resolvedUrl = resolveUrl(asText(candidate.url), config.origin);
  if (!resolvedUrl || !isStoreHost(resolvedUrl, config.host)) return null;
  const productUrl = canonicalProductUrl(resolvedUrl);

  const imageUrl = normalizeImageUrl(candidate.image);
  if (!imageUrl || !isUsableRemoteProductImageUrl(imageUrl)) return null;

  const price = asNumber(candidate.price);
  if (price <= 0) return null;

  const expectedCurrency = config.currency.toUpperCase();
  const rawCurrency = asText(candidate.currency);
  const currency = canonicalCurrency(rawCurrency, expectedCurrency);
  if (rawCurrency && currency !== expectedCurrency) return null;
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
    category: asText(candidate.category).slice(0, 120) || categoryForScraperQuery(query ?? "") || "",
    originalPrice: originalPrice > price ? originalPrice : undefined,
    rating: rating > 0 ? rating : undefined,
    reviewCount: reviewCount > 0 ? reviewCount : undefined,
    inStock: true,
  };
}

export function extractScrapedListings(
  html: string,
  config: ScraperStoreConfig,
  query?: string,
): ScrapedListing[] {
  const candidates = [
    ...extractStructuredCandidates(html),
    ...extractDomCandidates(html, config),
  ];
  const seen = new Set<string>();
  const listings: ScrapedListing[] = [];

  for (const candidate of candidates) {
    const listing = finalizeCandidate(candidate, config, query);
    if (!listing) continue;
    const key = listing.productUrl.split("?")[0] ?? listing.productUrl;
    if (seen.has(key)) continue;
    seen.add(key);
    listings.push(listing);
    if (listings.length >= 600) break;
  }
  return listings;
}
