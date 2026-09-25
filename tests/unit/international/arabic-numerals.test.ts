/**
 * AR-locale numeral conversion for product-card displays.
 *
 * `toArabicNumerals` is the AR-route renderer for NUMBER-ONLY strings (digits,
 * separators, percent -> Arabic-Indic). `toLatinNumerals` is the EN-route guard
 * that normalizes the Arabic-Indic output some currency locales (ar-EG / ar-SA)
 * emit on English pages back to standard Western numerals — so EN UI always
 * reads standard. `extractCurrencySymbol` / `toArabicPriceParts` split a price
 * into an isolated number run and a separate currency-symbol run for bidi-safe
 * AR rendering.
 */
import { describe, expect, it } from "vitest";
import {
  extractCurrencySymbol,
  toArabicNumerals,
  toArabicPriceParts,
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

  it("converts 94,200.50 -> ٩٤،٢٠٠٫٥٠ (decimal dot to Arabic ٫)", () => {
    expect(toArabicNumerals("94,200.50")).toBe("٩٤،٢٠٠٫٥٠");
  });

  it("converts 2,500 -> ٢٥٠٠-style savings amounts", () => {
    expect(toArabicNumerals("2500")).toBe("٢٥٠٠");
  });

  it("only converts the numeric portion (callers pass pure numbers)", () => {
    expect(toArabicNumerals("وفر 2500")).toBe("وفر ٢٥٠٠");
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

describe("extractCurrencySymbol", () => {
  it("extracts ج.م. for EGP", () => {
    expect(extractCurrencySymbol("EGP")).toBe("ج.م.");
  });

  it("extracts US$ for USD", () => {
    expect(extractCurrencySymbol("USD")).toBe("US$");
  });

  it("extracts ر.س. for SAR", () => {
    expect(extractCurrencySymbol("SAR")).toBe("ر.س.");
  });

  it("extracts د.إ. for AED", () => {
    expect(extractCurrencySymbol("AED")).toBe("د.إ.");
  });

  it("falls back to the currency code for unknown codes", () => {
    expect(extractCurrencySymbol("NOPE")).toBe("NOPE");
  });
});

describe("toArabicPriceParts", () => {
  it("drops piastres/cents for whole amounts (3-rule hotfix)", () => {
    expect(toArabicPriceParts(94200, "EGP")).toEqual({
      number: "٩٤،٢٠٠",
      symbol: "ج.م.",
    });
    expect(toArabicPriceParts(54700, "EGP")).toEqual({
      number: "٥٤،٧٠٠",
      symbol: "ج.م.",
    });
  });

  it("keeps two decimals and the Arabic ٫ for fractional amounts", () => {
    expect(toArabicPriceParts(31353.8, "EGP")).toEqual({
      number: "٣١،٣٥٣٫٨٠",
      symbol: "ج.م.",
    });
    expect(toArabicPriceParts(27063.0, "EGP")).toEqual({
      number: "٢٧،٠٦٣",
      symbol: "ج.م.",
    });
  });

  it("keeps the symbol strictly outside the digit pool", () => {
    const { number, symbol } = toArabicPriceParts(94000, "EGP");
    expect(number.includes("ج")).toBe(false);
    expect(number.includes("م")).toBe(false);
    expect(symbol).toBe("ج.م.");
  });

  it("handles non-EGP currencies", () => {
    expect(toArabicPriceParts(41.5, "USD")).toEqual({
      number: "٤١٫٥٠",
      symbol: "US$",
    });
  });
});