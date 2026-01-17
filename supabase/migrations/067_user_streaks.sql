-- Migration: User Streaks System
-- Creates tables for tracking user activity streaks and streak alert logs

-- =============================================================================
-- USER STREAKS TABLE
-- =============================================================================
-- Tracks daily activity streaks for various health behaviors

CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  streak_type TEXT NOT NULL,
  current_days INTEGER NOT NULL DEFAULT 0,
  personal_best INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Composite unique constraint on user + streak type
  CONSTRAINT user_streaks_user_type_unique UNIQUE (user_email, streak_type)
);

-- Add check constraint for valid streak types
ALTER TABLE user_streaks ADD CONSTRAINT user_streaks_type_check
  CHECK (streak_type IN (
    'sleep_logging',
    'activity',
    'meal_logging',
    'hydration',
    'check_in',
    'meditation',
    'weight_logging',
    'glucose_logging',
    'workout',
    'steps',
    'mindfulness'
  ));

-- Indexes for common queries
CREATE INDEX idx_user_streaks_user_email ON user_streaks(user_email);
CREATE INDEX idx_user_streaks_current_days ON user_streaks(current_days DESC);
CREATE INDEX idx_user_streaks_user_type ON user_streaks(user_email, streak_type);
CREATE INDEX idx_user_streaks_last_activity ON user_streaks(last_activity_date DESC);

-- =============================================================================
-- STREAK ALERTS LOG TABLE
-- =============================================================================
-- Tracks sent streak alerts to prevent duplicate notifications

CREATE TABLE IF NOT EXISTS streak_alerts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  streak_type TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  urgency TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  engaged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add check constraints
ALTER TABLE streak_alerts_log ADD CONSTRAINT streak_alerts_type_check
  CHECK (alert_type IN (
    'at_risk',
    'milestone_approaching',
    'milestone_achieved',
    'broken',
    'recovered'
  ));

ALTER TABLE streak_alerts_log ADD CONSTRAINT streak_alerts_urgency_check
  CHECK (urgency IN ('low', 'medium', 'high', 'critical'));

-- Indexes for alert log queries
CREATE INDEX idx_streak_alerts_user ON streak_alerts_log(user_email);
CREATE INDEX idx_streak_alerts_user_type ON streak_alerts_log(user_email, streak_type);
CREATE INDEX idx_streak_alerts_sent ON streak_alerts_log(sent_at DESC);

-- =============================================================================
-- STREAK MILESTONES TABLE
-- =============================================================================
-- Records when users hit streak milestones for celebration/achievements

CREATE TABLE IF NOT EXISTS streak_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  streak_type TEXT NOT NULL,
  milestone_days INTEGER NOT NULL,
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each milestone can only be achieved once per user/streak type
  CONSTRAINT streak_milestones_unique UNIQUE (user_email, streak_type, milestone_days)
);

-- Index for milestone queries
CREATE INDEX idx_streak_milestones_user ON streak_milestones(user_email);
CREATE INDEX idx_streak_milestones_achieved ON streak_milestones(achieved_at DESC);

-- =============================================================================
-- USER NOTIFICATION PREFERENCES TABLE
-- =============================================================================
-- Stores user preferences for streak and other notifications

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,

  -- Streak alert preferences
  enable_streak_alerts BOOLEAN DEFAULT TRUE,
  preferred_alert_hour INTEGER DEFAULT 18, -- 6 PM
  min_streak_days_for_alert INTEGER DEFAULT 3,
  alert_buffer INTEGER DEFAULT 4, -- Hours before midnight
  enable_milestone_alerts BOOLEAN DEFAULT TRUE,
  enable_recovery_alerts BOOLEAN DEFAULT TRUE,

  -- Other notification preferences
  enable_proactive_notifications BOOLEAN DEFAULT TRUE,
  enable_achievement_notifications BOOLEAN DEFAULT TRUE,
  quiet_hours_start INTEGER DEFAULT 23, -- 11 PM
  quiet_hours_end INTEGER DEFAULT 7, -- 7 AM

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for preferences lookup
CREATE INDEX idx_notification_prefs_user ON user_notification_preferences(user_email);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_alerts_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for user_streaks
CREATE POLICY "Users can view their own streaks"
  ON user_streaks FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update their own streaks"
  ON user_streaks FOR UPDATE
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert their own streaks"
  ON user_streaks FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role full access to streaks"
  ON user_streaks FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for streak_alerts_log
CREATE POLICY "Users can view their own alerts"
  ON streak_alerts_log FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role full access to alerts"
  ON streak_alerts_log FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for streak_milestones
CREATE POLICY "Users can view their own milestones"
  ON streak_milestones FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role full access to milestones"
  ON streak_milestones FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for user_notification_preferences
CREATE POLICY "Users can view their own preferences"
  ON user_notification_preferences FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update their own preferences"
  ON user_notification_preferences FOR UPDATE
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert their own preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role full access to preferences"
  ON user_notification_preferences FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update a streak (called when user logs an activity)
CREATE OR REPLACE FUNCTION update_user_streak(
  p_user_email TEXT,
  p_streak_type TEXT,
  p_activity_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  current_days INTEGER,
  personal_best INTEGER,
  is_new_personal_best BOOLEAN,
  milestone_hit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_current_days INTEGER;
  v_personal_best INTEGER;
  v_started_at TIMESTAMPTZ;
  v_is_new_pb BOOLEAN := FALSE;
  v_milestone INTEGER := NULL;
  v_milestones INTEGER[] := ARRAY[3, 7, 14, 21, 30, 60, 90, 180, 365];
BEGIN
  -- Get existing streak
  SELECT * INTO v_existing
  FROM user_streaks
  WHERE user_email = p_user_email AND streak_type = p_streak_type;

  IF v_existing IS NULL THEN
    -- First time logging this streak type
    v_current_days := 1;
    v_personal_best := 1;
    v_started_at := NOW();
    v_is_new_pb := TRUE;

    INSERT INTO user_streaks (user_email, streak_type, current_days, personal_best, last_activity_date, started_at)
    VALUES (p_user_email, p_streak_type, v_current_days, v_personal_best, p_activity_date, v_started_at);
  ELSE
    -- Check if already logged today
    IF v_existing.last_activity_date = p_activity_date THEN
      -- Already logged today, return current values
      RETURN QUERY SELECT v_existing.current_days, v_existing.personal_best, FALSE, NULL::INTEGER;
      RETURN;
    END IF;

    -- Check if streak continues (activity was yesterday or earlier today)
    IF v_existing.last_activity_date = p_activity_date - INTERVAL '1 day' THEN
      -- Streak continues
      v_current_days := v_existing.current_days + 1;
      v_started_at := v_existing.started_at;
    ELSE
      -- Streak broken, start new
      v_current_days := 1;
      v_started_at := NOW();
    END IF;

    -- Update personal best
    v_personal_best := GREATEST(v_current_days, v_existing.personal_best);
    v_is_new_pb := v_current_days > v_existing.personal_best;

    -- Update streak
    UPDATE user_streaks
    SET
      current_days = v_current_days,
      personal_best = v_personal_best,
      last_activity_date = p_activity_date,
      started_at = v_started_at,
      updated_at = NOW()
    WHERE user_email = p_user_email AND streak_type = p_streak_type;
  END IF;

  -- Check for milestone
  FOREACH v_milestone IN ARRAY v_milestones
  LOOP
    IF v_current_days = v_milestone THEN
      -- Record milestone if not already recorded
      INSERT INTO streak_milestones (user_email, streak_type, milestone_days)
      VALUES (p_user_email, p_streak_type, v_milestone)
      ON CONFLICT (user_email, streak_type, milestone_days) DO NOTHING;

      RETURN QUERY SELECT v_current_days, v_personal_best, v_is_new_pb, v_milestone;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_current_days, v_personal_best, v_is_new_pb, NULL::INTEGER;
END;
$$;

-- Function to check for broken streaks (called by cron job)
CREATE OR REPLACE FUNCTION check_broken_streaks()
RETURNS TABLE (
  user_email TEXT,
  streak_type TEXT,
  days_lost INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH broken_streaks AS (
    SELECT
      s.user_email,
      s.streak_type,
      s.current_days as days_lost
    FROM user_streaks s
    WHERE s.last_activity_date < CURRENT_DATE - INTERVAL '1 day'
      AND s.current_days > 0
  )
  UPDATE user_streaks u
  SET
    current_days = 0,
    started_at = NULL,
    updated_at = NOW()
  FROM broken_streaks b
  WHERE u.user_email = b.user_email
    AND u.streak_type = b.streak_type
  RETURNING b.user_email, b.streak_type, b.days_lost;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_streak TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_streak TO service_role;
GRANT EXECUTE ON FUNCTION check_broken_streaks TO service_role;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_streaks IS 'Tracks daily activity streaks for various health behaviors';
COMMENT ON TABLE streak_alerts_log IS 'Logs sent streak alerts to prevent duplicate notifications';
COMMENT ON TABLE streak_milestones IS 'Records when users achieve streak milestones';
COMMENT ON TABLE user_notification_preferences IS 'User preferences for notifications';
COMMENT ON FUNCTION update_user_streak IS 'Updates a user streak when they log an activity';
COMMENT ON FUNCTION check_broken_streaks IS 'Checks for and resets broken streaks (run daily)';
