/**
 * Arabic-Indic numeral helpers for AR-locale product-card displays.
 *
 * `toArabicNumerals` converts Western Arabic numerals (0-9) and numeric
 * punctuation to their Eastern Arabic-Indic equivalents:
 *   12345   -> ١٢٣٤٥
 *   40,500  -> ٤٠،٥٠٠
 *   15%     -> ١٥٪
 *
 * The ASCII decimal point is deliberately left untouched so currency-symbol
 * abbreviations that contain a dot (e.g. `ج.م.`, `د.إ`) are never corrupted.
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

/** Convert Western digits (0-9), commas and percent signs to Arabic-Indic. */
export function toArabicNumerals(num: string | number): string {
  return String(num)
    .replace(/[0-9]/g, (digit) => ARABIC_INDIC_DIGITS[digit.charCodeAt(0) - 48])
    .replace(/,/g, "،")
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