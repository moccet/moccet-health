-- Insight History Table
-- Tracks which insights have been shown to users to avoid repetition
-- Recent insights (7 days) stored with full detail, older ones compacted by category

CREATE TABLE IF NOT EXISTS insight_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  insight_id TEXT NOT NULL,
  category TEXT NOT NULL,
  design_category TEXT,
  title TEXT NOT NULL,
  recommendation TEXT,
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate entries for same insight to same user
  UNIQUE(email, insight_id)
);

-- Index for efficient querying by user and recency
CREATE INDEX idx_insight_history_email_shown ON insight_history(email, shown_at DESC);

-- Index for category-based aggregation queries
CREATE INDEX idx_insight_history_email_category ON insight_history(email, category);

-- Enable Row Level Security
ALTER TABLE insight_history ENABLE ROW LEVEL SECURITY;

-- Users can only access their own insight history
CREATE POLICY "Users can view own insight history" ON insight_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insight history" ON insight_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insight history" ON insight_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own insight history" ON insight_history
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can access all records (for backend queries)
CREATE POLICY "Service role full access" ON insight_history
  FOR ALL USING (auth.role() = 'service_role');
