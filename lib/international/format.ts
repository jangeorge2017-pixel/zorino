import type { CurrencyCode } from "@/lib/international/config";
import { currencies, getCurrencyConfig } from "@/lib/international/config";
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
    fromCurrency?: CurrencyCode;
  }
): string {
  const config = getCurrencyConfig(currencyCode);
  const locale = options?.locale ?? config.formatLocale;

  let value = amount;
  if (options?.fromCurrency && options.fromCurrency !== config.code) {
    value = convertAmount(amount, options.fromCurrency, config.code);
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
