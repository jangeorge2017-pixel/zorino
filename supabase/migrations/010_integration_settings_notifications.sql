-- Integration API keys (admin-managed) + notification preferences

CREATE TABLE IF NOT EXISTS integration_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL,
  label TEXT,
  is_secret BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_settings_provider ON integration_settings(provider);

ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role integration_settings" ON integration_settings;
CREATE POLICY "Service role integration_settings" ON integration_settings
  FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_price_drops BOOLEAN NOT NULL DEFAULT TRUE,
  email_trending BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notification prefs" ON notification_preferences;
CREATE POLICY "Users read own notification prefs" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own notification prefs" ON notification_preferences;
CREATE POLICY "Users insert own notification prefs" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users upsert own notification prefs" ON notification_preferences;
CREATE POLICY "Users upsert own notification prefs" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Extend notifications type check for price/trending alerts
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('price_drop', 'deal', 'coupon', 'system', 'trending', 'affiliate', 'review', 'alert'));

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read, created_at DESC);
