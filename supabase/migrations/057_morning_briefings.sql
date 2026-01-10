-- Migration: Morning Briefings Table
-- Created: 2026-01-10
-- Purpose: Store morning briefing history for analytics and debugging

-- ============================================================================
-- MORNING BRIEFINGS TABLE
-- ============================================================================
-- Stores generated morning briefings with wellness and task data

CREATE TABLE IF NOT EXISTS morning_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,

  -- Wellness data (HRV, recovery, sleep, recommendation)
  wellness_data JSONB DEFAULT '{}',

  -- Platform summaries
  slack_summary JSONB DEFAULT '{}',
  linear_summary JSONB DEFAULT '{}',
  notion_summary JSONB DEFAULT '{}',
  gmail_summary JSONB DEFAULT '{}',

  -- Totals
  total_action_items INTEGER DEFAULT 0,
  urgent_items INTEGER DEFAULT 0,

  -- Notification status
  notification_sent BOOLEAN DEFAULT FALSE,

  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_morning_briefings_email
  ON morning_briefings(user_email);

CREATE INDEX IF NOT EXISTS idx_morning_briefings_date
  ON morning_briefings(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_morning_briefings_sent
  ON morning_briefings(user_email, notification_sent);

-- ============================================================================
-- ADD PREFERENCE COLUMN
-- ============================================================================
-- Add morning_briefing_enabled to user_content_preferences if it exists

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_content_preferences'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_content_preferences'
      AND column_name = 'morning_briefing_enabled'
    ) THEN
      ALTER TABLE user_content_preferences
      ADD COLUMN morning_briefing_enabled BOOLEAN DEFAULT TRUE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE morning_briefings ENABLE ROW LEVEL SECURITY;

-- Users can view their own briefings
DROP POLICY IF EXISTS "Users can view own briefings" ON morning_briefings;
CREATE POLICY "Users can view own briefings"
  ON morning_briefings FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

-- Service role has full access
DROP POLICY IF EXISTS "Service role full access briefings" ON morning_briefings;
CREATE POLICY "Service role full access briefings"
  ON morning_briefings FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE morning_briefings IS 'Morning briefing history with wellness and task aggregation data';
COMMENT ON COLUMN morning_briefings.wellness_data IS 'HRV, recovery, sleep, energy level, recommendation';
COMMENT ON COLUMN morning_briefings.slack_summary IS 'Aggregated Slack tasks by person';
COMMENT ON COLUMN morning_briefings.linear_summary IS 'Urgent/high priority Linear issues';
COMMENT ON COLUMN morning_briefings.notion_summary IS 'Due/overdue Notion tasks';
COMMENT ON COLUMN morning_briefings.gmail_summary IS 'Emails needing response';
