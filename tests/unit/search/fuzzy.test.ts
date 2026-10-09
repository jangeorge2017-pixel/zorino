/**
 * Fuzzy matching (lib/search/fuzzy.ts): the typo-tolerant clustering tier.
 * Locks Levenshtein correctness, the 0.85 keep-threshold and the length guard
 * that stops short tokens from fuzzy-matching unrelated words.
 */
import { describe, expect, it } from "vitest";
import {
  FUZZY_TERM_THRESHOLD,
  isFuzzyTermMatch,
  levenshtein,
  levenshteinSimilarity,
  titleHasFuzzyKeyword,
} from "@/lib/search/fuzzy";

describe("fuzzy: levenshtein", () => {
  it("computes classic edit distances", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("galaxy", "galaxy")).toBe(0);
    expect(levenshtein("", "abc")).toBe(3);
  });

  it("early-exits past a bound", () => {
    expect(levenshtein("abcdef", "zzzzzz", 2)).toBe(3);
  });

  it("similarity is 1 − distance / maxLen", () => {
    expect(levenshteinSimilarity("galaxy", "glalaxy")).toBeGreaterThanOrEqual(
      FUZZY_TERM_THRESHOLD,
    );
    expect(levenshteinSimilarity("case", "casing")).toBeLessThan(FUZZY_TERM_THRESHOLD);
  });
});

describe("fuzzy: keep-threshold keep", () => {
  it("joins near-identical product terms", () => {
    expect(isFuzzyTermMatch("glalaxy", "galaxy")).toBe(true);
    expect(isFuzzyTermMatch("s24", "s24")).toBe(true);
  });

  it("applies the 0.85 threshold — typos pass, unrelated words do not", () => {
    expect(isFuzzyTermMatch("casing", "case")).toBe(false);
    expect(isFuzzyTermMatch("sumsung", "samsung")).toBe(true);
    expect(isFuzzyTermMatch("galaxi", "galaxy")).toBe(false);
  });

  it("scans a whole title for a fuzzy keyword", () => {
    expect(titleHasFuzzyKeyword("Samsung Glalaxy S24 256GB", "galaxy")).toBe(true);
    expect(titleHasFuzzyKeyword("Samung Galaxy S24", "samsung")).toBe(true);
    expect(titleHasFuzzyKeyword("Samsung Galaxy S24", "apple")).toBe(false);
  });
});