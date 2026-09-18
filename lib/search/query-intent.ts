/**
 * Provider-neutral search-query intent detection.
 *
 * ZORINO fans one raw query out to every active marketplace connector. Each
 * provider understands a query differently (eBay can filter by category;
 * AliExpress's keyword index is accessory-heavy for device queries; some
 * providers only honour keywords), so a single opaque string leaves genuine
 * products under-served on providers whose "query language" differs.
 *
 * This module turns the raw query into a small, generic INTENT — a product
 * *family* (phone / tablet / laptop / console / audio / …), never a specific
 * model, id or merchant. Connectors may use it to search their own catalog the
 * way a human would. Detection is purely lexical taxonomy built from the same
 * family vocabulary the relevance engine already trusts; nothing here knows
 * about any particular product.
 */

import {
  queryPinsDeviceFamily,
  queryTokens,
  queryWantsAccessory,
} from "@/lib/search/relevance";

export type ProductFamily =
  | "phone"
  | "tablet"
  | "laptop"
  | "console"
  | "audio"
  | "smartwatch"
  | "camera"
  | "gpu"
  | "tv-monitor"
  | "unknown";

export type QueryIntentKind =
  | "device"
  | "accessory"
  | "category"
  | "brand"
  | "generic";

export type SearchQueryIntent = {
  kind: QueryIntentKind;
  family: ProductFamily;
  /** User is explicitly shopping for an accessory / spare part. */
  wantsAccessory: boolean;
  /** Query names a concrete device family ("iphone 15", "airpods pro", …). */
  pinsDeviceFamily: boolean;
  /** US eBay category id for this family when it maps confidently. */
  ebayCategoryId?: string;
};

/**
 * Provider-neutral generic retrieval keyword per product family. A device-intent
 * search fans this bare family keyword out to every provider in parallel with
 * the exact query, because for some catalogs the exact query's first pages are
 * accessory-saturated and never reach the genuine device. This is the SAME
 * generic vocabulary the category surfaces use (lib/data/category-keywords.ts)
 * to reach genuine devices — no model, id, or merchant is ever named here.
 */
export const FAMILY_RETRIEVAL_KEYWORDS: Readonly<Partial<Record<ProductFamily, string>>> = {
  phone: "phone",
  tablet: "tablet",
  laptop: "laptop",
  console: "console",
  audio: "earbuds",
  smartwatch: "smartwatch",
  camera: "camera",
  gpu: "graphics card",
  "tv-monitor": "television",
};

/**
 * Family signal words, highest-signal family first. These are generic product
 * categories, not products: "tv", "laptop", "rtx", "airpods". Order resolves
 * cross-family words ("samsung tv" is a TV, "galaxy watch" is a watch, not a
 * phone). Word boundaries keep "phone" out of "headphones".
 */
const FAMILY_SIGNALS: ReadonlyArray<{ family: ProductFamily; re: RegExp }> = [
  { family: "tv-monitor", re: /\b(television|tvs?|monitors?)\b/i },
  { family: "tablet", re: /\b(ipad|galaxy\s+tabs?|tablets?)\b/i },
  { family: "laptop", re: /\b(laptops?|notebooks?|macbook|chromebook|ultrabooks?)\b/i },
  {
    family: "console",
    re: /\b(ps[3-6]|playstation|xbox|nintendo|game\s?consoles?|consoles?)\b/i,
  },
  { family: "gpu", re: /\b(rtx\s?\d{3,4}|geforce|graphics\s+cards?)\b/i },
  {
    family: "smartwatch",
    re: /\b(smart\s?watches?|apple\s+watch|galaxy\s+watch|fitbits?)\b/i,
  },
  { family: "camera", re: /\b(cameras?|camcorders?|dslr|mirrorless)\b/i },
  { family: "audio", re: /\b(airpods?|earbuds?|earphones?|headphones?|headsets?)\b/i },
  {
    family: "phone",
    re: /\b(iphones?|smartphones?|cell\s?phones?|mobile\s+phones?|galax(?:y|ies)|samsung|pixel|oneplus|one\s+plus|xiaomi|redmi|poco|huawei|honor|oppo|vivo|realme|motorola|nokia|fold|flip|phones?)\b/i,
  },
];

/**
 * US eBay Browse category ids for families that map confidently. eBay's
 * `/item_summary/search` accepts at most ONE `category_ids` value per request
 * and still requires the keyword `q`, so this narrows the catalog while the
 * keyword keeps the exact product. Families without a confident category are
 * searched by keyword only — never guessed.
 */
const EBAY_US_CATEGORY_BY_FAMILY: Partial<Record<ProductFamily, string>> = {
  phone: "9355",
  tablet: "171485",
  laptop: "175672",
  console: "1249",
};

/** Bare brand tokens that name no product by themselves. */
const BRAND_ONLY_RE =
  /^(apple|samsung|sony|xiaomi|redmi|poco|google|pixel|oneplus|huawei|honor|oppo|vivo|realme|motorola|nokia|nvidia|geforce|asus|acer|lenovo|dell|hp|msi)$/i;

/** Generic (non-provider) product family of a raw query. */
export function detectProductFamily(query: string): ProductFamily {
  if (!query.trim()) return "unknown";
  for (const { family, re } of FAMILY_SIGNALS) {
    if (re.test(query)) return family;
  }
  return "unknown";
}

/**
 * Analyze a raw user query into a provider-neutral intent. Pure and total —
 * empty/unknown queries degrade to `{ kind: "generic", family: "unknown" }`.
 */
export function analyzeSearchQueryIntent(query: string): SearchQueryIntent {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      kind: "generic",
      family: "unknown",
      wantsAccessory: false,
      pinsDeviceFamily: false,
    };
  }

  const wantsAccessory = queryWantsAccessory(trimmed);
  const pinsDeviceFamily = queryPinsDeviceFamily(trimmed);
  const family = detectProductFamily(trimmed);
  const tokens = queryTokens(trimmed);

  let kind: QueryIntentKind = "generic";
  if (wantsAccessory) {
    kind = "accessory";
  } else if (family !== "unknown") {
    if (pinsDeviceFamily || tokens.length >= 2) {
      kind = "device";
    } else if (BRAND_ONLY_RE.test(trimmed)) {
      kind = "brand";
    } else {
      kind = "category";
    }
  }

  // Accessory queries must NOT be narrowed to the device category: a case,
  // charger or screen protector lives in an accessory category, so filtering to
  // the phone/laptop category would drop the very products the user asked for.
  const ebayCategoryId =
    kind !== "accessory" ? EBAY_US_CATEGORY_BY_FAMILY[family] : undefined;

  return { kind, family, wantsAccessory, pinsDeviceFamily, ebayCategoryId };
}

/**
 * Build provider query variants for a device-intent search by appending the
 * generic family terms that provider's keyword index understands. Pure: the
 * caller supplies the per-family terms from the provider capability map, so this
 * stays provider-agnostic. The original query is always first; terms already
 * present in the query are skipped; the result is bounded by `maxVariants`.
 */
export function buildExpandedSearchQueries(
  query: string,
  appendTerms: readonly string[] | undefined,
  options?: { maxVariants?: number },
): string[] {
  const base = query.trim();
  if (!base) return [];
  const maxVariants = Math.max(1, options?.maxVariants ?? 3);
  if (!appendTerms || appendTerms.length === 0) return [base];

  const lower = base.toLowerCase();
  const variants = [base];
  for (const rawTerm of appendTerms) {
    if (variants.length >= maxVariants) break;
    const term = rawTerm.trim();
    if (!term || lower.includes(term.toLowerCase())) continue;
    variants.push(`${base} ${term}`.replace(/\s+/g, " ").trim());
  }

  return [...new Set(variants)].slice(0, maxVariants);
}
