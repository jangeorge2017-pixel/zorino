import type { CurrencyCode, CountryCode } from "@/lib/international/config";
import {
  getCurrencyConfig,
  getDefaultCurrencyForCountry,
  isSupportedCurrency,
} from "@/lib/international/config";
import {
  convertAmount,
  getLiveExchangeRate,
  type LiveExchangeRateProvider,
} from "@/lib/international/exchange-rates";
import { formatCurrency as formatCurrencyIntl } from "@/lib/international/format";
import type { CurrencyOverride } from "@/lib/global-marketplace/types";

export type CurrencyServiceOptions = {
  /** Manual currency override (user-selected) */
  override?: CurrencyCode | null;
  /** Live exchange rate provider — swap without changing callers */
  liveRates?: LiveExchangeRateProvider;
  /** BCP 47 locale for formatting */
  formatLocale?: string;
};

/**
 * Global currency service — auto selection, manual override, future live rates.
 */
export class CurrencyService {
  private readonly override: CurrencyCode | null;
  private readonly liveRates?: LiveExchangeRateProvider;
  private readonly formatLocale?: string;

  constructor(options: CurrencyServiceOptions = {}) {
    this.override = options.override && isSupportedCurrency(options.override)
      ? options.override
      : null;
    this.liveRates = options.liveRates;
    this.formatLocale = options.formatLocale;
  }

  /** Resolve display currency: manual override → country default */
  resolveCurrency(countryCode: CountryCode, manualOverride?: CurrencyCode | null): CurrencyCode {
    const candidate = manualOverride ?? this.override;
    if (candidate && isSupportedCurrency(candidate)) return candidate;
    return getDefaultCurrencyForCountry(countryCode);
  }

  resolveWithSource(
    countryCode: CountryCode,
    manualOverride?: CurrencyCode | null
  ): CurrencyOverride {
    const candidate = manualOverride ?? this.override;
    if (candidate && isSupportedCurrency(candidate)) {
      return { currencyCode: candidate, source: "manual" };
    }
    return {
      currencyCode: getDefaultCurrencyForCountry(countryCode),
      source: "country-default",
    };
  }

  format(
    amount: number,
    currencyCode: CurrencyCode,
    options?: { fromCurrency?: CurrencyCode; locale?: string }
  ): string {
    return formatCurrencyIntl(amount, currencyCode, {
      locale: options?.locale ?? this.formatLocale,
      fromCurrency: options?.fromCurrency,
    });
  }

  convert(
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode
  ): number {
    return convertAmount(amount, from, to);
  }

  async convertLive(
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode
  ): Promise<number> {
    if (from === to) return amount;
    const rate = await getLiveExchangeRate(from, to, this.liveRates);
    return Math.round(amount * rate * 100) / 100;
  }

  getSymbol(currencyCode: CurrencyCode): string {
    return getCurrencyConfig(currencyCode).symbol;
  }
}

export function createCurrencyService(options?: CurrencyServiceOptions): CurrencyService {
  return new CurrencyService(options);
}

export { formatCurrencyIntl as formatCurrency };
