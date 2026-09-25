/**
 * Strict accessory exclusion + device price floor for genuine-device queries.
 *
 * On a device query ("iphone 15 pro max", "samsung galaxy s24") the user wants
 * the physical handset — never a $2.59 silicone case, a $0.26 tempered glass,
 * a charging cable, a VR headset, or a cardboard dummy that merely names the
 * phone to ride its search traffic. Accessory-saturated first pages on
 * AliExpress / Admitad / Amazon routinely bury the genuine device behind such
 * rows.
 *
 * This module is the single, provider-neutral, deterministic enforcement point.
 * All predicates are pure so they unit-test trivially.
 *
 * - STRICT term drop: a title containing ANY accessory word loses the row
 *   immediately — even when the same string ALSO names the genuine device
 *   ("Tempered Glass for iPhone 15 Pro" is a glass product, never a phone).
 *   No re-rank, no "push behind", no fallback. Gone.
 * - Price floor: a row below the query's floor leaves the pool UNLESS it is a
 *   recognised genuine device. A genuine refurbished handset may legally be
 *   cheap (Bug1/Bug4 freeze that a genuine device leads at ANY price) — but a
 *   "$26 silicone case" and "$0.26 tempered glass" never pass. iPhone queries
 *   use a $200 USD floor ([1] a real iPhone cannot sit below $200 today),
 *   other device queries $100 USD.
 * - The passport that beats the price floor is "recognised genuine device":
 *   a device-family signal present AND no accessory term. That is precisely
 *   what a device search must lead with.
 * - DEVICE-INTENT ONLY: accessories are what the USER asked for on an
 *   accessory-intent query ("iphone 15 case") and on homepage/category/compare
 *   pools. Scope lives with the caller; this module never filters those.
 *   (Strict accessory queries are handled in `query-intent`, not here.)
 */

/** Words that disqualify a row from a device-intent pool. Sorted, lowercase. */
export const ACCESSORY_EXCLUSION_TERMS: readonly string[] = [
  "box only",
  "bracket",
  "cable",
  "case",
  "charger",
  "cover",
  "cradle",
  "dock",
  "dummy",
  "film",
  "glass",
  "graffiti",
  "headset",
  "holder",
  "housing",
  "lens",
  "mount",
  "protector",
  "s pen",
  "stand",
  "strap",
  "stylus",
  "vr",
];

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

/** Single word-boundary regex over every accessory term. Case-insensitive. */
const ACCESSORY_TERM_RE = new RegExp(
  ACCESSORY_EXCLUSION_TERMS.map((term) =>
    term.replace(ESCAPE_RE, "\\$&"),
  ).map((pattern) => `(?:\\b${pattern}\\b)`).join("|"),
  "i",
);

/** True when the title carries any strict accessory word. Pure. */
export function hasAccessoryTerm(title: string): boolean {
  return ACCESSORY_TERM_RE.test(title);
}

/** Device-family words that mark a row as the physical device itself. */
const DEVICE_FAMILY_SIGNALS: ReadonlyArray<{
  family: string;
  re: RegExp;
}> = [
  { family: "phone", re: /\b(iphone|smartphones?|cell ?phones?|mobile ?phones?|galaxy s[0-9]|pixel [0-9]|oneplus|xiao ?mi|redmi|poco|huawei|honor|oppo|vivo|realme|motorola|nokia|samsung galaxy|fold|flip)\b/i },
  { family: "tablet", re: /\b(ipads?|galaxy tabs?|tablets?)\b/i },
  { family: "laptop", re: /\b(laptops?|notebooks?|macbooks?|chromebooks?|ultrabooks?|thinkpads?)\b/i },
  { family: "console", re: /\b(playstations?|ps[3456]|xboxes?|nintendo switch)\b/i },
  { family: "audio", re: /\b(headphones?|earbuds?|airpods?)\b/i },
  { family: "smartwatch", re: /\b(apple watch|galaxy watch|smart ?watches?)\b/i },
];

/**
 * True when the title names a recognised device-family AND carries no
 * accessory word — i.e. it is plausibly the physical device itself, never a
 * renamed accessory. Pure.
 */
export function looksLikeGenuineDevice(title: string): boolean {
  if (hasAccessoryTerm(title)) return false;
  return DEVICE_FAMILY_SIGNALS.some(({ re }) => re.test(title));
}

/** USD floor for non-iPhone device queries. */
export const DEVICE_PRICE_FLOOR_USD = 100;
/** USD floor for iPhone-named queries — a real iPhone cannot cost less. */
export const IPHONE_PRICE_FLOOR_USD = 200;
const IPHONE_RE = /\biphone\b/i;

/** USD price floor for a device query ("iphone 15 pro" = 200, else 100). */
export function devicePriceFloorUsd(query: string): number {
  return IPHONE_RE.test(query) ? IPHONE_PRICE_FLOOR_USD : DEVICE_PRICE_FLOOR_USD;
}

/** True when the price sits below the device floor for this query. */
export function belowDevicePriceFloor(priceUsd: number, query: string): boolean {
  return priceUsd < devicePriceFloorUsd(query);
}

/**
 * Apply the strict device guard to a raw pool: drop accessory rows absolutely,
 * then drop price-below-floor rows UNLESS they are themselves genuine devices.
 * Pure — never mutates the input.
 */
export function enforceStrictDevicePool<
  T extends { title: string; price: number },
>(listings: readonly T[], query: string): T[] {
  const floor = devicePriceFloorUsd(query);
  return listings.filter((listing) => {
    if (hasAccessoryTerm(listing.title)) return false;
    if (listing.price < floor && !looksLikeGenuineDevice(listing.title)) {
      return false;
    }
    return true;
  });
}
