-- Migration: Unified Notification Orchestration System
-- Description: Centralized notification tracking table for all notification services
--              with cross-system awareness and global rate limiting
-- Author: Claude Code
-- Date: 2026-01-16

-- =============================================================================
-- TABLE: notifications_sent
-- Unified notification tracking table for ALL notification services
-- Replaces fragmented tracking across multiple tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,

  -- Classification
  source_service TEXT NOT NULL,  -- 'proactive_engagement', 'streak_alerts', 'achievements', 'insights', 'sage_reminders', 'daily_digest'
  notification_type TEXT NOT NULL,  -- 'morning_motivation', 'streak_at_risk', 'achievement', 'daily_digest', etc.
  category TEXT,  -- 'RECOVERY', 'SLEEP', 'STRESS', 'ACTIVITY', 'NUTRITION', 'SOCIAL', 'GENERAL', 'BLOOD', 'HEALTH'
  theme TEXT,  -- For dedup: 'sleep', 'recovery', 'exercise', 'nutrition', 'achievement', 'streak', etc.
  severity TEXT DEFAULT 'medium',  -- 'critical', 'high', 'medium', 'low'

  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',  -- Rich context data

  -- Delivery
  channel TEXT DEFAULT 'push',  -- 'push', 'email', 'sms', 'in_app'
  delivery_status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'delivered', 'failed', 'suppressed'
  suppression_reason TEXT,  -- Why it was suppressed (rate_limit, duplicate_theme, quiet_hours, service_limit, etc.)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Relations
  related_entity_type TEXT,  -- 'insight', 'streak', 'achievement', 'goal', 'challenge'
  related_entity_id TEXT
);

-- =============================================================================
-- INDEXES
-- Optimized for common queries in the notification coordinator
-- =============================================================================

-- Primary lookup: user's notifications by date (most common)
CREATE INDEX IF NOT EXISTS idx_notifications_user_date
  ON notifications_sent(user_email, created_at DESC);

-- Theme deduplication: check if theme was sent today
CREATE INDEX IF NOT EXISTS idx_notifications_user_theme_date
  ON notifications_sent(user_email, theme, created_at DESC);

-- Service-specific limits: count by source service today
CREATE INDEX IF NOT EXISTS idx_notifications_user_source
  ON notifications_sent(user_email, source_service, created_at DESC);

-- Type-specific queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_date
  ON notifications_sent(user_email, notification_type, created_at DESC);

-- Delivery status tracking (for monitoring)
CREATE INDEX IF NOT EXISTS idx_notifications_delivery
  ON notifications_sent(delivery_status, created_at);

-- Category queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_category
  ON notifications_sent(user_email, category, created_at DESC);

-- Related entity lookup (to avoid duplicate notifications for same entity)
CREATE INDEX IF NOT EXISTS idx_notifications_related_entity
  ON notifications_sent(user_email, related_entity_type, related_entity_id, created_at DESC);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get all notifications sent today for a user
CREATE OR REPLACE FUNCTION get_notifications_today(p_email TEXT)
RETURNS TABLE(
  id UUID,
  source_service TEXT,
  notification_type TEXT,
  category TEXT,
  theme TEXT,
  severity TEXT,
  title TEXT,
  sent_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ns.id,
    ns.source_service,
    ns.notification_type,
    ns.category,
    ns.theme,
    ns.severity,
    ns.title,
    ns.sent_at
  FROM notifications_sent ns
  WHERE ns.user_email = p_email
    AND ns.created_at >= CURRENT_DATE
    AND ns.delivery_status = 'sent'
  ORDER BY ns.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count total notifications sent today (global limit check)
CREATE OR REPLACE FUNCTION count_notifications_today(p_email TEXT, p_source TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications_sent
    WHERE user_email = p_email
      AND created_at >= CURRENT_DATE
      AND delivery_status = 'sent'
      AND (p_source IS NULL OR source_service = p_source)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if a specific theme was already sent today
CREATE OR REPLACE FUNCTION was_theme_sent_today(p_email TEXT, p_theme TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM notifications_sent
    WHERE user_email = p_email
      AND theme = p_theme
      AND created_at >= CURRENT_DATE
      AND delivery_status = 'sent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if a notification was sent for a specific entity today
CREATE OR REPLACE FUNCTION was_entity_notified_today(
  p_email TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM notifications_sent
    WHERE user_email = p_email
      AND related_entity_type = p_entity_type
      AND related_entity_id = p_entity_id
      AND created_at >= CURRENT_DATE
      AND delivery_status = 'sent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Count notifications by category today (for category saturation)
CREATE OR REPLACE FUNCTION count_category_today(p_email TEXT, p_category TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications_sent
    WHERE user_email = p_email
      AND category = p_category
      AND created_at >= CURRENT_DATE
      AND delivery_status = 'sent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record a notification (called by the coordinator)
CREATE OR REPLACE FUNCTION record_notification(
  p_email TEXT,
  p_source_service TEXT,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_category TEXT DEFAULT NULL,
  p_theme TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'medium',
  p_data JSONB DEFAULT '{}',
  p_channel TEXT DEFAULT 'push',
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO notifications_sent (
    user_email,
    source_service,
    notification_type,
    title,
    body,
    category,
    theme,
    severity,
    data,
    channel,
    related_entity_type,
    related_entity_id,
    delivery_status
  ) VALUES (
    p_email,
    p_source_service,
    p_notification_type,
    p_title,
    p_body,
    p_category,
    p_theme,
    p_severity,
    p_data,
    p_channel,
    p_related_entity_type,
    p_related_entity_id,
    'pending'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update notification status after send attempt
CREATE OR REPLACE FUNCTION update_notification_status(
  p_notification_id UUID,
  p_status TEXT,
  p_suppression_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications_sent
  SET
    delivery_status = p_status,
    suppression_reason = p_suppression_reason,
    sent_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE sent_at END
  WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get notification history for a user (for context-aware decisions)
CREATE OR REPLACE FUNCTION get_notification_history(
  p_email TEXT,
  p_days INTEGER DEFAULT 7,
  p_theme TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  source_service TEXT,
  notification_type TEXT,
  category TEXT,
  theme TEXT,
  severity TEXT,
  title TEXT,
  created_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ns.id,
    ns.source_service,
    ns.notification_type,
    ns.category,
    ns.theme,
    ns.severity,
    ns.title,
    ns.created_at,
    ns.sent_at
  FROM notifications_sent ns
  WHERE ns.user_email = p_email
    AND ns.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    AND ns.delivery_status = 'sent'
    AND (p_theme IS NULL OR ns.theme = p_theme)
  ORDER BY ns.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old notifications (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications_sent
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE notifications_sent ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications_sent
  FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

-- Service role can do everything (for API and cron jobs)
CREATE POLICY "Service role full access to notifications"
  ON notifications_sent
  FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_notifications_today(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION count_notifications_today(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION was_theme_sent_today(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION was_entity_notified_today(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION count_category_today(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_notification_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_history(TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_notifications() TO authenticated;

-- =============================================================================
-- DATA MIGRATION
-- Backfill existing notification data from old tables
-- =============================================================================

-- Migrate from notification_daily_themes
INSERT INTO notifications_sent (
  user_email, source_service, notification_type, theme, severity,
  title, body, delivery_status, created_at, sent_at
)
SELECT
  email,
  'insights',  -- Most came from insights
  COALESCE(notification_type, 'insight'),
  theme,
  'medium',
  'Migrated: ' || COALESCE(theme, 'notification'),
  'Historical notification (content not preserved)',
  'sent',
  created_at,
  notified_at
FROM notification_daily_themes
WHERE notified_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migrate from real_time_insights (where notification was sent)
INSERT INTO notifications_sent (
  user_email, source_service, notification_type, category, theme, severity,
  title, body, data, delivery_status, created_at, sent_at,
  related_entity_type, related_entity_id
)
SELECT
  email,
  COALESCE(source_provider, 'insights'),
  insight_type,
  category,
  LOWER(COALESCE(category, 'general')),
  COALESCE(severity, 'medium'),
  title,
  COALESCE(message, ''),
  COALESCE(context_data, '{}')::jsonb,
  CASE WHEN notification_sent THEN 'sent' ELSE 'suppressed' END,
  created_at,
  notification_sent_at,
  'insight',
  id::text
FROM real_time_insights
WHERE notification_sent = true
  OR notification_sent_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migrate from user_achievements (achievement notifications)
INSERT INTO notifications_sent (
  user_email, source_service, notification_type, theme, severity,
  title, body, delivery_status, created_at, sent_at,
  related_entity_type, related_entity_id
)
SELECT
  user_email,
  'achievements',
  'achievement',
  'achievement',
  'high',
  emoji || ' ' || title,
  COALESCE(description, 'Achievement earned'),
  'sent',
  earned_at,
  earned_at,
  'achievement',
  id::text
FROM user_achievements
ON CONFLICT DO NOTHING;

-- Log migration stats
DO $$
DECLARE
  themes_count INTEGER;
  insights_count INTEGER;
  achievements_count INTEGER;
  total_migrated INTEGER;
BEGIN
  SELECT COUNT(*) INTO themes_count FROM notification_daily_themes WHERE notified_at IS NOT NULL;
  SELECT COUNT(*) INTO insights_count FROM real_time_insights WHERE notification_sent = true;
  SELECT COUNT(*) INTO achievements_count FROM user_achievements;
  SELECT COUNT(*) INTO total_migrated FROM notifications_sent;

  RAISE NOTICE 'Migration complete: % themes, % insights, % achievements -> % total records in notifications_sent',
    themes_count, insights_count, achievements_count, total_migrated;
END $$;
