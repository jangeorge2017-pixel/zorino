/**
 * AR-locale numeral conversion for product-card displays.
 *
 * `toArabicNumerals` is the AR-route renderer (digits + comma + percent to
 * Arabic-Indic). `toLatinNumerals` is the EN-route guard that normalizes the
 * Arabic-Indic output some currency locales (ar-EG / ar-SA) emit on English
 * pages back to standard Western numerals — so EN UI always reads standard.
 */
import { describe, expect, it } from "vitest";
import {
  toArabicNumerals,
  toLatinNumerals,
} from "@/lib/international/arabic-numerals";

describe("toArabicNumerals", () => {
  it("maps 0-9 to Arabic-Indic digits", () => {
    expect(toArabicNumerals("0123456789")).toBe("٠١٢٣٤٥٦٧٨٩");
  });

  it("accepts a number input", () => {
    expect(toArabicNumerals(12345)).toBe("١٢٣٤٥");
    expect(toArabicNumerals(0)).toBe("٠");
  });

  it("converts 40,500 -> ٤٠،٥٠٠ (thousands comma to Arabic comma)", () => {
    expect(toArabicNumerals("40,500")).toBe("٤٠،٥٠٠");
  });

  it("converts 15% -> ١٥٪ (percent sign to Arabic percent)", () => {
    expect(toArabicNumerals("15%")).toBe("١٥٪");
  });

  it("converts 2,500 -> ٢٥٠٠-style savings amounts", () => {
    expect(toArabicNumerals("2500")).toBe("٢٥٠٠");
  });

  it("wraps a full EGP price string without corrupting the ج.م. symbol", () => {
    expect(toArabicNumerals("41,176.50 ج.م.")).toBe("٤١،١٧٦.٥٠ ج.م.");
  });

  it("leaves Arabic-Indic digits and non-numeric text untouched", () => {
    expect(toArabicNumerals("وفر ٢٥٠٠ ج.م.")).toBe("وفر ٢٥٠٠ ج.م.");
  });
});

describe("toLatinNumerals", () => {
  it("maps Arabic-Indic digits ٠-٩ back to 0-9", () => {
    expect(toLatinNumerals("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  it("normalizes a full ar-EG price to standard numerals", () => {
    expect(toLatinNumerals("٤١٬١٧٦٫٥٠ ج.م.")).toBe("41,176.50 ج.م.");
  });

  it("normalizes Arabic comma separators to Western commas", () => {
    expect(toLatinNumerals("٤٠،٥٠٠")).toBe("40,500");
  });

  it("normalizes Arabic percent to standard percent", () => {
    expect(toLatinNumerals("١٥٪")).toBe("15%");
  });

  it("leaves an already-Latin string unchanged", () => {
    expect(toLatinNumerals("41,176.50 ج.م.")).toBe("41,176.50 ج.م.");
  });
});