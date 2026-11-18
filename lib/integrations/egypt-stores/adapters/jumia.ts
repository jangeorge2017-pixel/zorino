import { fetchTextSafely } from "@/lib/integrations/egypt-stores/http";
import {
  cleanTitle,
  discountPercent,
  getAttribute,
  parseMoney,
  resolveUrl,
  stripTags,
} from "@/lib/integrations/egypt-stores/parse";
import { maxPagesFor, type StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import type { RawProviderListing } from "@/lib/search/types";

const BASE_URL = "https://www.jumia.com.eg";
const STATIC_BASE_URL = "https://static.jumia.com.eg";
const SLP_SITEMAP_URL = `${BASE_URL}/slp/nc/sitemap/sitemap-en-1.xml`;
const STORE_NAME = "Jumia";
const REQUEST_TIMEOUT_MS = 7_500;
const CATEGORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Jumia serves the same public catalog HTML to browser user agents. A desktop
// Chrome UA is the most reliably accepted; the mobile UA is the second attempt
// for the `/catalog/?q=` search endpoint (which datacenter clients otherwise
// see blocked). Both are real browser identities, never a search-engine bot.
const JUMIA_DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const JUMIA_MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

function buildJumiaHeaders(userAgent: string): Record<string, string> {
  return {
    "user-agent": userAgent,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-EG,en;q=0.9,ar-EG;q=0.8",
    referer: `${BASE_URL}/`,
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "upgrade-insecure-requests": "1",
  };
}

const JUMIA_HEADERS = buildJumiaHeaders(JUMIA_DESKTOP_USER_AGENT);
const JUMIA_MOBILE_HEADERS = buildJumiaHeaders(JUMIA_MOBILE_USER_AGENT);
// Product cards sit near the top of Jumia listing pages. A bounded range
// keeps the request under the engine's 8s provider budget on slow networks.
const JUMIA_PAGE_HEADERS: Record<string, string> = {
  ...JUMIA_HEADERS,
  range: "bytes=0-500000",
  "accept-encoding": "identity",
};

function parseArticle(block: string): RawProviderListing | null {
  const linkMatch = /<a\b[^>]*class="[^"]*\bcore\b[^"]*"[^>]*>/i.exec(block);
  const linkTag = linkMatch?.[0] ?? "";
  const href = getAttribute(linkTag, "href");
  const productUrl = resolveUrl(href, BASE_URL);
  if (!productUrl) return null;

  const externalId = (
    getAttribute(linkTag, "data-gtm-id") ??
    getAttribute(block, "data-sku") ??
    getAttribute(block, "data-gtm-id") ??
    ""
  ).trim();
  const title = cleanTitle(
    getAttribute(linkTag, "data-gtm-name") ??
      getAttribute(block, "data-gtm-name") ??
      stripTags(block.match(/<h3\b[^>]*class="[^"]*\bname\b[^"]*"[^>]*>[\s\S]*?<\/h3>/i)?.[0] ?? ""),
  );
  const price = parseMoney(
    getAttribute(linkTag, "data-gtm-price") ?? getAttribute(block, "data-gtm-price"),
  );
  if (!externalId || !title || !price) return null;

  const imageUrl = resolveUrl(getAttribute(block, "data-moengage-product_image"), BASE_URL);
  if (!imageUrl) return null;

  const discountValue = parseMoney(
    getAttribute(linkTag, "data-ga4-discount") ?? getAttribute(block, "data-ga4-discount"),
  );
  const originalPrice = discountValue > 0 ? price + discountValue : price;
  const category = (
    getAttribute(linkTag, "data-gtm-category") ??
    getAttribute(block, "data-gtm-category") ??
    ""
  )
    .split("/")[0]
    ?.trim();

  return {
    providerId: "jumia",
    externalId,
    title,
    imageUrl,
    price,
    originalPrice,
    discount: discountPercent(price, originalPrice),
    currency: "EGP",
    storeName: STORE_NAME,
    category: category ?? "",
    rating: 0,
    reviewCount: 0,
    inStock: !/\bout of stock\b|not available/i.test(block),
    productUrl,
    countryCode: "EG",
  };
}

export function parseJumiaHtml(html: string): RawProviderListing[] {
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();
  const articlePattern = /<article\b[^>]*class="[^"]*\bprd\b[^"]*"[^>]*>[\s\S]*?<\/article>/gi;

  for (const match of html.matchAll(articlePattern)) {
    const item = parseArticle(match[0]);
    if (!item || seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    results.push(item);
  }

  return results;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectProductNodes(node: unknown, out: JsonRecord[]): void {
  if (Array.isArray(node)) {
    for (const entry of node) collectProductNodes(entry, out);
    return;
  }
  if (!isRecord(node)) return;

  const type = node["@type"];
  const isProduct =
    type === "Product" ||
    (Array.isArray(type) && type.some((entry) => entry === "Product"));
  if (isProduct) out.push(node);

  for (const value of Object.values(node)) {
    if (typeof value === "object" && value !== null) collectProductNodes(value, out);
  }
}

function firstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstString(entry);
      if (found) return found;
    }
  }
  if (isRecord(value)) {
    return (
      firstString(value.contentUrl) ||
      firstString(value.thumbnailUrl) ||
      firstString(value.url) ||
      ""
    );
  }
  return "";
}

function numericValue(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  if (typeof value === "string") return parseMoney(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = numericValue(entry);
      if (found > 0) return found;
    }
  }
  return 0;
}

function externalIdFromUrl(productUrl: string): string {
  try {
    const path = new URL(productUrl).pathname;
    const file = path.split("/").filter(Boolean).pop() ?? "";
    return file.replace(/\.html$/i, "");
  } catch {
    return "";
  }
}

export function parseJumiaJsonLd(html: string): RawProviderListing[] {
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();
  const scriptPattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      continue;
    }

    const nodes: JsonRecord[] = [];
    collectProductNodes(parsed, nodes);

    for (const node of nodes) {
      const title = cleanTitle(firstString(node.name));
      const productUrl = resolveUrl(firstString(node.url), BASE_URL);
      if (!title || !productUrl) continue;

      const externalId = externalIdFromUrl(productUrl);
      if (!externalId || seen.has(externalId)) continue;

      const offersNode = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      const offers = isRecord(offersNode) ? offersNode : {};
      const price = numericValue(offers.price);
      if (!price) continue;

      const imageUrl = resolveUrl(firstString(node.image), BASE_URL);
      if (!imageUrl) continue;

      const availability = firstString(offers.availability).toLowerCase();
      const ratingNode = isRecord(node.aggregateRating) ? node.aggregateRating : {};
      const rating = numericValue(ratingNode.ratingValue);
      const reviewCount = Math.round(numericValue(ratingNode.ratingCount));

      seen.add(externalId);
      results.push({
        providerId: "jumia",
        externalId,
        title,
        imageUrl,
        price,
        originalPrice: price,
        discount: 0,
        currency: firstString(offers.priceCurrency) || "EGP",
        storeName: STORE_NAME,
        category: firstString(node.category),
        rating,
        reviewCount,
        inStock: !availability || availability.includes("instock"),
        productUrl,
        countryCode: "EG",
      });
    }
  }

  return results;
}

/** Parse HTML cards first, then fill any gaps from the page JSON-LD. */
export function parseJumiaPage(html: string): RawProviderListing[] {
  const results = parseJumiaHtml(html);
  const seenUrls = new Set(results.map((item) => item.productUrl));
  for (const item of parseJumiaJsonLd(html)) {
    if (seenUrls.has(item.productUrl)) continue;
    seenUrls.add(item.productUrl);
    results.push(item);
  }
  return results;
}

function slugifyQuery(query: string): string {
  return query
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugCandidates(query: string): string[] {
  const base = slugifyQuery(query);
  if (!base) return [];
  const variants = new Set([base]);
  if (base.endsWith("s")) variants.add(base.slice(0, -1));
  else variants.add(`${base}s`);
  return Array.from(variants).slice(0, 3);
}

async function fetchListingsFromUrl(
  url: string,
  timeoutMs: number,
  headers: Record<string, string> = JUMIA_PAGE_HEADERS,
): Promise<RawProviderListing[]> {
  const html = await fetchTextSafely(url, { timeoutMs, headers });
  return html ? parseJumiaPage(html) : [];
}

/** Fetch candidate pages in parallel and return the first non-empty set. */
async function firstWithResults(
  urls: readonly string[],
  deadline: number,
  requestedTimeoutMs: number,
  headers: Record<string, string> = JUMIA_PAGE_HEADERS,
): Promise<RawProviderListing[]> {
  const remaining = deadline - Date.now();
  if (remaining <= 0 || urls.length === 0) return [];
  const timeoutMs = Math.max(800, Math.min(requestedTimeoutMs, remaining));
  const pages = await Promise.all(
    urls.map((url) => fetchListingsFromUrl(url, timeoutMs, headers)),
  );
  return pages.find((items) => items.length > 0) ?? [];
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "best",
  "buy",
  "for",
  "in",
  "of",
  "on",
  "online",
  "price",
  "prices",
  "shop",
  "the",
  "to",
  "with",
]);

const ACCESSORY_WORDS =
  /(accessor|part|case|cover|cable|adapter|replacement|charger|holder|stand|skin|sticker|bag|sleeve|protector|screen|battery|mount|strap)/;

function stem(word: string): string {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

function queryTokens(query: string): string[] {
  return slugifyQuery(query)
    .split("-")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(stem);
}

// Small built-in fallback so broad queries still resolve when the large
// category sitemap is slow or unavailable from the current network.
const DEFAULT_CATEGORY_URLS = [
  `${BASE_URL}/electronics-earbud-headphones/`,
  `${BASE_URL}/phones-tablets/`,
  `${BASE_URL}/electronics/`,
  `${BASE_URL}/laptops/`,
  `${BASE_URL}/air-fryers/`,
  `${BASE_URL}/washing-machines/`,
  `${BASE_URL}/televisions/`,
  `${BASE_URL}/home-kitchen/`,
  `${BASE_URL}/health-beauty/`,
  `${BASE_URL}/vitamins-supplements/`,
  `${BASE_URL}/sports-outdoors/`,
];

let categoryCache: { urls: string[]; expiresAt: number } | null = null;
let slpCache: { urls: string[]; expiresAt: number } | null = null;

async function loadSlpUrls(timeoutMs: number): Promise<string[]> {
  if (slpCache && slpCache.expiresAt > Date.now()) {
    return slpCache.urls;
  }
  try {
    const response = await fetch(SLP_SITEMAP_URL, {
      headers: JUMIA_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return slpCache?.urls ?? [];
    const xml = await response.text();
    const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi))
      .map((match) => match[1].trim())
      .filter(
        (url) =>
          url.startsWith(`${BASE_URL}/slp/`) &&
          !url.includes("/ar/") &&
          !url.includes("/sp-"),
      );
    slpCache = { urls, expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS };
    return urls;
  } catch {
    return slpCache?.urls ?? [];
  }
}

async function fetchGzipTextSafely(
  url: string,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { ...JUMIA_HEADERS, accept: "application/xml,text/xml,*/*;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const stream = new Blob([buffer])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  } catch {
    return null;
  }
}

async function loadCategoryUrls(timeoutMs: number): Promise<string[]> {
  if (categoryCache && categoryCache.expiresAt > Date.now()) {
    return categoryCache.urls;
  }
  const xml = await fetchGzipTextSafely(
    `${STATIC_BASE_URL}/categories-sitemap.xml.gz`,
    timeoutMs,
  );
  if (!xml) return categoryCache?.urls ?? DEFAULT_CATEGORY_URLS;

  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi))
    .map((match) => match[1].trim())
    .filter(
      (url) =>
        url.startsWith(`${BASE_URL}/`) &&
        !url.includes("/ar/") &&
        !url.includes("/sp-") &&
        !/\.html?$/i.test(url),
    );
  categoryCache = { urls, expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS };
  return urls;
}

function scoreCategoryUrl(url: string, tokens: readonly string[]): number {
  const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
  const segments = path.split("/").filter(Boolean);
  const slug = segments[segments.length - 1] ?? "";
  const parts = slug.split("-").map(stem);
  if (!slug) return Number.POSITIVE_INFINITY;

  let score = 0;
  let matches = 0;
  for (const [index, token] of tokens.entries()) {
    // The trailing token is usually the product noun ("earbuds", "fryer",
    // "machine"), so it should outweigh descriptive words like "wireless".
    const weight = index === tokens.length - 1 ? 2 : 1;
    if (parts.includes(token)) {
      score -= 20 * weight;
      matches += 1;
    } else if (
      parts.some(
        (part) =>
          part.length >= 4 &&
          (part.startsWith(token) || token.startsWith(part)),
      )
    ) {
      score -= 12 * weight;
      matches += 1;
    } else {
      score += 25 * weight;
    }
  }
  if (matches === 0) return Number.POSITIVE_INFINITY;
  if (ACCESSORY_WORDS.test(slug)) score += 60;
  score += Math.max(0, segments.length - 1) * 3;
  score += slug.length * 0.02;
  return score;
}

function rankCategoryUrls(
  query: string,
  urls: readonly string[],
): string[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  return urls
    .map((url) => ({ url, score: scoreCategoryUrl(url, tokens) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((entry) => entry.url);
}

function titleMatches(item: RawProviderListing, token: string): boolean {
  const title = item.title.toLowerCase();
  return title.includes(token) || title.includes(`${token}s`);
}

function filterByQuery(
  listings: readonly RawProviderListing[],
  query: string,
): RawProviderListing[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [...listings];
  const all = listings.filter((item) =>
    tokens.every((token) => titleMatches(item, token)),
  );
  if (all.length > 0) return all;
  return listings.filter((item) =>
    tokens.some((token) => titleMatches(item, token)),
  );
}

function dedupeListings(
  listings: readonly RawProviderListing[],
): RawProviderListing[] {
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();
  for (const item of listings) {
    const key = item.externalId || item.productUrl;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item);
  }
  return results;
}

/**
 * Primary strategy: Jumia's own search listing at `/catalog/?q=`.
 *
 * The page carries the same `<article class="prd">` cards as every other
 * Jumia listing view (SKU, title, EGP price, image), so the existing parsers
 * handle it unchanged. We try the desktop and mobile browser identities in
 * parallel because the endpoint is the one most aggressively filtered for
 * datacenter clients.
 */
async function searchJumiaCatalog(
  query: string,
  deadline: number,
): Promise<RawProviderListing[]> {
  const catalogUrl = `${BASE_URL}/catalog/?q=${encodeURIComponent(query)}`;
  const desktop = await firstWithResults(
    [catalogUrl],
    deadline,
    5_500,
    JUMIA_PAGE_HEADERS,
  );
  if (desktop.length > 0) return desktop;

  return firstWithResults([catalogUrl], deadline, 5_500, JUMIA_MOBILE_HEADERS);
}

/**
 * Secondary SEO paths: `/slp/<query>/` search pages and canonical category
 * pages. These are the allowed crawl paths and stay as a fallback when the
 * catalog endpoint is blocked or throttled.
 */
async function searchJumiaSlp(
  query: string,
  deadline: number,
): Promise<RawProviderListing[]> {
  const urls = slugCandidates(query)
    .slice(0, 2)
    .map((slug) => `${BASE_URL}/slp/${encodeURIComponent(slug)}/`);
  const sitemapPromise = loadSlpUrls(
    Math.max(800, Math.min(4_500, deadline - Date.now())),
  );
  const directResults = await firstWithResults(urls, deadline, 4_500);
  if (directResults.length > 0) return directResults;

  const slpUrls = await sitemapPromise;
  const ranked = rankCategoryUrls(query, slpUrls).slice(0, 2);
  return firstWithResults(ranked, deadline, 4_500);
}

async function searchJumiaCategory(
  query: string,
  deadline: number,
): Promise<RawProviderListing[]> {
  const direct = slugCandidates(query)
    .slice(0, 2)
    .map((slug) => `${BASE_URL}/${encodeURIComponent(slug)}/`);
  const directPromise = firstWithResults(direct, deadline, 6_500);
  const categoriesPromise = loadCategoryUrls(
    Math.max(800, Math.min(4_000, deadline - Date.now())),
  );

  const directResults = await directPromise;
  if (directResults.length > 0) {
    return filterByQuery(directResults, query);
  }

  const categoryUrls = await categoriesPromise;
  const ranked = rankCategoryUrls(
    query,
    Array.from(new Set([...categoryUrls, ...DEFAULT_CATEGORY_URLS])),
  ).slice(0, 2);
  return filterByQuery(await firstWithResults(ranked, deadline, 5_000), query);
}

async function searchJumiaStaticHomepage(
  query: string,
  deadline: number,
): Promise<RawProviderListing[]> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return [];
  const html = await fetchTextSafely(`${STATIC_BASE_URL}/`, {
    timeoutMs: Math.max(800, Math.min(4_500, remaining)),
    headers: { ...JUMIA_PAGE_HEADERS, referer: `${STATIC_BASE_URL}/` },
  });
  if (!html) return [];
  return filterByQuery(parseJumiaPage(html), query);
}

/** Decode the `u=a1<base64url>` target Bing wraps outbound result links in. */
function decodeBingRedirect(parsed: URL): string | null {
  const u = parsed.searchParams.get("u");
  if (!u || !u.startsWith("a1")) return null;
  try {
    const base64 = u.slice(2).replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function isJumiaProductUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host !== "jumia.com.eg" && !host.endsWith(".jumia.com.eg")) return false;
  if (!/\.html?$/i.test(url.pathname)) return false;
  if (/\/(catalog|slp|ar|sp-)/i.test(url.pathname)) return false;
  return true;
}

/** Pull native Jumia product URLs out of a search-engine result page. */
export function extractJumiaProductUrlsFromSearchHtml(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const raw = match[1].replace(/&amp;/g, "&");
    const absolute = raw.startsWith("//") ? `https:${raw}` : raw;
    try {
      const parsed = new URL(absolute, "https://www.bing.com");
      const host = parsed.hostname.toLowerCase();

      let target: string | null = null;
      if (host === "duckduckgo.com" || host.endsWith(".duckduckgo.com")) {
        target = parsed.searchParams.get("uddg") ?? parsed.searchParams.get("u");
      } else if (host === "bing.com" || host.endsWith(".bing.com")) {
        target = decodeBingRedirect(parsed);
      } else {
        target = parsed.toString();
      }
      if (!target) continue;

      const productUrl = new URL(target);
      if (!isJumiaProductUrl(productUrl)) continue;
      productUrl.hash = "";
      urls.add(productUrl.toString());
    } catch {
      // Relative/malformed result links are not product candidates.
    }
  }
  return Array.from(urls);
}

function searchEngineUrls(query: string): string[] {
  const scoped = encodeURIComponent(`site:jumia.com.eg ${query}`);
  return [
    `https://html.duckduckgo.com/html/?q=${scoped}`,
    `https://www.bing.com/search?q=${scoped}&setlang=en&count=20`,
  ];
}

/**
 * Cloud-bypass fallback: discover Jumia product pages through a search-engine
 * index (`site:jumia.com.eg <query>`), then hydrate each page with the normal
 * listing/JSON-LD parsers. This is only used when every direct listing path is
 * unreachable, and it never fabricates a product: pages without a real EGP
 * price and image are dropped by the parsers.
 */
async function searchJumiaSearchEngine(
  query: string,
  deadline: number,
): Promise<RawProviderListing[]> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return [];

  const engineTimeout = Math.max(800, Math.min(4_500, remaining));
  const htmls = await Promise.all(
    searchEngineUrls(query).map((url) =>
      fetchTextSafely(url, { timeoutMs: engineTimeout, headers: JUMIA_HEADERS }),
    ),
  );

  const productUrls = Array.from(
    new Set(
      htmls.flatMap((html) =>
        html ? extractJumiaProductUrlsFromSearchHtml(html) : [],
      ),
    ),
  ).slice(0, 6);
  if (productUrls.length === 0) return [];

  const enrichRemaining = deadline - Date.now();
  if (enrichRemaining <= 0) return [];
  const enrichTimeout = Math.max(800, Math.min(4_000, enrichRemaining));
  const pages = await Promise.all(
    productUrls.map((url) => fetchListingsFromUrl(url, enrichTimeout)),
  );
  return filterByQuery(dedupeListings(pages.flat()), query);
}

export const jumiaAdapter: StoreSearchAdapter = {
  id: "jumia",
  name: STORE_NAME,
  async search(query, options) {
    const maxResults = maxPagesFor(options, 2) * 40;
    const deadline = Date.now() + REQUEST_TIMEOUT_MS;
    const trimmed = query.trim();
    if (!trimmed) return [];

    const catalogResults = await searchJumiaCatalog(trimmed, deadline);
    if (catalogResults.length > 0) {
      return dedupeListings(catalogResults).slice(0, maxResults);
    }

    const slpResults = await searchJumiaSlp(trimmed, deadline);
    if (slpResults.length > 0) {
      return dedupeListings(slpResults).slice(0, maxResults);
    }

    const categoryResults = await searchJumiaCategory(trimmed, deadline);
    if (categoryResults.length > 0) {
      return dedupeListings(categoryResults).slice(0, maxResults);
    }

    const staticResults = await searchJumiaStaticHomepage(trimmed, deadline);
    if (staticResults.length > 0) {
      return dedupeListings(staticResults).slice(0, maxResults);
    }

    const indexedResults = await searchJumiaSearchEngine(trimmed, deadline);
    return dedupeListings(indexedResults).slice(0, maxResults);
  },
};


