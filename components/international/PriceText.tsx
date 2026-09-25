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
 * AR — digits and currency symbol are TWO separate flex items, each its own
 *      bidi-isolated context so they can NEVER reorder across each other:
 *        <span class="price-amount" dir="ltr">٣٥،٤٠٢</span>
 *        <span class="price-currency">ج.م</span>
 *      The container is an inline-flex `row-reverse` with a 4px gap, keeping
 *      the symbol beside a perfectly-ordered, non-reversed numeral run
 *      (whole amounts drop piastres: ٣٥،٤٠٢, never ٣٥،٤٠٢٫٠٠).
 */
export default function PriceText({ amount, className }: PriceTextProps) {
  const locale = useLocale() as Locale;
  const { formatPrice, currency } = useIntlPreferences();

  if (locale !== "ar") {
    return <span className={className}>{toLatinNumerals(formatPrice(amount))}</span>;
  }

  const parts = toArabicPriceParts(amount, currency.code);
  return (
    <span className={`price-text${className ? ` ${className}` : ""}`}>
      <span className="price-amount" dir="ltr">
        {parts.number}
      </span>
      <span className="price-currency">{parts.symbol}</span>
    </span>
  );
}