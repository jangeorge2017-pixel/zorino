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
 */

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
