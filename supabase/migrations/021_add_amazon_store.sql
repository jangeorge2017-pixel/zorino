-- Migration: 021_add_amazon_store
-- Seed Amazon store row so /stores/amazon renders and the search connector
-- has a store_id to reference.  Sync is disabled until Creators API
-- credentials are configured in Vercel environment variables.

INSERT INTO stores (
  slug,
  name,
  logo_url,
  logo_initial,
  website,
  integration_type,
  commission_rate,
  supported_regions,
  supported_currencies,
  is_active,
  sync_enabled,
  sync_interval_minutes
) VALUES (
  'amazon',
  'Amazon',
  '/stores/amazon.png',
  'AZ',
  'https://www.amazon.eg',
  'amazon',
  4.0,
  ARRAY['EG', 'US', 'GLOBAL'],
  ARRAY['EGP', 'USD'],
  TRUE,
  FALSE,
  360
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website = EXCLUDED.website,
  logo_initial = EXCLUDED.logo_initial,
  commission_rate = EXCLUDED.commission_rate,
  supported_regions = EXCLUDED.supported_regions,
  supported_currencies = EXCLUDED.supported_currencies,
  is_active = EXCLUDED.is_active;
