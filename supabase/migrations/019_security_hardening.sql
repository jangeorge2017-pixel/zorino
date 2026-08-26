-- Fix affiliate_clicks RLS: restrict to service role only
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Allow inserts from any authenticated or anon user (for click tracking)
CREATE POLICY "Allow affiliate click inserts"
  ON affiliate_clicks FOR INSERT
  WITH CHECK (true);

-- Restrict reads to service role only (no user should read raw click data)
CREATE POLICY "Service role only for affiliate click reads"
  ON affiliate_clicks FOR SELECT
  USING (auth.role() = 'service_role');
