"use client";

import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";
import { useIntlPreferences } from "@/components/international/IntlPreferencesProvider";
import {
  toArabicPriceParts,
  toLatinNumerals,
} from "@/lib/international/arabic-numerals";

type PriceTextProps = {
  amount: number;
  className?: string;
};

/**
 * Locale-aware price renderer used by every product card.
 *
 * EN — single standard Western run (`31,353.80 EGP`).
 *
 * AR — bulletproof plain-inline-block layout. No unicode-bidi, no flexbox:
 *        <span dir="rtl" style="display:inline-block">
 *          <span style="direction:ltr;display:inline-block">٣٥،٤٠٢</span>
 *          <span style="margin-right:4px">ج.م.</span>
 *        </span>
 *   The amount is forced to a whole integer with Math.round() first, so
 *   piastres never render (`35402.58` -> `٣٥،٤٠٣`). The digit span pins
 *   direction:ltr on an inline-block (an atomic inline the bidi algorithm
 *   cannot reorder from the inside), and the currency sits beside it in the
 *   RTL flow with a 4px gap.
 */
export default function PriceText({ amount, className }: PriceTextProps) {
  const locale = useLocale() as Locale;
  const { formatPrice, currency } = useIntlPreferences();

  if (locale !== "ar") {
    return <span className={className}>{toLatinNumerals(formatPrice(amount))}</span>;
  }

  const parts = toArabicPriceParts(Math.round(amount), currency.code);
  return (
    <span className={className} dir="rtl" style={{ display: "inline-block" }}>
      <span style={{ direction: "ltr", display: "inline-block" }}>{parts.number}</span>
      <span style={{ marginRight: 4 }}>{parts.symbol}</span>
    </span>
  );
}