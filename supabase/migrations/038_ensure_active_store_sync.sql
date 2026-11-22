-- Migration: 038_ensure_active_store_sync
-- Idempotent guard: every active store plus amazon-eg stays opted into catalog sync.
-- 022 seeded amazon-eg with sync_enabled = false; this survives that seed order.

update public.stores
set
  sync_enabled = true,
  updated_at = now()
where is_active = true
   or slug = 'amazon-eg';
