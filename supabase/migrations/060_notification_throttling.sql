-- Migration: Notification Throttling
-- Description: Add table for tracking daily notification themes to prevent notification spam
-- Author: Claude Code
-- Date: 2026-01-13

-- =============================================================================
-- TABLE: notification_daily_themes
-- Tracks which notification themes have been sent to each user per day
-- Used to prevent duplicate theme notifications (e.g., multiple music insights)
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_daily_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  theme TEXT NOT NULL,  -- e.g., 'music', 'social', 'sleep', 'recovery', 'exercise', 'work_balance', 'nutrition', 'general'
  notification_type TEXT DEFAULT 'insight',  -- 'insight', 'achievement', 'digest'
  notified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookup of themes sent today
CREATE INDEX IF NOT EXISTS idx_notification_themes_email_date
  ON notification_daily_themes(email, notified_at);

-- Index for checking specific theme by email and theme
CREATE INDEX IF NOT EXISTS idx_notification_themes_email_theme
  ON notification_daily_themes(email, theme);

-- =============================================================================
-- FUNCTION: Check if a theme was already notified today
-- =============================================================================

CREATE OR REPLACE FUNCTION was_theme_notified_today(
  p_email TEXT,
  p_theme TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  theme_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM notification_daily_themes
    WHERE email = p_email
      AND theme = p_theme
      AND notified_at::date = CURRENT_DATE
  ) INTO theme_exists;

  RETURN theme_exists;
END;
$$;

-- =============================================================================
-- FUNCTION: Get count of notifications sent today
-- =============================================================================

CREATE OR REPLACE FUNCTION get_daily_notification_count(
  p_email TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  FROM notification_daily_themes
  WHERE email = p_email
    AND notified_at::date = CURRENT_DATE
  INTO notification_count;

  RETURN COALESCE(notification_count, 0);
END;
$$;

-- =============================================================================
-- FUNCTION: Mark a theme as notified
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_theme_notified(
  p_email TEXT,
  p_theme TEXT,
  p_notification_type TEXT DEFAULT 'insight'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO notification_daily_themes (email, theme, notification_type, notified_at)
  VALUES (p_email, p_theme, p_notification_type, now())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- =============================================================================
-- Cleanup: Auto-delete old entries (older than 7 days)
-- This keeps the table small and efficient
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_notification_themes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notification_daily_themes
  WHERE notified_at < now() - interval '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE notification_daily_themes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notification theme records
CREATE POLICY "Users can view own notification themes"
  ON notification_daily_themes
  FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

-- Service role can do everything (for cron jobs and API)
CREATE POLICY "Service role full access to notification themes"
  ON notification_daily_themes
  FOR ALL
  USING (auth.role() = 'service_role');

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION was_theme_notified_today(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_notification_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_theme_notified(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_notification_themes() TO authenticated;
