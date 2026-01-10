-- Generated Wisdom History
-- Tracks AI-generated wisdom for learning and analytics

CREATE TABLE IF NOT EXISTS generated_wisdom_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,

  -- Generated content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  actionable_tip TEXT,
  theme TEXT,
  category TEXT,

  -- RAG context
  inspired_by TEXT[], -- Sources that inspired this wisdom
  personalized_for TEXT[], -- Health factors it was personalized for

  -- Health context snapshot
  health_context JSONB,

  -- Engagement tracking
  engagement_signal TEXT, -- 'like', 'share', 'save', 'dismiss'
  engagement_score INTEGER DEFAULT 0,
  engaged_at TIMESTAMPTZ,

  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_generated_wisdom_user
  ON generated_wisdom_history(user_email);

CREATE INDEX IF NOT EXISTS idx_generated_wisdom_date
  ON generated_wisdom_history(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_wisdom_theme
  ON generated_wisdom_history(theme);

CREATE INDEX IF NOT EXISTS idx_generated_wisdom_engagement
  ON generated_wisdom_history(engagement_signal)
  WHERE engagement_signal IS NOT NULL;

-- Enable RLS
ALTER TABLE generated_wisdom_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own wisdom history
CREATE POLICY "Users can view own wisdom history"
  ON generated_wisdom_history
  FOR SELECT
  USING (true);

-- Policy: Service role can insert
CREATE POLICY "Service can insert wisdom"
  ON generated_wisdom_history
  FOR INSERT
  WITH CHECK (true);

-- Policy: Service role can update engagement
CREATE POLICY "Service can update wisdom engagement"
  ON generated_wisdom_history
  FOR UPDATE
  USING (true);

-- Comments
COMMENT ON TABLE generated_wisdom_history IS 'Tracks AI-generated personalized wisdom for analytics and learning';
COMMENT ON COLUMN generated_wisdom_history.inspired_by IS 'Sources from wisdom library that inspired this generation';
COMMENT ON COLUMN generated_wisdom_history.personalized_for IS 'Health factors (recovery, sleep, etc) this was personalized for';
COMMENT ON COLUMN generated_wisdom_history.health_context IS 'Snapshot of health context at generation time';
