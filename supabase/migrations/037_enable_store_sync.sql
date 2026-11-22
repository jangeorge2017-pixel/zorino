update public.stores
set
  sync_enabled = true,
  is_active = true,
  updated_at = now()
where slug in (
  'amazon-eg',
  'amazon',
  'aliexpress',
  'ebay',
  'cjdropshipping',
  'admitad',
  'temu',
  'noon',
  'jumia',
  'carrefour',
  'btech',
  'twob',
  'dubaiphone',
  'raneen',
  'eldokan'
);
