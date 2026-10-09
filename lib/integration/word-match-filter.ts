/**
 * Shared PostgREST word-boundary matching for `lowest_prices_today.product_name`.
 *
 * The DB supplement (search) and the Admitad connector's ingested-row top-up
 * both filter products by matching each query word as a WHOLE word, so short
 * tokens ("pro", "15") cannot match inside unrelated words ("waterproof",
 * "x15-box").
 *
 * PostgREST exposes that as a case-insensitive POSIX regex: `imatch` (→ `~*`).
 * `iregex` is NOT a valid PostgREST operator: it makes every such query fail
 * with `PGRST100` before it reaches Postgres. Both callers swallow that error,
 * so the entire DB-imported inventory silently disappeared from Search. Keep
 * the operator here, in one tested place, so it can never drift again.
 *
 * Beyond the raw word filter (kept byte-stable for the legacy callers + tests),
 * this module now ALSO exposes the NORMALIZED filter used by all production DB
 * legs: the query goes through `cleanSearchableText` (noise-stripped, Arabic
 * orthography + digits folded, dashes erased) and EACH canonical token expands
 * to its Arabic spelling variants (ايفون → آيفون/أيفون/إيفون) + plural forms,
 * so a typo/variant URL can no longer hide a provider's matching catalog rows.
 */

import {
  expandQueryToken,
  tokenize,
} from "@/lib/search/text-normalization";

/** Escape a query token before embedding it in a Postgres regex. */
export function escapeRegexToken(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a PostgREST `or` filter matching any of `words` as a whole word
 * (`\m…\M` word boundaries, case-insensitive) in `product_name`.
 */
export function buildWordBoundaryOrFilter(words: readonly string[]): string {
  return words
    .map((w) => `product_name.imatch.\\m${escapeRegexToken(w)}\\M`)
    .join(",");
}

/** Arabic spelling variants per canonical letter (hamza / yeh / teh-marbuta). */
const ARABIC_SPELLINGS: Record<string, readonly string[]> = {
  ا: ["ا", "أ", "إ", "آ", "ٱ"],
  ي: ["ي", "ى", "ی", "ێ"],
  ه: ["ه", "ة"],
};

/**
 * All orthographic spellings of one (already-normalised) token: "ايفون" →
 * ايفون/أيفون/إيفون/آيفون (+ yeh variants). Bound-checked to avoid blow-up.
 */
export function arabicSpellingVariants(token: string): string[] {
  if (!/[\u0627\u064A\u0647]/.test(token)) return [token];
  let results = [""];
  for (const ch of token) {
    const alts = ARABIC_SPELLINGS[ch];
    if (!alts) {
      results = results.map((r) => r + ch);
      continue;
    }
    const next: string[] = [];
    for (const r of results) {
      for (const alt of alts) next.push(r + alt);
    }
    if (next.length > 64) return [token];
    results = next;
  }
  return results;
}

/**
 * Canonical search tokens for a query: noise-stripped, orthography-folded,
 * deduped. `words.length === 0` callers may keep their empty-pool guard.
 */
export function querySearchTokens(query: string): string[] {
  return tokenize(query);
}

/** Canonical token → every regex alternation for that token. */
export function queryTokenGroups(query: string): Array<{ token: string; variants: string[] }> {
  return tokenize(query).map((token) => {
    const variants = new Set<string>();
    variants.add(token);
    for (const spelling of arabicSpellingVariants(token)) {
      for (const v of expandQueryToken(spelling)) variants.add(v);
    }
    for (const v of expandQueryToken(token)) variants.add(v);
    return { token, variants: [...variants] };
  });
}

/**
 * Normalized PostgREST `or` filter for a query: one whole-word alternation group
 * per canonical token covering its Arabic-spelling + plural variants. Every term
 * is `\m(variant1|variant2)\M` so raw `product_name` rows in ANY orthography
 * match. Returns "" for a query with no canonical tokens.
 */
export function buildNormalizedSearchOrFilter(query: string): string {
  return queryTokenGroups(query)
    .map(
      (g) =>
        `product_name.imatch.\\m(${g.variants.map(escapeRegexToken).join("|")})\\M`,
    )
    .join(",");
}
