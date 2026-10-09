/**
 * Multilingual text normalisation for search — the shared vocabulary between
 * QUERY parsing and PRODUCT indexing.
 *
 * The OLD pipeline compared raw query tokens against raw provider titles with
 * ASCII `\b` word boundaries and no folding: "MacBook‑Pro" (U+2011) never
 * matched "macbook pro", Arabic "آيفون/إيفون" split families on hamza variants,
 * "128GB" and "128GB" in different scripts (٠-٩ / ۰-۹) were different tokens,
 * and e-commerce noise words ("new", "original", "free shipping", "للبيع")
 * polluted token sets on both sides.
 *
 * This module normalises BOTH sides to one canonical surface before any
 * comparison:
 *
 *   NFC → lowercase → Latin accent fold (é→e) → Arabic orthography fold
 *   (أإآ→ا, ى/ی→ي, ة→ه, tashkeel/tatweel stripped) → Indic/Persian digits →
 *   ASCII → dash variants erased to spaces → e-commerce noise removed.
 *
 * All functions are pure. None of the locked query-surface helpers
 * (`queryTokens`, `buildWordBoundaryOrFilter`, `hasArabicTerm`) depend on this
 * module, so their existing test-pinned behaviour is untouched.
 */

/** NFC-normalise + lowercase + fold Latin accents (é→e, ü→u, …). */
export function normalizeLatin(text: string): string {
  return text
    .normalize("NFC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .toLowerCase();
}

/**
 * Arabic orthography fold — the SAME characters `relevance.normalizeArabic`
 * maps (hamza variants → ا, ي; teh-marbuta → ه; tashkeel/tatweel stripped), so
 * a token normalised here still matches a title checked by `hasArabicTerm`.
 * Additionally maps Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII so
 * "128GB" matches "١٢٨GB".
 */
export function normalizeArabicText(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0640\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى|\u06CC|\u06CE/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u0660-\u0669]/g, (d) => String((d.charCodeAt(0) - 0x0660) % 10))
    .replace(/[\u06F0-\u06F9]/g, (d) => String((d.charCodeAt(0) - 0x06f0) % 10));
}

/** Dash/hyphen variants erased to a plain space so tokens split cleanly. */
const DASH_VARIANTS_RE =
  /[\u002d\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00ad\ufe58\ufe63\uff0d]/g;

/**
 * Full canonical normalisation for SEARCH:
 * NFC → Latin accent fold → lowercase → Arabic fold → digits → dashes erased.
 * Keeps letters, digits and spaces; everything else is left in place (quotes,
 * brackets, slashes) so the text stays greppable for phrase patterns.
 */
export function normalizeText(text: string): string {
  return normalizeArabicText(
    normalizeLatin(text.replace(DASH_VARIANTS_RE, " ")),
  );
}

/**
 * E-commerce noise — tokens that carry ZERO product identity. Queries and
 * titles both drop them before matching so "New Original iPhone 15 for Sale"
 * and "iphone 15" describe the same product surface.
 *
 * English single tokens are the high-volume filler; Arabic terms are stored in
 * the SAME normalised form `normalizeText` produces (ا/ي/ه, no diacritics). All
 * tokens are matched as WHOLE words so "original" never eats a legitimately
 * named product and "مجاني" never touches "شاحن".
 */
export const E_COMMERCE_NOISE_TERMS: readonly string[] = [
  // English
  "new",
  "original",
  "genuine",
  "authentic",
  "official",
  "wholesale",
  "cheap",
  "discount",
  "promo",
  "promotion",
  "deal",
  "deals",
  "sale",
  "sales",
  "clearance",
  "bargain",
  "free",
  "shipping",
  "delivery",
  "fast",
  "best",
  "price",
  "offer",
  "offers",
  "limited",
  "stock",
  "buy",
  "shop",
  "return",
  "returns",
  // Arabic (normalised)
  "للبيع",
  "جديد",
  "اصلي",
  "الاصلي",
  "اصليه",
  "مجاني",
  "شحن",
  "خصم",
  "تخفيض",
  "تخفيضات",
];

/** Multi-word noise phrases removed verbatim from titles/index text. */
export const E_COMMERCE_NOISE_PHRASES: readonly string[] = [
  "for sale",
  "free shipping",
  "free delivery",
  "fast shipping",
  "fast delivery",
  "free returns",
  "easy returns",
  "hot sale",
  "on sale",
  "great deal",
  "best price",
  "special offer",
  "special price",
  "official store",
  "brand new",
  "clearance sale",
  "black friday",
  "cyber monday",
  "shop now",
  "buy now",
  "limited time",
  "limited offer",
  "price drop",
  "شحن مجاني",
  "توصيل مجاني",
  "خصم خاص",
  "خصم كبير",
];

function escapeNoiseTerm(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const NOISE_RE = (() => {
  const terms = [...E_COMMERCE_NOISE_TERMS, ...E_COMMERCE_NOISE_PHRASES]
    .sort((a, b) => b.length - a.length)
    .map(escapeNoiseTerm)
    .join("|");
  // Zero-width boundaries (lookbehind/lookahead) so ADJACENT noise words are
  // all stripped in one pass — the old consuming-boundary form ate the space
  // before the next term and skipped "new original … official" partners.
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${terms})(?![\\p{L}\\p{N}])`, "gu");
})();

/**
 * Strip e-commerce noise tokens + phrases from an ALREADY `normalizeText`-ed
 * string. Whole-word removal only. Pure.
 */
export function stripECommerceNoise(text: string): string {
  return text.replace(NOISE_RE, " ");
}

/** One replacement happens before the next match scan on the replaced text. */
function replaceSinglePass(input: string): string {
  return input.replace(NOISE_RE, " ");
}

/**
 * Canonical SEARCHABLE text for a query or a title: `normalizeText` →
 * noise-stripped → whitespace collapsed. Both sides of any comparison must go
 * through this so noise words and orthographic variants can never split an
 * otherwise identical product surface.
 */
export function cleanSearchableText(text: string): string {
  return replaceSinglePass(normalizeText(text))
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenise a searchable surface: canonical text split into word tokens. */
export function tokenize(text: string): string[] {
  const tokens = cleanSearchableText(text).split(/\s+/).filter((w) => w.length > 1);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    unique.push(token);
  }
  return unique;
}

/**
 * English plural variants for one token: base, +s, +es for sibilants, y→ies,
 * and the irregular vowel-shift (axis→axes, analysis→analyses). Used to expand
 * a query token so a singular query still reaches plural catalogue rows and
 * vice-versa. Pure; non-letter tokens return as-is.
 */
export function pluralVariants(word: string): string[] {
  if (!/[a-z]{2}/i.test(word)) return [word];
  // Already plural (ends in s but not the "ss" of a singular like "glass"):
  // leave it to reversePlural to supply the singular form.
  if (/s$/i.test(word) && !/ss$/i.test(word) && !/is$/i.test(word)) return [word];
  const variants = [word];
  if (/[bcdfghjklmnpqrstvwxz]y$/.test(word)) {
    variants.push(`${word.slice(0, -1)}ies`);
  } else if (/is$/.test(word)) {
    variants.push(`${word.slice(0, -2)}es`); // axis → axes
  } else if (/(s|x|z|ch|sh|ss)$/.test(word)) {
    variants.push(`${word}es`);
  } else {
    variants.push(`${word}s`);
  }
  return [...new Set(variants)];
}

/** Reverse-pluralisation: cases→case, cables→cable, glasses→glass, galaxies→galaxy. */
export function reversePlural(word: string): string[] {
  const out: string[] = [];
  if (word.length < 4) return out;
  if (/ies$/.test(word)) {
    out.push(`${word.slice(0, -3)}y`);
  } else if (/(?:ss|x|z|ch|sh)es$/.test(word)) {
    out.push(word.slice(0, -2)); // glasses→glass, boxes→box, dishes→dish
  } else if (/s$/.test(word) && !/(ss|us|is|os|as)$/.test(word)) {
    out.push(word.slice(0, -1)); // cases→case, cables→cable
  }
  return out;
}

/**
 * One query token → the canonical variant set used to build a DB OR filter:
 * the token itself + its plural variants + its reverse-plural form, so
 * "case" matches "cases" rows and "cases" matches "case" rows in raw titles.
 */
export function expandQueryToken(token: string): string[] {
  const variants = new Set<string>([token]);
  for (const plural of pluralVariants(token)) variants.add(plural);
  for (const singular of reversePlural(token)) variants.add(singular);
  return [...variants];
}

/** Full canonical { token → variants } map for a query. */
export function queryExpandedTokens(query: string): string[][] {
  return tokenize(query).map((token) => expandQueryToken(token));
}