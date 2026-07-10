export const INTL_COOKIE_COUNTRY = "zor_country";
export const INTL_COOKIE_CURRENCY = "zor_currency";
export const INTL_COOKIE_LOCALE = "zor_locale";
export const INTL_COOKIE_GEO_DONE = "zor_geo_init";
export const INTL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type IntlCookieName =
  | typeof INTL_COOKIE_COUNTRY
  | typeof INTL_COOKIE_CURRENCY
  | typeof INTL_COOKIE_LOCALE
  | typeof INTL_COOKIE_GEO_DONE;
