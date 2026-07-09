import {
  INTL_COOKIE_COUNTRY,
  INTL_COOKIE_CURRENCY,
} from "@/lib/international/cookies";

/** Mirrors cookie keys — single source for client persistence */
export const INTL_STORAGE_COUNTRY = INTL_COOKIE_COUNTRY;
export const INTL_STORAGE_CURRENCY = INTL_COOKIE_CURRENCY;

export type IntlStorageSnapshot = {
  countryCode?: string;
  currencyCode?: string;
};

export function readIntlFromLocalStorage(): IntlStorageSnapshot {
  if (typeof window === "undefined") return {};
  try {
    return {
      countryCode: window.localStorage.getItem(INTL_STORAGE_COUNTRY) ?? undefined,
      currencyCode: window.localStorage.getItem(INTL_STORAGE_CURRENCY) ?? undefined,
    };
  } catch {
    return {};
  }
}

export function writeIntlToLocalStorage(snapshot: IntlStorageSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    if (snapshot.countryCode) {
      window.localStorage.setItem(INTL_STORAGE_COUNTRY, snapshot.countryCode);
    }
    if (snapshot.currencyCode) {
      window.localStorage.setItem(INTL_STORAGE_CURRENCY, snapshot.currencyCode);
    }
  } catch {
    // Private browsing / quota — cookies remain primary
  }
}

export function clearIntlLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(INTL_STORAGE_COUNTRY);
    window.localStorage.removeItem(INTL_STORAGE_CURRENCY);
  } catch {
    // ignore
  }
}
