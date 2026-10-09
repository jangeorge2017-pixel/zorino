/**
 * Strict product clustering — the comparison-group engine that decides whether
 * two offers are the SAME product across stores.
 *
 * Precise matching precedence (absolute precision contract):
 *   1. IDENTIFIER EQUALITY — a shared MPN / EAN / UPC / GTIN / ISBN / ASIN wins
 *      outright (1.00). Same identifier ⇒ same product, period.
 *   2. STRUCTURED SIGNATURE — identical [Brand]+[Model]+[Storage] on both
 *      sides (0.95). Storage is variant-strict: "256GB" and "512GB" are
 *      DIFFERENT devices and never merge. Family-word typos are absorbed at
 *      extraction time ("Glalaxy S24" ⇒ "Galaxy S24"), so equal signatures never
 *      depend on fragile whole-key fuzzy comparison — which would wrongly join
 *      "iPhone 15" and "iPhone 14".
 *   3. Fallback — the `matching.ts` title-similarity tier handles anything the
 *      structured extractors cannot pin down.
 *
 * Nothing here ever merges ACROSS providers on price-comparison terms that the
 * caller already guards (deduplication keeps one offer per provider+identity);
 * this module decides ONLY whether two offers are the same physical product.
 */

import { hasArabicTerm, titleContainsWord } from "@/lib/search/relevance";
import { normalizeText } from "@/lib/search/text-normalization";
import { levenshteinSimilarity, FUZZY_TERM_THRESHOLD } from "@/lib/search/fuzzy";
import type { ProductUniversalIdentifiers } from "@/lib/search/types";

/** A universal identifier parsed straight out of a product title. */
export type ExtractedIdentifier = {
  type: "gtin8" | "upc" | "ean" | "gtin14" | "isbn";
  value: string;
};

/** Confidence levels returned by `classifyListingPair`. */
export const IDENTIFIER_CONFIDENCE = 1;
export const SIGNATURE_CONFIDENCE = 0.95;

/* -------------------------------------------------------------------------- *
 * Brand
 * ------------------------------------------------------------------------ */

/** Arabic brand aliases (keys in NORMALISED orthography — ا/ي/ه). */
const ARABIC_BRAND_ALIASES: ReadonlyArray<[key: string, brand: string]> = ([
  ["سامسونج", "samsung"],
  ["جالكسي", "samsung"],
  ["ايفون", "apple"],
  ["ابل", "apple"],
  ["شاومي", "xiaomi"],
  ["هواوي", "huawei"],
  ["سوني", "sony"],
  ["لينوفو", "lenovo"],
  ["ديل", "dell"],
  ["اتش بي", "hp"],
  ["نوكيا", "nokia"],
  ["جوجل", "google"],
  ["موتورولا", "motorola"],
  ["اوبو", "oppo"],
  ["فيفو", "vivo"],
  ["ريلمي", "realme"],
  ["انفينكس", "infinix"],
  ["تيكنو", "tecno"],
  ["نينتندو", "nintendo"],
  ["مايكروسوفت", "microsoft"],
  ["بلايستيشن", "sony"],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

/** Latin device-name words that imply a brand identity (iphone ⇒ apple). */
const DEVICE_NAME_BRANDS: ReadonlyArray<[name: string, brand: string]> = [
  ["iphone", "apple"],
  ["ipad", "apple"],
  ["ipod", "apple"],
  ["macbook", "apple"],
  ["airpods", "apple"],
  ["apple watch", "apple"],
  ["galaxy", "samsung"],
  ["redmi", "xiaomi"],
  ["poco", "xiaomi"],
  ["pixel", "google"],
  ["playstation", "sony"],
  ["ps5", "sony"],
  ["xbox", "microsoft"],
  ["switch", "nintendo"],
  ["rtx", "nvidia"],
  ["geforce", "nvidia"],
];

/** Latin brand tokens, longest-first so "oneplus" beats "one". */
const LATIN_BRAND_TOKENS: readonly string[] = [
  "motorola",
  "microsoft",
  "samsung",
  "oneplus",
  "xiaomi",
  "realme",
  "infinix",
  "nothing phone",
  "nothing",
  "vivo",
  "huawei",
  "honor",
  "redmi",
  "poco",
  "nokia",
  "lenovo",
  "apple",
  "google",
  "sony",
  "oppo",
  "asus",
  "acer",
  "msi",
  "razer",
  "dell",
  "hp",
  "lg",
  "nvidia",
  "geforce",
  "playstation",
].sort((a, b) => b.length - a.length);

/** Canonicalised brand of a title, or null when no brand token is present. */
export function extractBrand(title: string): string | null {
  for (const [key, brand] of ARABIC_BRAND_ALIASES) {
    if (hasArabicTerm(title, key)) return brand;
  }
  const text = normalizeText(title);
  for (const [name, brand] of DEVICE_NAME_BRANDS) {
    if (titleContainsWord(text, name)) return brand;
  }
  for (const token of LATIN_BRAND_TOKENS) {
    if (titleContainsWord(text, token)) return token;
  }
  return null;
}

/* -------------------------------------------------------------------------- *
 * Arabic → Latin device-word transliteration
 * ------------------------------------------------------------------------ */

/**
 * Arabic device words mapped to the Latin tokens the structured extractors
 * understand. Keys are in NORMALISED Arabic orthography (ا/ي/ه, آ→ا). Sorted
 * longest-first so "ماك بوك برو" wins over "ماك بوك", and phrase pairs keep
 * word order ("ساعة ابل" → "apple watch", never "watch apple").
 */
const DEVICE_WORD_TRANSLITERATION: ReadonlyArray<[arabic: string, latin: string]> = ([
  ["ماك بوك برو", "macbook pro"],
  ["ماك بوك", "macbook"],
  ["اير بودز", "airpods"],
  ["تيرا بايت", "tb"],
  ["ساعة ابل", "apple watch"],
  ["ايفون", "iphone"],
  ["ايباد", "ipad"],
  ["ابل", "apple"],
  ["برو", "pro"],
  ["ماكس", "max"],
  ["الترا", "ultra"],
  ["ميني", "mini"],
  ["بلس", "plus"],
  ["فالز", "fold"],
  ["فليب", "flip"],
  ["جالكسي", "galaxy"],
  ["سامسونج", "samsung"],
  ["بيكسل", "pixel"],
  ["ووتش", "watch"],
  ["جيجابايت", "gb"],
  ["غيغابايت", "gb"],
  ["قيقابايت", "gb"],
  ["تيرابايت", "tb"],
] as [arabic: string, latin: string][]).sort((a, b) => b[0].length - a[0].length);

const transliterationCache = new Map<string, string>();

/**
 * Arabic sections of a title translated to their Latin device words so the
 * ASCII `\biphone\b`-style model/storage extractors can run on the SAME
 * surface for both orthographies ("آيفون 15 برو 256 جيجابايت" → "iphone 15
 * pro 256 gb"). Cached, pure.
 */
function transliterateDeviceText(text: string): string {
  if (!/[\u0600-\u06FF]/.test(text)) return text;
  const cached = transliterationCache.get(text);
  if (cached) return cached;
  let out = text;
  for (const [arabic, latin] of DEVICE_WORD_TRANSLITERATION) {
    const re = new RegExp(`(?:^|\\s)(${arabic})(?=$|\\s)`, "g");
    if (!re.test(out)) continue;
    out = out.replace(re, (match) =>
      match.startsWith(" ") ? ` ${latin}` : latin,
    );
  }
  const result = out.replace(/\s+/g, " ").trim();
  if (transliterationCache.size >= 2000) transliterationCache.clear();
  transliterationCache.set(text, result);
  return result;
}

/** Reset the transliteration memo (test hook). */
export function resetClusterTransliterationCacheForTests(): void {
  transliterationCache.clear();
}

/**
 * Known model-family words corrected against near-miss typos ("glalaxy" ⇒
 * "galaxy"). Only words ≥ 5 chars within one edit of a family word qualify, so
 * family typos are absorbed WITHOUT the false-merge danger of fuzzy-matching
 * canonical model keys (which would join "iPhone 15" and "iPhone 14").
 */
const MODEL_FAMILY_WORDS: readonly string[] = [
  "iphone",
  "ipad",
  "macbook",
  "airpods",
  "galaxy",
  "pixel",
  "playstation",
  "nintendo",
];

function correctModelFamilyTypos(text: string): string {
  return text
    .split(" ")
    .map((token) => {
      if (token.length < 5) return token;
      for (const family of MODEL_FAMILY_WORDS) {
        if (token === family) return token;
        if (
          Math.abs(token.length - family.length) <= 1 &&
          levenshteinSimilarity(token, family) >= FUZZY_TERM_THRESHOLD
        ) {
          return family;
        }
      }
      return token;
    })
    .join(" ");
}

/**
 * Structured text for model/storage extraction: canonical fold THEN Arabic
 * device-word transliteration (apple/iphone/galaxy/gb …) THEN family-word typo
 * correction, so the ASCII extractors below see one shared surface for English
 * and Arabic titles and cross-store typos.
 */
function structuredText(title: string): string {
  return correctModelFamilyTypos(transliterateDeviceText(normalizeText(title)));
}

/* -------------------------------------------------------------------------- *
 * Model
 * ------------------------------------------------------------------------ */

/** One structured model token per minimal family: "iphone-15-pro". */
export function extractModelKey(title: string): string | null {
  const t = structuredText(title);

  let m = t.match(/\biphone\s*(\d+)\s*(pro max|pro|plus|mini)?\b/);
  if (m) return `iphone-${m[1]}${m[2] ? `-${m[2].replace(" ", "-")}` : ""}`;

  m = t.match(/\bgalaxy\s*s(\d+)\s*(ultra|plus|fe)?\b/);
  if (m) return `galaxy-s${m[1]}${m[2] ? `-${m[2]}` : ""}`;

  m = t.match(/\bgalaxy\s*z\s*(fold|flip)\s*(\d+)?\b/);
  if (m) return `galaxy-z-${m[1]}${m[2] ? `-${m[2]}` : ""}`;

  m = t.match(/\bgalaxy\s*([a-z])(\d+)\b/);
  if (m) return `galaxy-${m[1]}${m[2]}`;

  m = t.match(/\bgalaxy\s*watch\s*(\d+)?\b/);
  if (m) return `galaxy-watch${m[1] ? `-${m[1]}` : ""}`;

  m = t.match(/\bmacbook\s*(pro|air)?\s*(m\d)?\b/);
  if (m) return `macbook${m[1] ? `-${m[1]}` : ""}${m[2] ? `-${m[2]}` : ""}`;

  m = t.match(/\bipad\s*(pro|air|mini)?\s*(\d+)?\b/);
  if (m) return `ipad${m[1] ? `-${m[1]}` : ""}${m[2] ? `-${m[2]}` : ""}`;

  m = t.match(/\bairpods\s*(pro|max|3|4)?\b/);
  if (m) return `airpods${m[1] ? `-${m[1]}` : ""}`;

  m = t.match(/\bpixel\s*(\d+)\s*(pro|a)?\b/);
  if (m) return `pixel-${m[1]}${m[2] ? `-${m[2]}` : ""}`;

  m = t.match(/\bapple\s*watch\s*(ultra)?\s*(s\d+)?\s*(\d+)?\b/);
  if (m) return `apple-watch${m[1] ? `-${m[1]}` : ""}${m[2] ? `-${m[2]}` : ""}`;

  m = t.match(/\brtx\s*(\d{4})\s*(ti|super)?\b/);
  if (m) return `rtx-${m[1]}${m[2] ? `-${m[2]}` : ""}`;

  m = t.match(/\b(ps5|playstation\s*5)\b/);
  if (m) return "ps5";

  m = t.match(/\bps4\s*pro?\b/);
  if (m) return "ps4";

  m = t.match(/\bxbox\s*(series\s*[sx]|one|360)?\b/);
  if (m) return `xbox-${m[1] ? m[1].replace(/\s+/g, "-") : "console"}`;

  m = t.match(/\bnintendo\s*switch\b/);
  if (m) return "switch";

  return null;
}

/** Normalised storage spec: "256gb", "1tb". Null when the title names none. */
export function extractStorageKey(title: string): string | null {
  const t = structuredText(title);
  const m = t.match(/\b(\d{1,4})\s*(gb|tb)\b/);
  return m ? `${m[1]}${m[2]}` : null;
}

/* -------------------------------------------------------------------------- *
 * Signature
 * ------------------------------------------------------------------------ */

export type ClusterSignature = {
  brand: string | null;
  model: string | null;
  storage: string | null;
  key: string;
};

const signatureCache = new Map<string, ClusterSignature>();

/** [Brand]+[Model]+[Storage] signature of ONE title. Cached, pure output. */
export function clusterSignature(title: string): ClusterSignature {
  const cached = signatureCache.get(title);
  if (cached) return cached;

  const brand = extractBrand(title);
  const model = extractModelKey(title);
  const storage = extractStorageKey(title);
  const key = [brand, model, storage].filter(Boolean).join("|");
  const sig: ClusterSignature = { brand, model, storage, key };

  if (signatureCache.size >= 2000) signatureCache.clear();
  signatureCache.set(title, sig);
  return sig;
}

/** Reset the signature memo (test hook). */
export function resetClusterSignatureCacheForTests(): void {
  signatureCache.clear();
}

/* -------------------------------------------------------------------------- *
 * Universal identifiers
 * ------------------------------------------------------------------------ */

/** Parse universal identifiers straight out of a title. Pure. */
export function extractUniversalIdentifiers(title: string): ExtractedIdentifier[] {
  const out: ExtractedIdentifier[] = [];
  const scan = (re: RegExp, type: ExtractedIdentifier["type"]): void => {
    for (const m of title.matchAll(re)) {
      out.push({ type, value: m[0] });
    }
  };
  // EAN/UPC/GTIN run: 8 (GTIN-8), 12 (UPC-A), 13 (EAN-13/GTIN-13), 14 (GTIN-14).
  scan(/\b\d{8}\b/g, "gtin8");
  scan(/\b\d{12}\b/g, "upc");
  scan(/\b\d{13}\b/g, "ean");
  scan(/\b\d{14}\b/g, "gtin14");
  // ISBN-10 or ISBN-13 (97[89] prefix), X check-digit allowed.
  const isbnRe = /\b(?:97[89]\d{10}|\d{9}[\dX])\b/g;
  for (const m of title.matchAll(isbnRe)) {
    const raw = m[0];
    if (raw.length === 10 || /^97[89]/.test(raw)) out.push({ type: "isbn", value: raw });
  }
  return out;
}

function normalizeIdentifierValue(value: string): string {
  return value.replace(/[\s\-_./]/g, "").toUpperCase();
}

/** All explicit + title-extracted identifiers for ONE listing. */
export function listingIdentifiers(
  title: string,
  explicit?: ProductUniversalIdentifiers,
): ExtractedIdentifier[] {
  const out: ExtractedIdentifier[] = [];
  const add = (type: string, value: string | undefined): void => {
    if (!value) return;
    out.push({ type: type as ExtractedIdentifier["type"], value: normalizeIdentifierValue(value) });
  };
  if (explicit) {
    add("ean", explicit.ean);
    add("upc", explicit.upc);
    add("gtin", explicit.gtin);
    add("isbn", explicit.isbn);
    add("asin", explicit.asin);
    add("mpn", explicit.mpn);
  }
  for (const id of extractUniversalIdentifiers(title)) {
    if (!out.some((existing) => existing.type === id.type && existing.value === id.value)) {
      out.push(id);
    }
  }
  return out;
}

/** True when two identifier sets share ANY value of the SAME type (strict). */
export function sharesProductIdentifier(
  a: readonly ExtractedIdentifier[],
  b: readonly ExtractedIdentifier[],
): boolean {
  for (const x of a) {
    if (b.some((y) => y.type === x.type && y.value === x.value)) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- *
 * Pair classification
 * ------------------------------------------------------------------------ */

export type ClusterableInput = {
  title: string;
  identifiers?: ProductUniversalIdentifiers;
};

function storageCompatible(sigA: ClusterSignature, sigB: ClusterSignature): boolean {
  if (sigA.storage !== null && sigB.storage !== null && sigA.storage !== sigB.storage) {
    return false;
  }
  return true;
}

/**
 * Classify a cross-store pair of offers by PRODUCT identity.
 * Returns a confidence in [0.95, 1] when the pair is the SAME product, or null
 * when they cannot be proven the same. `matching.ts` merges pairs scoring
 * ≥ 0.9 (identifier or structured signature). Pure.
 */
export function classifyListingPair(
  a: ClusterableInput,
  b: ClusterableInput,
): number | null {
  const idA = listingIdentifiers(a.title, a.identifiers);
  const idB = listingIdentifiers(b.title, b.identifiers);
  if (sharesProductIdentifier(idA, idB)) return IDENTIFIER_CONFIDENCE;

  const sigA = clusterSignature(a.title);
  const sigB = clusterSignature(b.title);
  if (!sigA.model || !sigB.model) return null;
  if (sigA.model !== sigB.model) return null;
  if (sigA.brand !== null && sigB.brand !== null && sigA.brand !== sigB.brand) {
    return null;
  }
  if (!storageCompatible(sigA, sigB)) return null;
  return SIGNATURE_CONFIDENCE;
}

/** Convenience wrapper used by tests and `matching.ts`. */
export function listingsClusterTogether(
  aTitle: string,
  bTitle: string,
  aIdentifiers?: ProductUniversalIdentifiers,
  bIdentifiers?: ProductUniversalIdentifiers,
): boolean {
  return (
    classifyListingPair(
      { title: aTitle, identifiers: aIdentifiers },
      { title: bTitle, identifiers: bIdentifiers },
    ) !== null
  );
}

/**
 * PROVEN-different test: true when the pair's structured signals CONFLICT —
 * shared identifier type with differing values, or an equal/fuzzy-equivalent
 * model with a different brand or incompatible storage. A conflict must hard-
 * block a merge even when the legacy title-similarity tier would have joined
 * the pair ("S24 Ultra 256GB" vs "S24 Ultra 512GB" never merge). Absence of
 * proof (no model on either side) returns false — the caller keeps its fallback.
 */
export function listingPairProvenDifferent(
  a: ClusterableInput,
  b: ClusterableInput,
): boolean {
  const idA = listingIdentifiers(a.title, a.identifiers);
  const idB = listingIdentifiers(b.title, b.identifiers);
  for (const x of idA) {
    if (idB.some((y) => y.type === x.type && y.value !== x.value)) return true;
  }

  const sigA = clusterSignature(a.title);
  const sigB = clusterSignature(b.title);
  if (!sigA.model || !sigB.model) return false;
  if (sigA.model !== sigB.model) return false;
  if (sigA.brand !== null && sigB.brand !== null && sigA.brand !== sigB.brand) {
    return true;
  }
  if (
    sigA.storage !== null &&
    sigB.storage !== null &&
    sigA.storage !== sigB.storage
  ) {
    return true;
  }
  return false;
}