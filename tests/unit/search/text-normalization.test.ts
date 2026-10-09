/**
 * Multilingual text normalization (lib/search/text-normalization.ts): the
 * shared query/product surface. Locks the canonical fold, e-commerce noise
 * stripping (whole-word only), plurals and token expansion. These helpers are
 * the multilingual counterpart to the locked `queryTokens` helpers — they exist
 * BESIDE them, never inside them.
 */
import { describe, expect, it } from "vitest";
import {
  cleanSearchableText,
  expandQueryToken,
  normalizeArabicText,
  normalizeText,
  pluralVariants,
  queryExpandedTokens,
  reversePlural,
  stripECommerceNoise,
  tokenize,
} from "@/lib/search/text-normalization";

describe("text-normalization: canonical surface", () => {
  it("folds Latin accents and case", () => {
    expect(normalizeText("MacBook Pro Résumé")).toBe("macbook pro resume");
  });

  it("folds Arabic hamza/ya/teh-marbuta and Indic/Persian digits", () => {
    expect(normalizeArabicText("آيفون إيفون أبل ى صناعة")).toBe(
      "ايفون ايفون ابل ي صناعه",
    );
    expect(normalizeText("هاتف ١٢٨ جيجابايت ۰۹")).toBe("هاتف 128 جيجابايت 09");
  });

  it("erases dash/hyphen variants to spaces", () => {
    expect(normalizeText("MacBook‑Pro 15")).toBe("macbook pro 15");
    expect(normalizeText("Tempered-Glass–For–iPhone")).toBe(
      "tempered glass for iphone",
    );
  });
});

describe("text-normalization: e-commerce noise", () => {
  const surface = (s: string) => s.replace(/\s+/g, " ").trim();

  it("strips whole English noise tokens and phrases (adjacent too)", () => {
    expect(surface(stripECommerceNoise("new original iphone 15 for sale official"))).toBe(
      "iphone 15",
    );
  });

  it("strips Arabic noise tokens/phrases", () => {
    expect(surface(stripECommerceNoise("هاتف جديد للبيع شحن مجاني"))).toBe("هاتف");
  });

  it("never eats real brand/product words", () => {
    expect(cleanSearchableText("iPhone 15 iPhone case")).toBe("iphone 15 iphone case");
    expect(cleanSearchableText("Sony WH-1000XM5")).toBe("sony wh 1000xm5");
  });

  it("full canonical surface collapses whitespace + strips noise in one pass", () => {
    expect(cleanSearchableText("  New   Original  iPhone 15 Pro — Max  ")).toBe(
      "iphone 15 pro max",
    );
  });
});

describe("text-normalization: tokenization", () => {
  it("dedupes tokens and drops single-char fragments", () => {
    expect(tokenize("a car car and bike")).toEqual(["car", "and", "bike"]);
  });

  it("tokenizes Arabic surfaces like the English ones", () => {
    expect(tokenize("ايفون 15 برو ماكس جديد")).toEqual(["ايفون", "15", "برو", "ماكس"]);
  });
});

describe("text-normalization: plurals", () => {
  it("builds English plural variants", () => {
    expect(pluralVariants("case")).toEqual(["case", "cases"]);
    expect(pluralVariants("glass")).toEqual(["glass", "glasses"]);
    expect(pluralVariants("dummy")).toEqual(["dummy", "dummies"]);
    expect(pluralVariants("axis")).toEqual(["axis", "axes"]);
    expect(pluralVariants("cases")).toEqual(["cases"]);
  });

  it("non-pluralizable tokens pass through", () => {
    expect(pluralVariants("15")).toEqual(["15"]);
  });

  it("reverse-pluralizes", () => {
    expect(reversePlural("cases")).toEqual(["case"]);
    expect(reversePlural("galaxies")).toEqual(["galaxy"]);
    expect(reversePlural("glass")).toEqual([]);
  });

  it("expands a query token to cover singular/plural rows", () => {
    expect(expandQueryToken("cases")).toEqual(["cases", "case"]);
    expect(expandQueryToken("case")).toEqual(["case", "cases"]);
  });

  it("expands every token of a query", () => {
    const expanded = queryExpandedTokens("phone case");
    expect(expanded.flat()).toContain("phone");
    expect(expanded.flat()).toContain("phones");
    expect(expanded.flat()).toContain("case");
    expect(expanded.flat()).toContain("cases");
  });
});