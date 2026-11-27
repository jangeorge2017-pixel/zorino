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
 *
 * Additionally, this module exports a fuzzy ILIKE filter for maximum recall
 * when the query has been translated from Arabic (or any case where we want
 * broad substring matching instead of word-boundary matching).
 */

import { getArabicSearchExpansionSync } from "@/lib/search/arabic-search-dictionary";
import {
  expandQueryToken,
  tokenize,
} from "@/lib/search/text-normalization";

/** Re-export tokenize for external use. */
export { tokenize } from "@/lib/search/text-normalization";

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

const BILINGUAL_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  ثلاجه: ["refrigerator", "fridge", "freezer"],
  ثلاجة: ["refrigerator", "fridge", "freezer"],
  ميكرويف: ["microwave"],
  مايكرويف: ["microwave"],
  مايكروويف: ["microwave"],
  غساله: ["washing machine"],
  غسالة: ["washing machine"],
  مكنسه: ["vacuum"],
  مكنسة: ["vacuum"],
  تلفاز: ["television", "tv"],
  تلفزيون: ["television", "tv"],
  جراب: ["case", "cover"],
  كفر: ["case", "cover"],
  غلاف: ["case", "cover"],
  شاحن: ["charger"],
  سامسونج: ["samsung"],
  نوت: ["note"],
  جالاكسي: ["galaxy"],
  ايفون: ["iphone"],
  ايباد: ["ipad"],
  لابتوب: ["laptop"],
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
  const groups = tokenize(query).map((token) => {
    const variants = new Set<string>();
    variants.add(token);
    for (const spelling of arabicSpellingVariants(token)) {
      for (const v of expandQueryToken(spelling)) variants.add(v);
    }
    for (const v of expandQueryToken(token)) variants.add(v);
    for (const alias of BILINGUAL_SEARCH_ALIASES[token] ?? []) {
      for (const aliasToken of tokenize(alias)) {
        variants.add(aliasToken);
        for (const v of expandQueryToken(aliasToken)) variants.add(v);
      }
    }
    return { token, variants: [...variants] };
  });

  const expansion = getArabicSearchExpansionSync(query);
  for (const term of [...expansion.english, ...expansion.arabic]) {
    for (const token of tokenize(term)) {
      if (groups.some((group) => group.token === token)) continue;
      groups.push({ token, variants: expandQueryToken(token) });
    }
  }

  return groups;
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

/**
 * Index-friendly PostgREST filter: one ILIKE clause per canonical query token.
 * The raw `product_name` GIN trigram index can serve these predicates, unlike
 * the `\m()\M` regex form, so the local Supabase lane stays fast on Render.
 */
export function buildIndexedSearchOrFilter(query: string): string {
  const tokens = [...new Set(queryTokenGroups(query).map((group) => group.token))];
  if (tokens.length === 0) return "";
  return tokens.map(buildIlikeClause).join(",");
}

/**
 * Build a PostgREST `or` filter using ILIKE (case-insensitive substring match)
 * for maximum recall. This matches the translated query term anywhere in the
 * product_name, not just as a whole word. Used when the original query was
 * Arabic and we want to cast a wide net to return thousands of products.
 *
 * @param query The (already translated) search query
 * @returns PostgREST `or` filter string using `product_name.ilike.%term%`
 */
export function buildFuzzyIlikeOrFilter(query: string): string {
  const tokens = tokenize(query);
  if (tokens.length === 0) return "";
  return tokens.map(buildIlikeClause).join(",");
}

const COMBINED_SEARCH_FILTER_LIMIT = 64;
const CATEGORY_SEARCH_FILTER_LIMIT = 96;

export function buildProductCategoryOrFilterWithColumns(
  queries: ReadonlyArray<string | undefined>,
  columns: readonly string[],
): string {
  const clauses: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    if (!query?.trim()) continue;
    for (const group of queryTokenGroups(query)) {
      for (const rawVariant of group.variants) {
        const variant = rawVariant.trim();
        if (!variant || seen.has(variant)) continue;
        seen.add(variant);
        for (const column of columns) {
          clauses.push(buildColumnIlikeClause(column, variant));
          if (clauses.length >= CATEGORY_SEARCH_FILTER_LIMIT) return clauses.join(",");
        }
      }
    }
  }

  return clauses.join(",");
}

export function buildProductCategoryOrFilter(
  ...queries: ReadonlyArray<string | undefined>
): string {
  return buildProductCategoryOrFilterWithColumns(queries, ["title"]);
}

export function buildCombinedSearchOrFilter(
  ...queries: ReadonlyArray<string | undefined>
): string {
  const variants: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    if (!query?.trim()) continue;
    for (const group of queryTokenGroups(query)) {
      for (const rawVariant of group.variants) {
        const variant = rawVariant.trim();
        if (!variant || seen.has(variant)) continue;
        seen.add(variant);
        variants.push(variant);
        if (variants.length >= COMBINED_SEARCH_FILTER_LIMIT) {
          return variants.map(buildIlikeClause).join(",");
        }
      }
    }
  }

  return variants.map(buildIlikeClause).join(",");
}

export function combinedSearchTokens(
  ...queries: ReadonlyArray<string | undefined>
): string[] {
  const tokens = new Set<string>();
  for (const query of queries) {
    if (!query?.trim()) continue;
    for (const group of queryTokenGroups(query)) {
      for (const token of group.variants) tokens.add(token);
    }
  }
  return [...tokens];
}

/**
 * Escape a token for use in ILIKE pattern (% and _ are wildcards in ILIKE).
 */
function escapeIlikeToken(token: string): string {
  return token.replace(/[%_\\]/g, "\\$&");
}

function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildColumnIlikeClause(column: string, token: string): string {
  return `${column}.ilike.${quotePostgrestValue(`%${escapeIlikeToken(token)}%`)}`;
}

function buildIlikeClause(token: string): string {
  return buildColumnIlikeClause("product_name", token);
}
