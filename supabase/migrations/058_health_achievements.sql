-- Migration: Health Achievements
-- Description: Track automated health achievements based on health data analysis
-- Author: Claude Code
-- Date: 2026-01-12

-- =============================================================================
-- TABLE: Health Achievements
-- Auto-generated achievements from health data (steps, sleep, activity, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS health_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  -- Achievement details
  achievement_type TEXT NOT NULL,  -- e.g., 'steps_10k', 'sleep_streak_7', 'meal_streak_14'
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT NOT NULL,
  -- Context
  metric_value NUMERIC,  -- The value that triggered the achievement
  streak_days INTEGER,   -- For streak achievements
  metadata JSONB DEFAULT '{}',
  -- Timestamps
  earned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_achievements_user ON health_achievements(user_email);
CREATE INDEX IF NOT EXISTS idx_health_achievements_type ON health_achievements(user_email, achievement_type);
CREATE INDEX IF NOT EXISTS idx_health_achievements_recent ON health_achievements(earned_at DESC);

-- Prevent duplicate achievements of the same type per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_achievements_unique
  ON health_achievements(user_email, achievement_type);

-- =============================================================================
-- TABLE: Notification History (if not exists)
-- Track sent notifications to prevent spam
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  notification_type TEXT NOT NULL,  -- 'sage_meal_reminder', 'health_achievement', etc.
  title TEXT,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_history_user ON notification_history(user_email, notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_recent ON notification_history(user_email, sent_at DESC);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE health_achievements ENABLE ROW LEVEL SECURITY;

-- Users can read their own achievements
CREATE POLICY "Users can read own health achievements"
  ON health_achievements FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

-- Service role can manage all achievements
CREATE POLICY "Service role can manage all health achievements"
  ON health_achievements FOR ALL
  USING (auth.role() = 'service_role');

-- Friends can view each other's health achievements (for feed)
CREATE POLICY "Friends can view health achievements"
  ON health_achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_connections
      WHERE status = 'accepted'
      AND (
        (requester_email = auth.jwt() ->> 'email' AND addressee_email = user_email) OR
        (requester_email = user_email AND addressee_email = auth.jwt() ->> 'email')
      )
    )
  );

-- Enable RLS on notification_history
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own notification history
CREATE POLICY "Users can read own notification history"
  ON notification_history FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

-- Service role can manage all notifications
CREATE POLICY "Service role can manage all notifications"
  ON notification_history FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- FUNCTION: Generate feed items for friends when achievement is earned
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_health_achievement_feed()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert feed items for all friends of the user who earned the achievement
  INSERT INTO friend_activity_feed (
    user_email,
    friend_email,
    activity_type,
    title,
    subtitle,
    emoji,
    activity_at,
    expires_at
  )
  SELECT
    CASE
      WHEN uc.requester_email = NEW.user_email THEN uc.addressee_email
      ELSE uc.requester_email
    END AS user_email,
    NEW.user_email AS friend_email,
    'achievement_earned' AS activity_type,
    'Earned: ' || NEW.title AS title,
    NEW.description AS subtitle,
    NEW.emoji AS emoji,
    NEW.earned_at AS activity_at,
    NEW.earned_at + interval '7 days' AS expires_at
  FROM user_connections uc
  WHERE uc.status = 'accepted'
  AND (uc.requester_email = NEW.user_email OR uc.addressee_email = NEW.user_email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-generate feed items
DROP TRIGGER IF EXISTS health_achievement_feed_trigger ON health_achievements;
CREATE TRIGGER health_achievement_feed_trigger
  AFTER INSERT ON health_achievements
  FOR EACH ROW
  EXECUTE FUNCTION generate_health_achievement_feed();

-- =============================================================================
-- FUNCTION: Get user's health achievements
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_health_achievements(p_user_email TEXT)
RETURNS TABLE (
  id UUID,
  achievement_type TEXT,
  title TEXT,
  description TEXT,
  emoji TEXT,
  earned_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ha.id,
    ha.achievement_type,
    ha.title,
    ha.description,
    ha.emoji,
    ha.earned_at
  FROM health_achievements ha
  WHERE ha.user_email = p_user_email
  ORDER BY ha.earned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Calculate meal logging streak
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_meal_logging_streak(p_user_email TEXT)
RETURNS INTEGER AS $$
DECLARE
  streak INTEGER := 0;
  log_date DATE;
  expected_date DATE;
  log_cursor CURSOR FOR
    SELECT DISTINCT DATE(logged_at) as log_day
    FROM sage_food_logs
    WHERE user_email = p_user_email
    ORDER BY log_day DESC;
BEGIN
  expected_date := CURRENT_DATE;

  OPEN log_cursor;
  LOOP
    FETCH log_cursor INTO log_date;
    EXIT WHEN NOT FOUND;

    IF log_date = expected_date THEN
      streak := streak + 1;
      expected_date := expected_date - INTERVAL '1 day';
    ELSIF log_date < expected_date THEN
      -- Missed a day, stop counting
      EXIT;
    END IF;
  END LOOP;
  CLOSE log_cursor;

  RETURN streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Check and grant meal logging achievements
-- Called after food log insert
-- =============================================================================

CREATE OR REPLACE FUNCTION check_meal_logging_achievements()
RETURNS TRIGGER AS $$
DECLARE
  streak INTEGER;
  achievement_types TEXT[] := ARRAY['meal_streak_3', 'meal_streak_7', 'meal_streak_14', 'meal_streak_30'];
  achievement_thresholds INTEGER[] := ARRAY[3, 7, 14, 30];
  achievement_titles TEXT[] := ARRAY['3-Day Tracker', 'Nutrition Week', 'Logging Pro', 'Meal Master'];
  achievement_emojis TEXT[] := ARRAY['🥗', '📊', '🏅', '👑'];
  achievement_descs TEXT[] := ARRAY['Logged meals 3 days in a row', 'Logged meals for a full week', 'Logged meals for 2 weeks straight', 'Logged meals for a full month'];
  i INTEGER;
BEGIN
  -- Calculate current streak
  streak := calculate_meal_logging_streak(NEW.user_email);

  -- Check each achievement threshold
  FOR i IN 1..4 LOOP
    IF streak >= achievement_thresholds[i] THEN
      -- Try to insert achievement (will fail silently if already exists due to unique constraint)
      INSERT INTO health_achievements (
        user_email,
        achievement_type,
        title,
        description,
        emoji,
        streak_days,
        earned_at
      )
      VALUES (
        NEW.user_email,
        achievement_types[i],
        achievement_titles[i],
        achievement_descs[i],
        achievement_emojis[i],
        streak,
        now()
      )
      ON CONFLICT (user_email, achievement_type) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on sage_food_logs to check for achievements
DROP TRIGGER IF EXISTS meal_logging_achievement_trigger ON sage_food_logs;
CREATE TRIGGER meal_logging_achievement_trigger
  AFTER INSERT ON sage_food_logs
  FOR EACH ROW
  EXECUTE FUNCTION check_meal_logging_achievements();
