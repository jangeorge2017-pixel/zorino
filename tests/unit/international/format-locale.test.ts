/**
 * Locale-bound currency formatting.
 *
 * Regression: on the EN surface, `formatCurrency` fell back to the CURRENCY's
 * region locale (EGP -> ar-EG, SAR -> ar-SA, AED -> ar-AE) whenever no UI
 * locale was passed. English pages therefore rendered EGP/SAR/AED prices with
 * Arabic-Indic digits and the Arabic symbol (ج.م / ر.س / د.إ). The formatting
 * locale must now track the UI LANGUAGE: "en" -> Latin digits + international
 * symbol, "ar" -> Arabic symbol, and no locale -> neutral Latin default.
 */
import { describe, expect, it } from "vitest";
import { formatCurrency, formatPriceRange } from "@/lib/international/format";
import { DEFAULT_FORMAT_LOCALE, resolveFormatLocale } from "@/lib/international/config";

const ARABIC_SYMBOLS = /[\u0600-\u06FF]/;
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/;

describe("resolveFormatLocale", () => {
  it("maps the bare app locales to language-driven Intl locales", () => {
    expect(resolveFormatLocale("en")).toBe("en-US");
    expect(resolveFormatLocale("ar")).toBe("ar");
  });

  it("defaults to the neutral Latin locale when no locale is given", () => {
    expect(resolveFormatLocale(undefined)).toBe(DEFAULT_FORMAT_LOCALE);
    expect(DEFAULT_FORMAT_LOCALE).toBe("en-US");
  });

  it("honours an explicit BCP 47 region tag", () => {
    expect(resolveFormatLocale("ar-EG")).toBe("ar-EG");
    expect(resolveFormatLocale("en-GB")).toBe("en-GB");
  });
});

describe("formatCurrency locale binding", () => {
  it("renders EGP on the EN surface with Latin digits and the international symbol", () => {
    const out = formatCurrency(50000, "EGP", { locale: "en" });
    expect(out).toContain("EGP");
    expect(out).toContain("50,000.00");
    expect(ARABIC_SYMBOLS.test(out)).toBe(false);
    expect(ARABIC_INDIC_DIGITS.test(out)).toBe(false);
  });

  it("never falls back to the currency region locale when no locale is passed", () => {
    for (const code of ["EGP", "SAR", "AED"] as const) {
      const out = formatCurrency(50000, code);
      expect(ARABIC_SYMBOLS.test(out)).toBe(false);
      expect(ARABIC_INDIC_DIGITS.test(out)).toBe(false);
      expect(out).toContain(code);
    }
  });

  it("still renders the Arabic symbol on the AR surface", () => {
    expect(formatCurrency(50000, "EGP", { locale: "ar" })).toContain("ج");
  });

  it("keeps the formatPriceRange helper Latin on the EN surface", () => {
    const out = formatPriceRange(10000, 50000, "EGP", "en");
    expect(ARABIC_SYMBOLS.test(out)).toBe(false);
    expect(out).toContain("EGP");
  });

  it("converts a supported fromCurrency while staying locale-correct", () => {
    const out = formatCurrency(50000, "EGP", { locale: "en", fromCurrency: "USD" });
    expect(out).toContain("EGP");
    expect(ARABIC_SYMBOLS.test(out)).toBe(false);
    // 50,000 USD at the static 48.5 pivot -> 2,425,000 EGP
    expect(out).toContain("2,425,000.00");
  });

  it("renders the raw magnitude (no fabricated rate) for an unsupported fromCurrency", () => {
    const out = formatCurrency(50000, "EGP", { locale: "en", fromCurrency: "UAH" });
    expect(out).toContain("50,000.00");
    expect(ARABIC_SYMBOLS.test(out)).toBe(false);
  });
});
