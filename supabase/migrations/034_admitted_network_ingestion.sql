-- Migration 034: Admitad approved-network ingestion support.
--
-- The master program sheet (82 approved merchants) and the Admitad coupon feed
-- are the authoritative source for the coupon/deal surfaces. This migration is
-- additive and lets the ingestion script upsert real rows without collisions:
--
--   1. Coupons: drop the global `code` uniqueness (the same promo code can be
--      issued by several merchants, and an Admitad "action" offer legitimately
--      repeats "Not required"). Identity is now the Admitad coupon id.
--   2. Coupons: store the real affiliate link, description, category, offer
--      type, exclusivity, source and the issuing campaign id.
--   3. Stores: mark rows that came from the approved Admitad network master.
--   4. Currencies: add the face-value currencies present in the real feed.
--
-- No products, offers or statistics are seeded here.

ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_code_key;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS affiliate_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS coupon_type TEXT NOT NULL DEFAULT 'promocode',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS exclusive BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coupons_external_id_key'
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_external_id_key UNIQUE (external_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_coupons_code
  ON public.coupons (code);

CREATE INDEX IF NOT EXISTS idx_coupons_source_active
  ON public.coupons (source, is_active);

CREATE INDEX IF NOT EXISTS idx_coupons_store_active
  ON public.coupons (store_id, is_active);

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS admitted_network TEXT,
  ADD COLUMN IF NOT EXISTS admitted_campaign_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_admitted_campaign
  ON public.stores (admitted_campaign_id)
  WHERE admitted_campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stores_admitted_active
  ON public.stores (admitted_network, is_active);

INSERT INTO public.currencies (code, name, symbol) VALUES
  ('EGP', 'Egyptian Pound', 'E£'),
  ('CAD', 'Canadian Dollar', 'C$'),
  ('BRL', 'Brazilian Real', 'R$'),
  ('INR', 'Indian Rupee', '₹'),
  ('MXN', 'Mexican Peso', 'MX$'),
  ('CZK', 'Czech Koruna', 'Kč'),
  ('PLN', 'Polish Zloty', 'zł'),
  ('TRY', 'Turkish Lira', '₺'),
  ('RUB', 'Russian Ruble', '₽'),
  ('JOD', 'Jordanian Dinar', 'JD'),
  ('PKR', 'Pakistani Rupee', '₨'),
  ('KWD', 'Kuwaiti Dinar', 'KD'),
  ('QAR', 'Qatari Riyal', 'QR'),
  ('OMR', 'Omani Rial', 'OMR'),
  ('ZAR', 'South African Rand', 'R'),
  ('AUD', 'Australian Dollar', 'A$'),
  ('JPY', 'Japanese Yen', '¥'),
  ('SGD', 'Singapore Dollar', 'S$'),
  ('HKD', 'Hong Kong Dollar', 'HK$'),
  ('CHF', 'Swiss Franc', 'CHF'),
  ('IDR', 'Indonesian Rupiah', 'Rp'),
  ('UAH', 'Ukrainian Hryvnia', '₴')
ON CONFLICT (code) DO NOTHING;

COMMENT ON COLUMN public.coupons.external_id IS
  'Upstream coupon id (Admitad coupon feed id). Unique identity for idempotent upserts.';
COMMENT ON COLUMN public.coupons.source IS
  'Coupon provenance. "admitad" rows come from the approved Admitad network feed.';
COMMENT ON COLUMN public.stores.admitted_network IS
  'Approved affiliate network master (e.g. "admitad"). Only rows from the approved master are rendered.';
