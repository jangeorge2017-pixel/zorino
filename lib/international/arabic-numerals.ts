/**
 * Arabic-Indic numeral helpers for AR-locale product-card displays.
 *
 * `toArabicNumerals` converts a NUMBER-ONLY string's Western decimal digits
 * (0-9) and numeric punctuation to their Eastern Arabic-Indic equivalents:
 *   12345     -> ١٢٣٤٥
 *   40,500    -> ٤٠،٥٠٠
 *   94,200.50 -> ٩٤،٢٠٠٫٥٠
 *   15%       -> ١٥٪
 *
 * The caller MUST pass a pure numeric portion — never a string containing the
 * currency symbol. The Latin `.` is mapped to the Arabic decimal separator (٫,
 * U+066B) so decimal digits stay visually detached from the whole-number pool;
 * the currency symbol is emitted separately via `toArabicPriceParts` /
 * `extractCurrencySymbol`, which is what keeps a dotted symbol like `ج.م.`
 * from ever being corrupted by (or bidi-reordered into) the digits.
 *
 * `toLatinNumerals` is the inverse guard used on EN displays: EGP/SAR prices
 * are emitted as Arabic-Indic numerals by their currency format locale
 * (ar-EG / ar-SA), so EN product cards normalize them back to standard
 * Western numerals.
 *
 * Both helpers are pure and locale-agnostic — callers decide when to apply
 * them (the product cards gate on `useLocale() === "ar"`).
 */

const WESTERN_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const ARABIC_INDIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"] as const;
const ARABIC_INDIC_INDEX = "٠١٢٣٤٥٦٧٨٩";

/** Convert a number-only string's Western digits (0-9), separators and percent sign to Arabic-Indic. */
export function toArabicNumerals(num: string | number): string {
  return String(num)
    .replace(/[0-9]/g, (digit) => ARABIC_INDIC_DIGITS[digit.charCodeAt(0) - 48])
    .replace(/,/g, "،")
    .replace(/\./g, "٫") // U+066B Arabic decimal separator
    .replace(/%/g, "٪");
}

/** Normalize Arabic-Indic digits and separators back to standard Western form. */
export function toLatinNumerals(num: string | number): string {
  return String(num)
    .replace(/[٠-٩]/g, (digit) => WESTERN_DIGITS[ARABIC_INDIC_INDEX.indexOf(digit)])
    .replace(/٬/g, ",") // U+066C Arabic thousands separator
    .replace(/٫/g, ".") // U+066B Arabic decimal separator
    .replace(/،/g, ",") // U+060C Arabic comma
    .replace(/٪/g, "%"); // U+066A Arabic percent sign
}

const BIDI_NOISE = /[\u200e\u200f\u202e\u202f\u00a0\u2028]/g;

/**
 * Extract the currency symbol the AR locale emits for a currency code
 * (e.g. `ج.م.` for EGP, `US$` for USD, `ر.س.` for SAR, `د.إ.` for AED),
 * stripping the Unicode-direction / spacing marks Intl injects around it.
 */
export function extractCurrencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat("ar", {
      style: "currency",
      currency: currencyCode,
    }).formatToParts(0);
    const symbol = parts
      .filter((part) => part.type === "currency")
      .map((part) => part.value)
      .join("")
      .replace(BIDI_NOISE, "")
      .trim();
    return symbol || currencyCode;
  } catch {
    return currencyCode;
  }
}

export type ArabicPriceParts = {
  number: string;
  symbol: string;
};

/**
 * Split a numeric amount into a bidi-safe Arabic-Indic `number` run and a
 * separate currency `symbol` run. The symbol is kept strictly OUTSIDE the
 * digit pool so the bidi algorithm can never reorder `ج.م.` inside the price.
 *
 * The amount is always forced to a whole integer with Math.round() and the
 * whole number is formatted with a standard thousands comma before being
 * converted to Arabic-Indic numerals:
 *   35402.58 -> ٣٥،٤٠٣
 *   94200    -> ٩٤،٢٠٠
 */
export function toArabicPriceParts(
  amount: number,
  currencyCode: string,
): ArabicPriceParts {
  const whole = Math.round(amount);
  const latin = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(whole);
  return {
    number: toArabicNumerals(latin),
    symbol: extractCurrencySymbol(currencyCode),
  };
}