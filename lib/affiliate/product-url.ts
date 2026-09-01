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

/** True only when the URL is a real, non-homepage, non-empty product destination. */
export function isValidProductDestinationUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (isMerchantHomepageUrl(trimmed)) return false;
  // Alibaba is provider-aware: only a real Alibaba product-level URL qualifies.
  if (isAlibabaHostUrl(trimmed)) return isAlibabaProductUrl(trimmed);
  return true;
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
