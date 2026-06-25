-- Admin RLS policies + catalog image storage for Zorino dashboard

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = TRUE
  );
$$;

-- ─── Admin write access on catalog tables ───
CREATE POLICY "Admins manage categories" ON categories
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage stores" ON stores
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage products" ON products
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage prices" ON prices
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage price_history" ON price_history
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage deals" ON deals
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage coupons" ON coupons
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage product_images" ON product_images
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ─── Supabase Storage: catalog images ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-images',
  'catalog-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public read catalog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog-images');

CREATE POLICY "Admins upload catalog images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'catalog-images'
    AND public.is_admin_user()
  );

CREATE POLICY "Admins update catalog images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'catalog-images' AND public.is_admin_user())
  WITH CHECK (bucket_id = 'catalog-images' AND public.is_admin_user());

CREATE POLICY "Admins delete catalog images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'catalog-images' AND public.is_admin_user());
