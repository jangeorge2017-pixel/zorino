-- 030_supported_currencies_countries.sql
-- Align the global reference tables with the markets the app actually supports.
--
-- WHY: lib/international/config.ts declares 7 currencies (USD, EUR, GBP, AED,
-- SAR, EGP, CAD) and 9 countries (US, GB, DE, FR, AE, SA, EG, CA, GLOBAL), but
-- migration 001 only seeded 5 of each. `prices.currency` and
-- `lowest_prices_today.currency` are FK-constrained to currencies(code), and
-- `lowest_prices_today.country_code` to countries(code). Any REAL provider feed
-- row denominated in EGP or CAD (e.g. an Admitad merchant program covering
-- Egypt/Canada) therefore failed the FK and the product was silently dropped
-- during ingestion — the feed router was NOT the limiter.
--
-- FIX: seed the missing reference rows so the generalized Admitad feed router
-- can persist every discovered merchant's listings in their real currency.
--
-- SAFETY: purely additive inserts, idempotent (ON CONFLICT DO NOTHING). No
-- existing row is modified. `db:push` applies this migration.

insert into currencies (code, name, symbol, decimal_places) values
  ('EGP', 'Egyptian Pound', 'E£', 2),
  ('CAD', 'Canadian Dollar', 'C$', 2)
on conflict (code) do nothing;

insert into countries (code, name, name_ar, default_currency) values
  ('FR', 'France', 'فرنسا', 'EUR'),
  ('EG', 'Egypt', 'مصر', 'EGP'),
  ('CA', 'Canada', 'كندا', 'CAD')
on conflict (code) do nothing;
