-- Migration 023: deactivate fabricated seed coupons.
--
-- Zorino has NO real coupon/offer source yet (Admitad/eBay/AliExpress/CJ
-- deliver products, not coupons). The only `coupons` rows are seed/demo data:
-- generic offers, marked `verified = true`, with invented `used_times`
-- statistics. Presenting them as real would label seed data as real, which is
-- forbidden. This migration:
--   1. Deactivates every existing seed coupon (so none can surface).
--   2. Zeroes the fabricated usage counts.
--   3. Defaults new coupons to unverified (they must be confirmed against a
--      real offer source before display).
--
-- Combined with the code-level coupon gate (services/coupons.ts), no seed
-- coupon reaches the UI. Re-seeding coupons will not re-activate them because
-- the seed sets `verified = FALSE` and this migration keeps `is_active = FALSE`.

ALTER TABLE coupons ALTER COLUMN verified SET DEFAULT FALSE;

UPDATE coupons
SET
  is_active = FALSE,
  verified = FALSE,
  used_times = 0
WHERE is_active = TRUE OR used_times > 0 OR verified = TRUE;
