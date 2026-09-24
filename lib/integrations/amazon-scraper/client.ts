import {
  AMAZON_SCRAPER_MARKETPLACES,
  type AmazonScraperMarketplaceKey,
  type AmazonScrapedProduct,
  type AmazonScrapedSearchResult,
} from "@/lib/integrations/amazon-scraper/config";

/**
 * Local, open-source Amazon scraper (free). Fetches the real Amazon storefront
 * HTML directly and parses the products without any third-party scraping API.
 *
 * Engine selection:
 *  - `http` (default): zero-dependency fetch with rotating user-agents + a
 *    realistic browser header set. Runs in serverless functions (Vercel).
 *  - `playwright`: opt-in for long-running/self-hosted Node backends. Uses the
 *    real Chromium engine to defeat heavier bot detection. Enabled via
 *    `AMAZON_SCRAPER_ENGINE=playwright`; falls back to `http` when the
 *    playwright package is not installed.
 *
 * Never proxies through third-party paid services — requests go straight to the
 * Amazon storefront from this backend.
 */

const SEARCH_PATH = "/s";

/**
 * Header set for the http engine. Deliberately minimal and browser-consistent:
 * the hardcoded `sec-ch-ua` brands previously went stale next to the rotating
 * UAs (Chrome/124, Chromium/123, Linux, macOS…), which is an exact bot-signal
 * datacenter IPs get flagged for (HTTP 503 `api-services-support`). Amazon
 * serves full organic results with just the plain UA + locale + accept set.
 */
const SEARCH_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
} as const;

/**
 * Rotating user-agent pool — the basic-bot-detection bypass for the http
 * engine. Restricted to recent desktop Chrome UAs: Amazon's bot scoring is
 * notably stricter on Firefox/Safari, and mixing legacy versions downranked
 * the page (empty/incomplete results).
 */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0]!;
}

/** Build the storefront search URL for a query + marketplace. */
export function buildAmazonSearchUrl(
  query: string,
  marketplace: AmazonScraperMarketplaceKey,
): string {
  const meta = AMAZON_SCRAPER_MARKETPLACES[marketplace];
  const url = new URL(`${meta.storeUrl}${SEARCH_PATH}`);
  url.searchParams.set("k", query);
  url.searchParams.set("ref", "nb_sb_noss");
  return url.toString();
}

/** Build the storefront product URL for an ASIN. */
export function buildAmazonProductUrl(
  asin: string,
  marketplace: AmazonScraperMarketplaceKey,
): string {
  const meta = AMAZON_SCRAPER_MARKETPLACES[marketplace];
  return `${meta.storeUrl}/dp/${asin}`;
}

async function fetchHtml(url: string): Promise<string> {
  const engine = process.env.AMAZON_SCRAPER_ENGINE?.trim().toLowerCase();

  // Playwright engine (opt-in). Uses the browser to defeat heavier bot
  // detection. Falls back to the http engine when playwright is unavailable.
  if (engine === "playwright") {
    try {
      const pw = await import("playwright");
      const browser = await pw.chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
      });
      try {
        const page = await browser.newPage({
          userAgent: pickUserAgent(),
          locale: "en-US",
          extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
        });
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
        const html = await page.content();
        return html;
      } finally {
        await browser.close();
      }
    } catch {
      // Playwright not installed / launch failed — fall through to http.
    }
  }

  const res = await fetch(url, {
    headers: { ...SEARCH_HEADERS, "User-Agent": pickUserAgent() },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(
      `Amazon scraper HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }

  return res.text();
}

/** Detect Amazon's AWS WAF JS challenge page (HTTP 202, non-retryable). */
function isWafChallenge(html: string): boolean {
  return (
    html.includes("aws-waf") ||
    html.includes("challenge.js") ||
    html.includes("gokuProps") ||
    html.includes("challenge-container")
  );
}

/** Decode common HTML entities in titles. */
function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, " ").trim();
}

/** Convert "$12.99", "EGP 1,234.56", "12,345" to a number. */
function parseMoney(raw: string): number {
  const cleaned = raw
    .replace(/&#x?[A-Fa-f0-9]+;/g, " ")
    .replace(/[^\d.]/g, "");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Detect the currency code from a display price like "EGP 22,524.95". */
function detectCurrency(raw: string): string | null {
  const upper = raw.toUpperCase().replace(/&[a-z]+;/g, " ");
  const m = upper.match(/(USD|EGP|GBP|EUR|AED|SAR|AUD|CAD|JPY|CNY|INR)\s*\d/);
  if (m) return m[1];
  if (raw.includes("$")) return "USD";
  if (raw.includes("£")) return "GBP";
  if (raw.includes("€")) return "EUR";
  return null;
}

type SearchResultBlock = {
  asin: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  currency: string;
  productUrl: string;
  rating: number;
  reviewCount: number;
};

function parseSinglePrice(html: string): {
  price: number;
  originalPrice: number;
  currency: string;
} {
  // Main price: the first `.a-price` block's `.a-offscreen` text.
  const offscreenPrices = [
    ...html.matchAll(/<span class="a-offscreen">([^<]+)<\/span>/g),
  ].map((m) => m[1]);

  let price = 0;
  let currency = "";
  for (const raw of offscreenPrices) {
    const value = parseMoney(raw);
    if (value > 0) {
      price = value;
      currency = detectCurrency(raw) ?? "";
      break;
    }
  }

  // Original (strikethrough) price: `.a-text-price` block if present and higher.
  let originalPrice = price;
  for (const m of html.matchAll(/<span class="a-price a-text-price[^"]*">([\s\S]*?)<\/span>/g)) {
    const inner = m[1]!;
    const raw = inner.match(/<span class="a-offscreen">([^<]+)<\/span>/)?.[1];
    if (!raw) continue;
    const value = parseMoney(raw);
    if (value > price) {
      originalPrice = value;
      currency = detectCurrency(raw) ?? currency;
      break;
    }
  }

  return { price, originalPrice, currency };
}

function parseRating(html: string): { rating: number; reviewCount: number } {
  const ratingText =
    html.match(/<span class="a-icon-alt">([0-9.]+) out of 5 stars<\/span>/)?.[1] ??
    html.match(/aria-label="([0-9.]+) out of 5 stars/)?.[1] ??
    "0";
  const rating = Math.min(5, Math.max(0, parseFloat(ratingText)));

  const reviewText =
    html.match(/aria-label="([\d,]+) ratings"/)?.[1] ??
    html.match(/aria-label="([\d,]+) reviews"/)?.[1] ??
    html.match(/>\s*([\d,]+)\s*(?:ratings|reviews)\s*</)?.[1] ??
    "0";
  const reviewCount = parseInt(reviewText.replace(/,/g, ""), 10) || 0;

  return { rating: Number.isFinite(rating) ? rating : 0, reviewCount };
}

/** Parse a single `s-search-result` block into a product. */
function parseSearchResultBlock(html: string, marketplace: AmazonScraperMarketplaceKey): SearchResultBlock | null {
  const asin = html.match(/data-asin="([A-Z0-9]{10})"/)?.[1];
  if (!asin) return null;

  // Title: prefer the `h2` aria-label, else the visible image alt.
  const title =
    html.match(/<h2[^>]*aria-label="([^"]{10,300})"/)?.[1] ??
    html.match(/class="s-image"[^>]*alt="([^"]{10,300})"/)?.[1];
  if (!title) return null;
  const cleanTitle = decodeEntities(title);
  if (!cleanTitle) return null;

  // Skip paid placements — only organic, real products.
  if (/^Sponsored Ad\b/i.test(cleanTitle)) return null;

  const imageUrl = html.match(/class="s-image"[^>]*src="([^"]+)"/)?.[1] ?? "";

  const href = html.match(/href="\/([^"]*\/dp\/[A-Z0-9]{10}[^"]*)"/)?.[1];
  const meta = AMAZON_SCRAPER_MARKETPLACES[marketplace];
  const productUrl = href
    ? `${meta.storeUrl}/${href.split("?")[0] ?? ""}`
    : buildAmazonProductUrl(asin, marketplace);

  const { price, originalPrice, currency } = parseSinglePrice(html);
  if (!price || price <= 0) return null;
  if (!imageUrl.startsWith("http")) return null;
  if (!productUrl.includes(meta.storeUrl)) return null;

  const { rating, reviewCount } = parseRating(html);

  return {
    asin,
    title: cleanTitle,
    imageUrl,
    price,
    originalPrice,
    currency: currency || meta.currency,
    productUrl,
    rating,
    reviewCount,
  };
}

function parseSearchHtml(
  html: string,
  marketplace: AmazonScraperMarketplaceKey,
): AmazonScrapedSearchResult[] {
  const blocks: SearchResultBlock[] = [];
  // Split on each result container: `<div ... data-asin="..." data-component-type="s-search-result">`.
  const containerRe =
    /<div[^>]*data-asin="([A-Z0-9]{10})"[^>]*data-component-type="s-search-result"[^>]*>/g;
  const starts: Array<{ idx: number; asin: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = containerRe.exec(html))) {
    starts.push({ idx: m.index, asin: m[1] });
  }

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const end = starts[i + 1] ? starts[i + 1]!.idx : html.length;
    const block = html.slice(start.idx, end);
    const parsed = parseSearchResultBlock(block, marketplace);
    if (parsed) blocks.push(parsed);
  }

  const seen = new Set<string>();
  return blocks
    .filter((b) => {
      if (seen.has(b.asin)) return false;
      seen.add(b.asin);
      return true;
    })
    .map((b) => ({ ...b, marketplace }));
}

/**
 * Fetch real Amazon keyword search results from the storefront.
 * Returns organic results with a real ASIN/title/price/image/URL.
 */
export async function fetchAmazonSearchScraper(
  query: string,
  marketplace: AmazonScraperMarketplaceKey = "amazon-storefront",
): Promise<AmazonScrapedSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = buildAmazonSearchUrl(trimmed, marketplace);
  let html = await fetchHtml(url);

  if (process.env.AMAZON_SCRAPER_DEBUG === "1") {
    console.log(
      "[amazon-scraper] url=", url,
      "htmlLen=", html.length,
      "hasSearchResult=", html.includes("s-search-result"),
      "caption=", html.includes("captcha-form") || html.includes("api-services-support@amazon.com"),
      "title=", html.match(/<title>([^<]*)<\/title>/)?.[1],
    );
  }

  let results = parseSearchHtml(html, marketplace);

  // Retry up to 2 more times with a different user-agent — cheap retries that
  // escape rate-limit/geo-desync responses where the page rendered empty.
  // AWS WAF JS challenges (HTTP 202) are never escaped by a UA rotation, so
  // skip them instead of burning the retry budget.
  for (let attempt = 0; attempt < 2 && results.length === 0 && !isWafChallenge(html); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    html = await fetchHtml(url);
    results = parseSearchHtml(html, marketplace);
  }

  return results;
}

/**
 * Extract the largest image from the `data-a-dynamic-image` JSON blob on
 * `#landingImage`. Falls back to `src` / `data-old-hires` attrs.
 */
function parseLandingImage(html: string): string {
  const dyn = html.match(/id="landingImage"[^>]*data-a-dynamic-image="([^"]*)"/)?.[1];
  if (dyn) {
    try {
      const json = dyn.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      const map = JSON.parse(json) as Record<string, [number, number]>;
      let best = "";
      let bestSize = 0;
      for (const [url, dims] of Object.entries(map)) {
        const size = dims[0] ?? 0;
        if (size > bestSize) {
          bestSize = size;
          best = url;
        }
      }
      if (best.startsWith("http")) return best;
    } catch {
      // Malformed JSON — fall through to the attrs below.
    }
  }
  return (
    html.match(/id="landingImage"[^>]*src="([^"]+)"/)?.[1] ??
    html.match(/id="landingImage"[^>]*data-old-hires="([^"]+)"/)?.[1] ??
    ""
  );
}

/**
 * Extract the buy-box price from a dp page. Modern Amazon splits the price
 * into `a-price-symbol`/`a-price-whole`/`a-price-fraction` inside the
 * `priceToPay` block (the `a-offscreen` there is a single space), so a plain
 * offscreen regex returns nothing. Returns the raw joined display string like
 * "EGP 22,524.95" so callers can run it through parseMoney/detectCurrency.
 */
function parseBuyBoxPrice(html: string): string {
  // 1) The modern `priceToPay` buy-box block (symbol + whole + fraction).
  const priceToPay = html.match(
    /class="a-price[^"]*priceToPay[^"]*"[\s\S]*?<span class="a-price-symbol">([^<]+)<\/span>\s*<span class="a-price-whole">([\d.,]+)[\s\S]*?<span class="a-price-fraction">([\s\S]*?)<\/span>/,
  );
  if (priceToPay) {
    const raw = `${priceToPay[1]} ${priceToPay[2]}.${priceToPay[3] ?? "00"}`;
    if (parseMoney(raw) > 0) return raw;
  }

  // 2) Classic buy-box markup: `.a-price > .a-offscreen`.
  const classic =
    html.match(/<span class="a-price"[^>]*><span class="a-offscreen">([^<]+)<\/span>/)?.[1] ?? "";
  if (parseMoney(classic) > 0) return classic;

  // 3) Any other priced offscreen.
  for (const m of html.matchAll(/class="a-offscreen">([^<]+)<\/span>/g)) {
    if (parseMoney(m[1]!) > 0) return m[1]!;
  }
  return "";
}

/** Parse a single Amazon product (dp) page. */
function parseProductHtml(
  html: string,
  asin: string,
  marketplace: AmazonScraperMarketplaceKey,
): AmazonScrapedProduct | null {
  const meta = AMAZON_SCRAPER_MARKETPLACES[marketplace];

  const title =
    html.match(/<span id="productTitle"[^>]*>\s*([\s\S]*?)\s*<\/span>/)?.[1] ??
    html.match(/<h1[^>]*id="title"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/)?.[1];
  const cleanTitle = title ? stripTags(title) : "";
  if (!cleanTitle) return null;

  const imageUrl = parseLandingImage(html);
  if (!imageUrl.startsWith("http")) return null;

  const rawPrice = parseBuyBoxPrice(html);
  const price = parseMoney(rawPrice);
  if (!price) return null;

  const originalRaw =
    html.match(/<span class="a-price a-text-price[^"]*">[\s\S]*?<span class="a-offscreen">([^<]+)<\/span>/)?.[1] ??
    "";
  const originalPrice = parseMoney(originalRaw) > price ? parseMoney(originalRaw) : price;

  const ratingText = html.match(/([0-9.]+) out of 5 stars/)?.[1] ?? "0";
  const rating = Math.min(5, Math.max(0, parseFloat(ratingText)));
  const reviewText = html.match(/id="acrCustomerReviewText"[^>]*>([\s\S]*?)<\//)?.[1]?.trim() ?? "0";
  const reviewCount =
    parseInt(customParseInt(reviewText.replace(/[^\d]/g, "")), 10) || 0;

  const availabilityText = html.match(/id="availability"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "";
  const inStock = !/out of stock|currently unavailable/i.test(stripTags(availabilityText));

  const category =
    html.match(/id="wayfinding-breadcrumbs_feature_div"[\s\S]*?<a[^>]*>([^<]+)<\/a>/)?.[1]?.trim() ||
    "General";

  return {
    asin,
    title: cleanTitle,
    imageUrl,
    price,
    originalPrice,
    currency:
      detectCurrency(rawPrice) ?? (html.includes("EGP") && meta.domain === "eg" ? "EGP" : meta.currency),
    productUrl: `${meta.storeUrl}/dp/${asin}`,
    rating: Number.isFinite(rating) ? rating : 0,
    reviewCount,
    inStock,
    category: category === "General" ? "General" : decodeEntities(category),
  };
}

/** Parse a count string that may contain `ratings`/`reviews` words. */
function customParseInt(cleaned: string): string {
  return cleaned.replace(/,/g, "");
}

/**
 * Fetch a single real Amazon product page by ASIN.
 * Returns null when the ASIN is not purchasable on the marketplace.
 */
export async function fetchAmazonProductScraper(
  asin: string,
  marketplace: AmazonScraperMarketplaceKey = "amazon-storefront",
): Promise<AmazonScrapedProduct | null> {
  const trimmed = asin.trim().toUpperCase();
  if (!/^[A-Z0-9]{8,12}$/.test(trimmed)) return null;

  const url = buildAmazonProductUrl(trimmed, marketplace);

  let html = await fetchHtml(url);
  let product = parseProductHtml(html, trimmed, marketplace);

  // Retry up to 2 more times with a different user-agent when the first parse
  // failed (empty/upsell-rendered buy box, rate-limit page, geo-desync).
  // AWS WAF JS challenges are skipped — a UA rotation never solves them.
  for (let attempt = 0; attempt < 2 && !product && !isWafChallenge(html); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    html = await fetchHtml(url);
    product = parseProductHtml(html, trimmed, marketplace);
  }

  return product;
}