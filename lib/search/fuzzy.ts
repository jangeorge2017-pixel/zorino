/**
 * Fuzzy string matching for search — the typo-tolerant tier of the matching
 * stack. Exact word matches always win; when a query token and a candidate
 * token are *close* (Levenshtein similarity ≥ 0.85, the canonical keep-threshold
 * for near-identical product terms) the pair is treated as the same term so a
 * "Samsung Glalaxy" title still clusters with "Galaxy" offers instead of
 * fragmenting the comparison block.
 *
 * Deliberately NOT wired into the raw relevance tiers (`analyzeSearchListing`)
 * whose exact-token behaviour is locked by regression tests — fuzzy matching
 * refines CLUSTERING between already-relevant results, it never re-ranks.
 */

/** Classic Levenshtein edit distance with an early-exit upper bound. */
export function levenshtein(a: string, b: string, maxDistance?: number): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  if (maxDistance !== undefined && Math.abs(la - lb) > maxDistance) {
    return maxDistance + 1;
  }

  let prev = Array.from({ length: lb + 1 }, (_, j) => j);
  const cap = maxDistance !== undefined ? maxDistance : -1;

  for (let i = 1; i <= la; i++) {
    let rowMin = Infinity;
    const curr = new Array<number>(lb + 1);
    curr[0] = i;
    const chA = a[i - 1];
    for (let j = 1; j <= lb; j++) {
      const cost = chA === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (cap >= 0 && rowMin > cap) return cap + 1;
    prev = curr;
  }
  return prev[lb];
}

/** Similarity in [0,1]: 1 − distance / max(len). Pure. */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return Math.max(0, 1 - levenshtein(a, b) / maxLen);
}

/** Standard keep threshold for near-identical product terms. */
export const FUZZY_TERM_THRESHOLD = 0.85;

/**
 * True when `candidate` is a whole-word fuzzy match for `queryToken`:
 * Levenshtein similarity ≥ `threshold` AND a length guard so a short token can
 * never fuzzy-match a long unrelated word ("case" vs "casing" at 0.67 stays
 * out; "galaxy" vs "glalaxy" at 0.92 comes in). Pure.
 */
export function isFuzzyTermMatch(
  candidate: string,
  queryToken: string,
  threshold: number = FUZZY_TERM_THRESHOLD,
): boolean {
  if (!queryToken || !candidate) return false;
  if (candidate === queryToken) return true;
  const short = Math.min(candidate.length, queryToken.length);
  if (short < 4) return false;
  const long = Math.max(candidate.length, queryToken.length);
  if (long / short > 1.35) return false;
  return levenshteinSimilarity(candidate, queryToken) >= threshold;
}

/**
 * True when `title` contains a whole word fuzzy-matching `queryToken`
 * (normalised tokens only). Used by strict clustering to join near-identical
 * model tokens across stores. Pure.
 */
export function titleHasFuzzyKeyword(
  title: string,
  queryToken: string,
  threshold: number = FUZZY_TERM_THRESHOLD,
): boolean {
  if (!queryToken) return false;
  const words = title.toLowerCase().split(/\s+/);
  return words.some((word) => isFuzzyTermMatch(word, queryToken, threshold));
}