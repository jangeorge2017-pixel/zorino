-- Migration: 022_add_amazon_eg_store
-- Seed Amazon Egypt store row so /stores/amazon-eg renders.
-- Uses zorinoeg-21 affiliate tag on amazon.eg marketplace.

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
  'amazon-eg',
  'Amazon Egypt',
  '/stores/amazon.png',
  'AZ',
  'https://www.amazon.eg',
  'amazon-eg',
  4.0,
  ARRAY['EG'],
  ARRAY['EGP'],
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
