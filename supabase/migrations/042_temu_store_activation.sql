INSERT INTO public.stores (
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
)
VALUES (
  'temu',
  'Temu',
  '/stores/temu.svg',
  'TM',
  'https://www.temu.com',
  'temu',
  7.0,
  ARRAY['US', 'EG'],
  ARRAY['USD', 'EGP'],
  TRUE,
  TRUE,
  240
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url,
  logo_initial = EXCLUDED.logo_initial,
  website = EXCLUDED.website,
  integration_type = EXCLUDED.integration_type,
  commission_rate = EXCLUDED.commission_rate,
  supported_regions = EXCLUDED.supported_regions,
  supported_currencies = EXCLUDED.supported_currencies,
  is_active = TRUE,
  sync_enabled = TRUE,
  sync_interval_minutes = 240,
  updated_at = now();
