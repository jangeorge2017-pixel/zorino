/**
 * Render-side currency normalisation for the search pages.
 *
 * Provider listings carry their REAL source currency: AliExpress / eBay /
 * CJ live API rows and the US-catalog database legs are USD; Egypt-region rows
 * (amazon-eg) are already EGP; rows with no currency field are US-catalog
 * database rows and therefore USD. Some non-region Admitad feeds (e.g.
 * touch.com.ua) carry prices in a currency Zorino does not model (UAH) — those
 * rows are returned untouched rather than mislabeled as USD. The UI renders prices in the
 * visitor's regional currency (EGP for Egypt), but components call
 * `formatPrice(item.price)` WITHOUT `fromCurrency` — so an untouched $849
 * listing used to render as "849 ج.م" (raw USD digits wearing an EGP label).
 *
 * This seam converts the ACTUAL numeric value to EGP at the library boundary
 * where listings leave the search pipeline and enter rendering, and stamps
 * `currency: "EGP"` so the number and the label always agree. It is applied at
 * the landing surfaces (searchProductsSurface / searchResultsPagedSurface),
 * NOT inside the engine or the canonical pool: price floors, dedup, condition
 * diversity, and cross-currency compare ratios must keep consuming the real
 * source currency. Rows already in EGP are returned untouched — never
 * double-converted.
 */

import type { SearchResultItem } from "@/lib/data/homepage";
import {
  convertAmount,
} from "@/lib/international/exchange-rates";
import {
  isSupportedCurrency,
  type CurrencyCode,
} from "@/lib/international/config";

export const DISPLAY_CURRENCY: CurrencyCode = "EGP";

/**
 * Convert every search result's price/originalPrice to the display currency
 * (EGP) and stamp `currency` so the rendered label matches the number.
 *
 * Source-currency decision:
 * - Explicit EGP (amazon-eg, already-converted rows) → pass through untouched,
 *   never double-converted.
 * - Explicit supported currency (USD/EUR/GBP/AED/SAR/CAD) → real conversion.
 * - No currency field → US-catalog database row, contract says USD.
 * - Explicit but UNSUPPORTED currency (e.g. UAH from non-region Admitad feeds)
 *   → return untouched. We have no honest rate for it; defaulting it to USD
 *   would fabricate a ~48x-inflated price. Better to show the provider's own
 *   number unconverted than a fictional one.
 *
 * Pure; never mutates input items.
 */
export function toEgpDisplayCurrency(
  items: readonly SearchResultItem[],
): SearchResultItem[] {
  return items.map((item) => {
    const raw = item.currency;
    if (!raw) {
      return convertRow(item, "USD");
    }
    if (!isSupportedCurrency(raw)) {
      return item;
    }
    if (raw === "EGP") return item;
    return convertRow(item, raw as CurrencyCode);
  });
}

function convertRow(item: SearchResultItem, from: CurrencyCode): SearchResultItem {
  return {
    ...item,
    price: convertAmount(item.price, from, DISPLAY_CURRENCY),
    originalPrice: convertAmount(item.originalPrice, from, DISPLAY_CURRENCY),
    currency: DISPLAY_CURRENCY,
  };
}