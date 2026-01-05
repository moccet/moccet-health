-- Migration: Daily Digests Table
-- Description: Stores daily digest history for users

-- ============================================
-- Table: Daily Digests History
-- ============================================
CREATE TABLE IF NOT EXISTS daily_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  notification_sent BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_digests_user ON daily_digests(user_email);
CREATE INDEX IF NOT EXISTS idx_digests_generated ON daily_digests(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_digests_user_date ON daily_digests(user_email, generated_at DESC);

-- Enable RLS
ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own digests"
  ON daily_digests
  FOR SELECT
  TO authenticated
  USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Service role full access to digests"
  ON daily_digests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT ON daily_digests TO authenticated;
GRANT ALL ON daily_digests TO service_role;

-- ============================================
-- Function: Clean up old digests (keep 30 days)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_digests()
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM daily_digests
  WHERE generated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Add decay_all_preferences function if missing
-- ============================================
CREATE OR REPLACE FUNCTION decay_all_preferences(decay_factor FLOAT DEFAULT 0.95)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decay all category scores toward 0.5 (neutral)
  UPDATE user_content_preferences
  SET
    self_development_score = 0.5 + (self_development_score - 0.5) * decay_factor,
    fitness_score = 0.5 + (fitness_score - 0.5) * decay_factor,
    cooking_score = 0.5 + (cooking_score - 0.5) * decay_factor,
    productivity_score = 0.5 + (productivity_score - 0.5) * decay_factor,
    life_advice_score = 0.5 + (life_advice_score - 0.5) * decay_factor,
    health_insights_score = 0.5 + (health_insights_score - 0.5) * decay_factor,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
