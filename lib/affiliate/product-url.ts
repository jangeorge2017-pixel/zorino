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
  return true;
}
