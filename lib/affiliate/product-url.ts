/**
 * Canonical "is this a real product-level destination?" guard.
 *
 * Shared by the price-comparison table and any Shop/cheapest action so that a
 * user is NEVER sent to a merchant HOMEPAGE instead of the actual product.
 *
 * Rules (real-data policy):
 *  - Must be a parseable http/https URL.
 *  - Must NOT be empty.
 *  - Must NOT be a bare origin / homepage (pathname empty or "/").
 *  - Marketplace-program roots like "admitad.com", "alibaba.com" without a
 *    product path never qualify.
 *  - Alibaba is provider-aware: an Alibaba-host URL only counts when it is a
 *    real Alibaba product-level URL (native product/cps path carrying a
 *    product id). The Alibaba homepage, search and category pages never
 *    qualify — even with an arbitrary query string.
 *
 * If an offer has no valid product-level URL we leave it unshoppable rather
 * than fall back to a store website or fabricate a link.
 */

const HOMEPAGE_PATH_PATTERNS = [
  /^\/*$/,               // "/" or ""
  /^\/(home|index|default|catalog|products?|shop|store|stores?)(\.html?|\.php|\.aspx?|\/)*$/i,
];

/**
 * Parse the `to` value after URLSearchParams has decoded it once.  Do not run
 * decodeURIComponent here: merchant URLs frequently contain their own encoded
 * callback URLs, and a second decode either changes them or rejects `%`.
 */
export function parseAffiliateDestinationParam(raw: string | null): string | null {
  if (!raw) return null;
  try {
    new URL(raw);
    return raw;
  } catch {
    return null;
  }
}

export function isMerchantHomepageUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true; // unparseable → treat as unusable, never an acceptable destination
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return true;

  const path = url.pathname;
  if (path === "" || path === "/") return true;

  for (const pattern of HOMEPAGE_PATH_PATTERNS) {
    if (pattern.test(path)) return true;
  }

  return false;
}

/** Lowercased hostname of a raw URL, or "" when unparseable. */
function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * True only when the URL is a real, non-homepage, non-empty PRODUCT destination.
 *
 * Provider-aware: known marketplace hosts (AliExpress, eBay, Amazon, Walmart,
 * Temu, CJdropshipping, Noon, Alibaba) must be recognized product-level URLs —
 * never a homepage, search page, category page, or generic landing page.
 * Unknown hosts keep the generic non-homepage rule (already-tracked affiliate
 * link hosts like Admitad goto domains pass through untouched).
 */
export function isValidProductDestinationUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (isMerchantHomepageUrl(trimmed)) return false;
  // Alibaba is provider-aware: only a real Alibaba product-level URL qualifies.
  if (isAlibabaHostUrl(trimmed)) return isAlibabaProductUrl(trimmed);
  const host = hostOf(trimmed);
  if (isAliExpressHostUrl(host)) return isAliExpressProductUrl(trimmed);
  if (isEbayHostUrl(host)) return isEbayProductUrl(trimmed);
  if (isAmazonHostUrl(host)) return isAmazonProductUrl(trimmed);
  if (isWalmartHostUrl(host)) return isWalmartProductUrl(trimmed);
  if (isTemuHostUrl(host)) return isTemuProductUrl(trimmed);
  if (isCjdropshippingHostUrl(host)) return isCjdropshippingProductUrl(trimmed);
  if (isNoonHostUrl(host)) return isNoonProductUrl(trimmed);
  return true;
}

/** Choose the first real merchant product URL from stored provider fields. */
export function resolveProductDestination(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && isValidProductDestinationUrl(trimmed)) return trimmed;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Provider-aware marketplace product-URL validators
// ---------------------------------------------------------------------------
//
// These are pattern + URL-string inspections only, never network calls (the
// SSRF surface stays untouched). A Shop Now / product-detail link must be a
// REAL product-level URL on the merchant host — never a homepage, search page,
// category/browse page, or generic landing page. If a provider has no provable
// product URL, the product is left unshoppable instead of fabricating one.

function isHttpsLike(raw: string): boolean {
  try {
    const protocol = new URL(raw).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// --- AliExpress ---

export function isAliExpressHostUrl(host: string): boolean {
  return host === "aliexpress.com" || host.endsWith(".aliexpress.com");
}

/**
 * True only when `raw` is a real AliExpress product/deep-link URL on a native
 * AliExpress host. Accepts `s.click.aliexpress.com/e/_<token>` tracking deep
 * links and `/item/<id>` product pages. Rejects the homepage, search/listing
 * pages, and store/category chrome.
 */
export function isAliExpressProductUrl(raw: string): boolean {
  if (!isHttpsLike(raw)) return false;
  const host = hostOf(raw);
  if (!isAliExpressHostUrl(host)) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const path = url.pathname;
  if (path === "" || path === "/") return false;

  // Tracked click deep-link (s.click.aliexpress.com/e/_<token>) → real product.
  if (host === "s.click.aliexpress.com") return /^\/e\/_/i.test(path);

  // www.aliexpress.com/item/<id>.html (and /i/<id>.html) → real product page.
  if (/^\/(item|i)\/[0-9]{6,}/i.test(path)) return true;

  return false;
}

export function isValidAliExpressDestinationUrl(
  raw: string | null | undefined,
): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed || isMerchantHomepageUrl(trimmed)) return false;
  return isAliExpressProductUrl(trimmed);
}

/**
 * Select an API-provided AliExpress product destination without fabricating a
 * URL from a product id or accepting shop, search, and category pages.
 */
export function resolveAliExpressProductDestination(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && isValidAliExpressDestinationUrl(trimmed)) return trimmed;
  }
  return null;
}

// --- eBay ---

const EBAY_HOST_PATTERN =
  /(?:^|\.)ebay\.(?:com|co\.uk|de|fr|it|es|ca|com\.au|com\.mx|at|be|ch|com\.tr|ie|nl|pl|co\.nz|se|cz|dk|fi|no|pt|sk|com\.sg|sg)$/i;

export function isEbayHostUrl(host: string): boolean {
  return EBAY_HOST_PATTERN.test(host);
}

const EBAY_NON_PRODUCT_PATH_PATTERNS = [
  /^\/(sch|usr|b|s|stores|deals|globaldeals|allcategories|pages|slp|top-sellers|feed|post|collections|patent|buy|sell|customer-support|help|government|themes|politics|music|dvd-movies|tickets|brand-outlet|v\/all-categories|category|electronics|fashion|motors|collectibles|home-garden|sports-equipment|toys-hobbies|jewelry-watches|health-beauty|art|business-industrial|cell-phones|clothing|shoes-accessories|computers-tablets|cameras-photo|video-games|building-supplies|software|office-products|pet-supplies|bicycles|outdoor|luggage|crafts|dolls-bears|paper-memorabilia|vintage|paintings|postcards|coins-paper-money|stamps|comics|funko)(\/|$)/i,
];

export function isEbayProductUrl(raw: string): boolean {
  if (!isHttpsLike(raw)) return false;
  if (!isEbayHostUrl(hostOf(raw))) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const path = url.pathname;
  if (path === "" || path === "/") return false;

  for (const pattern of EBAY_NON_PRODUCT_PATH_PATTERNS) {
    if (pattern.test(path)) return false;
  }

  // Product: /itm/<slug>/<id>, /itm/<id>, /p/<id>, /ip/, /bct/.
  if (/^\/(itm|p|ip|bct)\//i.test(path)) return true;

  return false;
}

// --- Amazon ---

const AMAZON_HOST_PATTERN =
  /(?:^|\.)amazon\.(?:com|ca|co\.uk|de|fr|it|es|com\.mx|com\.br|in|com\.au|co\.jp|nl|ae|sa|eg|com\.eg|com\.sg|sg|se|pl|com\.tr)$/i;

export function isAmazonHostUrl(host: string): boolean {
  return AMAZON_HOST_PATTERN.test(host);
}

const AMAZON_NON_PRODUCT_PATH_PATTERNS = [
  /^\/(s|s\/|search|b|deals|gp\/bestsellers|gp\/top-rated|gp\/czip|gp\/aw\/s|prime|gp\/prime|gp\/css|cart|signin|signup|register|gp\/customer|stores|families|gifts|moviestore|video|gp\/video|audible|kindle-|gp\/digital|dmusic|fresh|subscribe|subscribe-and-save|gp\/help|customer-reviews|gp\/seller|gp\/movers|wishlist|prepaid|relax|gift-cards|gp\/registry|brands|gp\/search|gp\/auto|gp\/buy|sspa)(\/|$)/i,
];

export function isAmazonProductUrl(raw: string): boolean {
  if (!isHttpsLike(raw)) return false;
  if (!isAmazonHostUrl(hostOf(raw))) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const path = url.pathname;
  if (path === "" || path === "/") return false;

  for (const pattern of AMAZON_NON_PRODUCT_PATH_PATTERNS) {
    if (pattern.test(path)) return false;
  }

  // Product: /dp/<ASIN>, /gp/product/<ASIN>, /gp/aw/d/<ASIN>, /exec/obidos/ASIN/<ASIN>.
  const asin = path.match(
    /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Za-z0-9]{6,12})(?:\/|$)/,
  );
  return asin !== null;
}

// --- Walmart ---

export function isWalmartHostUrl(host: string): boolean {
  return host === "walmart.com" || host.endsWith(".walmart.com");
}

export function isWalmartProductUrl(raw: string): boolean {
  if (!isHttpsLike(raw)) return false;
  if (!isWalmartHostUrl(hostOf(raw))) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const path = url.pathname;
  if (path === "" || path === "/") return false;

  // Walmart product pages: /ip/<slug>/<id> (with a numeric product id).
  if (/^\/(ip|item)\//i.test(path)) {
    return /\d{4,}/.test(path);
  }
  return false;
}

// --- Temu ---

export function isTemuHostUrl(host: string): boolean {
  return host === "temu.com" || host.endsWith(".temu.com");
}

const TEMU_NON_PRODUCT_PATH_PATTERNS = [
  /^\/(search|magic\.html|deals|seller|ugc|campaign|channels|coupon|bg|categories?|app|login|checkout|package|affiliate|news|help|review|feedback|notice|register|trade|preferential|earth-day|use|landing)(\/|$)/i,
];

export function isTemuProductUrl(raw: string): boolean {
  if (!isHttpsLike(raw)) return false;
  if (!isTemuHostUrl(hostOf(raw))) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const path = url.pathname;
  if (path === "" || path === "/") return false;

  // Product: /item/<slug>-<id>.html and /goods.html?goods_id=<digits>.
  if (/^\/(item|product)\//i.test(path)) return true;
  if (/^\/goods\.html/i.test(path)) {
    return /(?:^|[?&])goods_id=\d+/i.test(url.search);
  }

  for (const pattern of TEMU_NON_PRODUCT_PATH_PATTERNS) {
    if (pattern.test(path)) return false;
  }
  return false;
}

// --- CJdropshipping ---

export function isCjdropshippingHostUrl(host: string): boolean {
  return host === "cjdropshipping.com" || host.endsWith(".cjdropshipping.com");
}

export function isCjdropshippingProductUrl(raw: string): boolean {
  if (!isHttpsLike(raw)) return false;
  if (!isCjdropshippingHostUrl(hostOf(raw))) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const path = url.pathname;
  if (path === "" || path === "/") return false;

  // Canonical public product URL: /product/<slug>-p-<pid>.html (and bare
  // /product/<pid>.html form).
  if (/^\/product\//i.test(path)) {
    return /\.html$/i.test(path) || /-p-\d+/i.test(path);
  }
  return false;
}

// --- Noon ---

export function isNoonHostUrl(host: string): boolean {
  return host === "noon.com" || host.endsWith(".noon.com");
}

const NOON_NON_PRODUCT_PATH_PATTERNS = [
  /^\/(search|shop|category|account|cart|checkout|login|help|about|contact|stores|delivery|returns|privacy|terms)(\/|$)/i,
];

export function isNoonProductUrl(raw: string): boolean {
  if (!isHttpsLike(raw)) return false;
  if (!isNoonHostUrl(hostOf(raw))) return false;

  // s.noon.com short links are already-tracked product deep links.
  if (hostOf(raw) === "s.noon.com") return true;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const path = url.pathname;
  if (path === "" || path === "/") return false;

  for (const pattern of NOON_NON_PRODUCT_PATH_PATTERNS) {
    if (pattern.test(path)) return false;
  }

  // Locale-prefixed product pages: /<locale>/n/<name>/<id>/... (e.g.
  // /uae-en/n/electronics/samsung-S300x012345678/) and bare /n/... forms.
  if (path.includes("/n/")) return true;
  if (/\.html$/i.test(path)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Provider-aware Alibaba product-URL validation
// ---------------------------------------------------------------------------
//
// The live Admitad "Alibaba WW" feed delivers real Alibaba products whose
// offer.url values are one of:
//   - https://www.alibaba.com/product-detail/<slug>_<productId>.html
//   - https://offer.alibaba.com/cps/<campaign>?bm=cps&src=saf&productId=<id>
//   - https://www.alibaba.com/<other>_<productId>.html
// We must ONLY recognise those genuine product-level URLs as products, and
// never an Alibaba homepage / search / category page — even one carrying an
// arbitrary query string (https://www.alibaba.com/?foo=bar is still the
// homepage). This is pattern + URL-string inspection only; it never makes a
// network call (keeps SSRF surface untouched).

/** Path prefixes that are never a product on an Alibaba host (search/browse/chrome). */
const ALIBABA_NON_PRODUCT_PATH_PATTERNS = [
  // Search
  /^\/(trade\/search|search|w\/|s\/|search_result|query)(\/|$)/i,
  // Category / collection / browse
  /^\/(products?|c\/|k\/|category|wholesale|buyer\/|suppliers?|manufacturers?|brands|channels?|collections?|trending|flash-deals|deals|sale|best-selling|top-rated)(\/|$)/i,
  // Non-product chrome
  /^\/(login|register|signup|signin|cart|checkout|account|membership|seller|seller-center|help|support|about|contact|press|blog|news|terms|privacy|faq|customer-service|site-map|sitemap|company|careers|affiliate|download-app|app)(\/|$)/i,
];

export function isAlibabaHostUrl(raw: string | null | undefined): boolean {
  try {
    const host = new URL(raw ?? "").hostname.toLowerCase();
    return host === "alibaba.com" || host.endsWith(".alibaba.com");
  } catch {
    return false;
  }
}

/** Pull a numeric Alibaba product id from the query string (productId=...). */
function alibabaProductIdFromQuery(url: URL): string | null {
  const pid = url.searchParams.get("productId");
  if (pid && /^\d+$/.test(pid.trim())) return pid.trim();
  return null;
}

/**
 * True only when `raw` is a REAL Alibaba product-level URL on a native
 * Alibaba host. Rejects the Alibaba homepage (with or without query), search
 * pages, and category/collection pages. Requires a genuine product identifier
 * (a `productId` query param, a `product-detail`/item slug ending in
 * `_<productId>.html`, or a numeric product-id path segment).
 */
export function isAlibabaProductUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (!isAlibabaHostUrl(raw)) return false;

  const path = url.pathname;
  if (path === "" || path === "/") return false;

  for (const pattern of ALIBABA_NON_PRODUCT_PATH_PATTERNS) {
    if (pattern.test(path)) return false;
  }

  const host = url.hostname.toLowerCase();

  // offer.alibaba.com/cps/...?productId=<digits> → real CPS product page.
  if (host === "offer.alibaba.com" && /\/cps\//i.test(path)) {
    return alibabaProductIdFromQuery(url) !== null;
  }

  // A numeric product id in the query.
  if (alibabaProductIdFromQuery(url)) return true;

  // product-detail / item / generic slug ending in _<productId>.html
  if (/\/[^/?#]+_[0-9]+(_[0-9]+)?\.html$/i.test(path)) return true;
  // product-detail/..._<id>.html
  if (/\/product-detail\//i.test(path) && /\.html$/i.test(path)) return true;
  // Any 5+-digit product-id path segment
  if (/\/[0-9]{5,}(?:\/|$)/.test(path)) return true;

  return false;
}

/**
 * Extract a provable Alibaba product id from a URL, or null when none exists.
 * Only recognizes native Alibaba hosts and does not fabricate identifiers.
 */
export function extractAlibabaProductId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!isAlibabaHostUrl(raw)) return null;

  const fromQuery = alibabaProductIdFromQuery(url);
  if (fromQuery) return fromQuery;

  const path = url.pathname;
  const slug = path.match(/_([0-9]+)(?:_[0-9]+)?\.html$/i);
  if (slug) return slug[1];

  const numeric = path.match(/\/[0-9]{5,}(?:\/|$)/);
  if (numeric) return numeric[0].replace(/[^0-9]/g, "");

  return null;
}

export type AlibabaDestinationDecision = "live" | "stored" | "unavailable";

/**
 * Pure decision for how a DB-sourced Alibaba row should resolve.
 *
 * LIVE-FEED-FIRST: the persisted `lowest_prices_today` row may store only a
 * merchant homepage or an opaque Admitad tracking URL. Never emit those as a
 * Shop destination.
 *  - "live"  → a real live-feed Alibaba product is available (preferred).
 *  - "stored"→ no live product, but the stored URL is a natively-valid Alibaba
 *              product URL, so the stored row is a safe product destination.
 *  - "unavailable" → no provable real product destination (homepage or
 *              opaque tracking link only); the product must be left unavailable.
 */
export function resolveAlibabaProduct(
  storedUrl: string | null | undefined,
  liveProductAvailable: boolean,
): AlibabaDestinationDecision {
  if (liveProductAvailable) return "live";
  if (storedUrl && isAlibabaProductUrl(storedUrl)) return "stored";
  return "unavailable";
}
