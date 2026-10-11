import {
  currencies,
  getCurrencyConfig,
  isSupportedCurrency,
  resolveFormatLocale,
} from "@/lib/international/config";
import { convertAmount } from "@/lib/international/exchange-rates";

/**
 * Format a monetary amount using Intl.NumberFormat.
 * @param amount - amount in the display currency (or pass fromCurrency for conversion)
 */
export function formatCurrency(
  amount: number,
  currencyCode: string,
  options?: {
    locale?: string;
    fromCurrency?: string;
  }
): string {
  const config = getCurrencyConfig(currencyCode);
  // Bind the Intl locale to the UI LANGUAGE, never the currency's region — an
  // EGP/SAR/AED row on an EN surface must render "EGP 50,000.00", not the
  // Arabic-Indic "٥٠٬٠٠٠ ج.م". No locale → neutral Latin default.
  const locale = resolveFormatLocale(options?.locale);

  let value = amount;
  const from = options?.fromCurrency;
  // Only convert when the source currency is one we can convert honestly;
  // an unsupported source renders its own magnitude (never a fabricated rate).
  if (from && from !== config.code && isSupportedCurrency(from)) {
    value = convertAmount(amount, from, config.code);
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: config.code,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(value);
}

export function formatPriceRange(
  min: number,
  max: number,
  currencyCode: string,
  locale?: string
): string {
  return `${formatCurrency(min, currencyCode, { locale })} – ${formatCurrency(max, currencyCode, { locale })}`;
}

export function getCurrencySymbol(currencyCode: string): string {
  return getCurrencyConfig(currencyCode).symbol;
}

export { currencies };
