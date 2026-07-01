import type { CurrencyCode } from "@/lib/international/config";

/**
 * Static exchange rates relative to USD.
 * Replace with live provider (Open Exchange Rates, ECB, etc.) in production.
 */
const USD_BASE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  EGP: 48.5,
  CAD: 1.36,
};

export type LiveExchangeRateProvider = {
  getRate: (from: CurrencyCode, to: CurrencyCode) => Promise<number>;
};

/** Synchronous conversion using static rates (USD pivot). */
export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number {
  if (from === to) return amount;
  const usd = amount / USD_BASE_RATES[from];
  return Math.round(usd * USD_BASE_RATES[to] * 100) / 100;
}

/** Architecture hook for live rates — swap implementation without changing callers. */
export async function getLiveExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode,
  provider?: LiveExchangeRateProvider
): Promise<number> {
  if (provider) {
    return provider.getRate(from, to);
  }
  return USD_BASE_RATES[to] / USD_BASE_RATES[from];
}

export function getStaticRates(): Readonly<Record<CurrencyCode, number>> {
  return USD_BASE_RATES;
}
