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
 * EN  — single standard Western run (`31,353.80 EGP`).
 * AR  — the number and the currency symbol are rendered as two isolated bidi
 *       runs so the symbol (`ج.م.`) can never be reordered into the digits:
 *       `٩٤،٢٠٠٫٥٠` + `ج.م.` (whole amounts drop the piastres: `٩٤،٢٠٠`).
 */
export default function PriceText({ amount, className }: PriceTextProps) {
  const locale = useLocale() as Locale;
  const { formatPrice, currency } = useIntlPreferences();

  if (locale !== "ar") {
    return <span className={className}>{toLatinNumerals(formatPrice(amount))}</span>;
  }

  const parts = toArabicPriceParts(amount, currency.code);
  return (
    <span className={className} dir="rtl">
      <span className="price-text__number">{parts.number}</span>
      <span className="price-text__symbol">{parts.symbol}</span>
    </span>
  );
}