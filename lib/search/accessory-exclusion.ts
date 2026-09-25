/**
 * Strict accessory exclusion + device price floor for genuine-device queries.
 *
 * On a handset query ("iphone 15 pro max", "samsung galaxy s24", "pixel 8") the
 * user wants the physical phone — never a $2.59 silicone case, a $0.26 tempered
 * glass, a charging cable, a VR headset, a pair of headphones, or a cardboard
 * dummy that merely names the phone to ride its search traffic.
 * Accessory-saturated first pages on AliExpress / Admitad / Amazon routinely
 * bury the genuine device behind such rows.
 *
 * This module is the single, provider-neutral, deterministic enforcement point.
 * All predicates are pure so they unit-test trivially.
 *
 * - STRICT term drop: a title containing ANY accessory word loses the row
 *   immediately — even when the same string ALSO names the genuine device
 *   ("Tempered Glass for iPhone 15 Pro" is a glass product, never a phone).
 *   No re-rank, no "push behind", no fallback. Gone. Singular, plural and
 *   compound forms (case/cases, cover/covers, dummy/dummies, earphones,
 *   headphones) all match. On a HANDSET (phone-family) query the accessory set
 *   additionally includes earphone/headphone — those are accessories to a
 *   phone; on an audio-family query ("airpods", "wireless earbuds") they are
 *   the genuine product and are NOT dropped.
 * - MUST-CONTAIN brand rule: a device query that names a concrete brand
 *   ("iPhone", "Samsung Galaxy", "Pixel", "ايفون") is a brand-constrained
 *   search — any result across ALL providers whose title carries none of the
 *   branded family names (Latin or Arabic aliases, e.g. iPhone/Apple vs
 *   ايفون) is unrelated sponsored inventory (a Bluetooth speaker, a scooter, a
 *   Samsung phone on an "iPhone" query) and is hard-dropped before the floor.
 * - CURRENCY-AWARE ABSOLUTE handset price floor: on a HANDSET query ANY row
 *   under $150 USD is hard-dropped before sorting or pagination — regardless
 *   of title, brand or provider ("a real phone cannot cost $2 or $8"). The
 *   row's price is NORMALISED from its own currency into USD first, so an
 *   Amazon Egypt row priced in EGP is never compared as a raw USD digit
 *   (48,400 EGP ≈ $998, but 1,000 EGP ≈ $20.6 < $150 and must drop). There is
 *   NO "genuine-device-below-floor" exemption: the floor is absolute, so an
 *   underpriced listing can never ride a genuine-looking title back in.
 *   Non-handset device queries ("wireless earbuds", "airpods pro", "ipad air",
 *   "macbook air m3") keep the prior floor with a recognised-device exemption,
 *   because genuine sub-$150 audio/tablet/laptop gear is legitimate
 *   inventory — a $25 earbud is a real product, a $25 phone is not.
 * - DEVICE-INTENT ONLY: accessories are what the USER asked for on an
 *   accessory-intent query ("iphone 15 case") and on homepage/category/compare
 *   pools. Scope lives with the caller; this module never filters those.
 *   (Strict accessory queries are handled in `query-intent`, not here.)
 */

import { detectProductFamily, ARABIC_FAMILY_SIGNALS } from "@/lib/search/query-intent";
import {
  hasArabicTerm,
  ARABIC_ACCESSORY_TERMS,
  titleMeetsRequiredBrand,
} from "@/lib/search/relevance";
import { isSupportedCurrency } from "@/lib/international/config";
import { convertAmount } from "@/lib/international/exchange-rates";

/** Words that disqualify a row from ANY device-intent pool. Sorted, lowercase. */
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

/** Extra words that disqualify a row ONLY on a handset (phone-family) query. */
export const HANDSET_ACCESSORY_EXTRA_TERMS: readonly string[] = [
  "earphone",
  "headphone",
];

/**
 * Arabic extra words that disqualify a row ONLY on a handset query — the
 * Arabic ear/head-phone words ("سماعة", "سماعات"). Stored in normalised form
 * (teh marbuta as ه) and matched via whole-Arabic-word boundaries.
 */
export const ARABIC_HANDSET_EXTRA_TERMS: readonly string[] = ["سماعه", "سماعات"];

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

/**
 * Build the word-boundary pattern for one accessory term, including its common
 * plural forms: plain +s, +es (glass→glasses, case→cases), and y→ies
 * (dummy→dummies). Phrases ("box only", "s pen") match exactly. This is what
 * makes "Fluffy Phone Cases" and "Nice Covers" die like their singular forms.
 */
function termPattern(term: string): string {
  if (/\s/.test(term)) return `(?:\\b${term.replace(ESCAPE_RE, "\\$&")}\\b)`;
  const base = term.replace(ESCAPE_RE, "\\$&");
  const variants = [base, `${base}s`];
  // Sibilant endings pluralize with +es: glass→glasses, lens→lenses, box→boxes.
  if (/[szx]$/i.test(base)) variants.push(`${base}es`);
  if (base.endsWith("y") && !/[aeiou]y$/i.test(base)) {
    variants.push(`${base.slice(0, -1)}ies`);
  }
  return `(?:\\b(?:${variants.join("|")})\\b)`;
}

/** Single word-boundary regex over every base accessory term. Case-insensitive. */
const ACCESSORY_TERM_RE = new RegExp(
  ACCESSORY_EXCLUSION_TERMS.map(termPattern).join("|"),
  "i",
);

/** Word-boundary regex over the handset-only extra terms (earphone/headphone). */
const HANDSET_EXTRA_TERM_RE = new RegExp(
  HANDSET_ACCESSORY_EXTRA_TERMS.map(termPattern).join("|"),
  "i",
);

/** True when the title carries any base accessory word. Pure. */
export function hasAccessoryTerm(title: string): boolean {
  return (
    ACCESSORY_TERM_RE.test(title) ||
    ARABIC_ACCESSORY_TERMS.some((term) => hasArabicTerm(title, term))
  );
}

/** True when the title carries any base OR handset-only accessory word. Pure. */
export function hasHandsetAccessoryTerm(title: string): boolean {
  return (
    hasAccessoryTerm(title) ||
    HANDSET_EXTRA_TERM_RE.test(title) ||
    ARABIC_HANDSET_EXTRA_TERMS.some((term) => hasArabicTerm(title, term))
  );
}

/**
 * True when the query is a HANDSET (phone-family) search. Handsets are the
 * target of the ABSOLUTE $150 floor and the expanded earphone/headphone
 * accessory set. Purely lexically derived from the same family classifier the
 * engine already trusts.
 */
export function isHandsetQuery(query: string): boolean {
  return detectProductFamily(query) === "phone";
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
 * renamed accessory. Pure. Exempts a genuine device from the base floor on
 * NON-handset device queries only; the handset floor is absolute.
 */
export function looksLikeGenuineDevice(title: string): boolean {
  if (hasAccessoryTerm(title)) return false;
  return (
    DEVICE_FAMILY_SIGNALS.some(({ re }) => re.test(title)) ||
    ARABIC_FAMILY_SIGNALS.some(({ terms }) =>
      terms.some((term) => hasArabicTerm(title, term)),
    )
  );
}

/**
 * Absolute USD floor for HAND (phone-family) queries — a real phone cannot
 * cost $2 or $8, so anything below $150 is dropped with no exemption.
 */
export const HANDSET_PRICE_FLOOR_USD = 150;
/** USD floor for NON-handset device queries (audio/tablet/laptop/…). */
export const DEVICE_PRICE_FLOOR_USD = 100;

/**
 * USD price floor for a query: handset (phone-family) queries use the absolute
 * $150 floor; every other device query keeps the $100 floor.
 */
export function devicePriceFloorUsd(query: string): number {
  return isHandsetQuery(query)
    ? HANDSET_PRICE_FLOOR_USD
    : DEVICE_PRICE_FLOOR_USD;
}

/** True when the price sits below the device floor for this query. */
export function belowDevicePriceFloor(priceUsd: number, query: string): boolean {
  return priceUsd < devicePriceFloorUsd(query);
}

/**
 * Normalise a row's price from its OWN currency into USD so the floor compares
 * like-for-like. "1,000 EGP" is ≈ $20.6 and must drop; "48,400 EGP" is ≈ $998
 * and stays. Returns `null` for an explicit currency we cannot convert (e.g.
 * UAH) — the guard then falls back to the raw numeric price, preserving the
 * pre-currency behaviour for such feeds (a genuine Admitad UAH handset must
 * not get dropped for lack of a conversion table).
 *
 * USD and missing currency are returned as-is. Pure.
 */
export function priceInUsd(
  price: number,
  currency?: string
): number | null {
  if (!currency || currency.toUpperCase() === "USD") return price;
  if (!isSupportedCurrency(currency)) return null;
  return convertAmount(price, currency, "USD");
}

/**
 * Pure row-level strict guard: a row survives a device-intent pool only when it
 * (a) carries no accessory word, (b) — on a brand-named device query — carries
 * at least one required brand-family name (must-contain), and (c) clears the
 * price floor (normalised to USD from the row's own currency). Single source
 * of truth used by both the live raw pool and every DB-supplement leg (pool
 * and paged tail).
 *
 * - HANDSET query: accessory terms include earphone/headphone; the $150 floor
 *   is ABSOLUTE — a genuine-looking title does NOT pass under it.
 * - NON-handset device query: base accessory terms only; a row below the $100
 *   floor survives only when it is itself a recognised genuine device (genuine
 *   sub-$150 earbuds/tablets/laptops are legitimate inventory).
 * - Brand-named query: a title with none of the family's branded names is
 *   unrelated inventory and drops BEFORE the floor ("Samsung S25" on an
 *   "iPhone" query; a speaker on a "pixel" query).
 */
export function passesStrictDeviceGuard(
  title: string,
  price: number,
  query: string,
  currency?: string,
): boolean {
  const handset = isHandsetQuery(query);
  if (handset ? hasHandsetAccessoryTerm(title) : hasAccessoryTerm(title)) {
    return false;
  }
  if (!titleMeetsRequiredBrand(title, query)) {
    return false;
  }
  const priceUsd = priceInUsd(price, currency);
  if (handset) {
    // ABSOLUTE handset floor — no genuine-below-floor carve-out.
    return (priceUsd ?? price) >= HANDSET_PRICE_FLOOR_USD;
  }
  // Non-handset device query: below the base floor only a recognised genuine
  // device survives (a $25 wireless earbud is a real product).
  if ((priceUsd ?? price) >= DEVICE_PRICE_FLOOR_USD) return true;
  return looksLikeGenuineDevice(title);
}

/**
 * Apply the strict device guard to a raw pool: drop accessory rows absolutely,
 * then drop must-contain failures, then drop below-floor rows (handset floor is
 * absolute; non-handset floor exempts recognised genuine devices). Pure — never
 * mutates the input.
 */
export function enforceStrictDevicePool<
  T extends { title: string; price: number; currency?: string },
>(listings: readonly T[], query: string): T[] {
  return listings.filter((listing) =>
    passesStrictDeviceGuard(listing.title, listing.price, query, listing.currency),
  );
}