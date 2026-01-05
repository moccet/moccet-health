-- Migration: Wisdom Library System
-- Description: Tables for curated wisdom content, engagement tracking, and user preferences

-- ============================================
-- Table 1: Wisdom Library (Curated Content)
-- ============================================
CREATE TABLE IF NOT EXISTS wisdom_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL, -- 'self_development', 'fitness', 'cooking', 'productivity', 'life_advice'
  subcategory VARCHAR(100),
  source VARCHAR(200), -- 'Atomic Habits', 'Deep Work', etc.
  source_type VARCHAR(50) DEFAULT 'book', -- 'book', 'research', 'expert', 'tradition'
  title TEXT NOT NULL, -- Short headline (2-5 words)
  content TEXT NOT NULL, -- The actual wisdom/insight
  actionable_tip TEXT, -- Optional specific action
  tags JSONB DEFAULT '[]', -- ['habits', 'morning', 'energy', etc.]
  difficulty VARCHAR(20) DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
  times_shown INT DEFAULT 0,
  total_likes INT DEFAULT 0,
  total_shares INT DEFAULT 0,
  total_saves INT DEFAULT 0,
  avg_engagement FLOAT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_wisdom_category ON wisdom_library(category);
CREATE INDEX IF NOT EXISTS idx_wisdom_source ON wisdom_library(source);
CREATE INDEX IF NOT EXISTS idx_wisdom_tags ON wisdom_library USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_wisdom_active ON wisdom_library(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_wisdom_engagement ON wisdom_library(avg_engagement DESC);

-- ============================================
-- Table 2: Content Engagement Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS content_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  content_id UUID NOT NULL, -- Either wisdom_library.id or real_time_insights.id
  content_type VARCHAR(20) NOT NULL, -- 'wisdom' or 'health_insight'
  content_category VARCHAR(50), -- Category for preference learning
  signal_type VARCHAR(20) NOT NULL, -- 'like', 'share', 'save', 'dismiss', 'view'
  signal_weight FLOAT NOT NULL DEFAULT 1.0, -- Pre-calculated weight
  platform VARCHAR(50), -- For shares: 'whatsapp', 'imessage', 'twitter', 'copy'
  time_spent_seconds INT, -- How long they viewed (optional)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for engagement queries
CREATE INDEX IF NOT EXISTS idx_engagement_user ON content_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_user_email ON content_engagement(user_email);
CREATE INDEX IF NOT EXISTS idx_engagement_content ON content_engagement(content_id);
CREATE INDEX IF NOT EXISTS idx_engagement_type ON content_engagement(signal_type);
CREATE INDEX IF NOT EXISTS idx_engagement_created ON content_engagement(created_at DESC);

-- ============================================
-- Table 3: User Content Preferences
-- ============================================
CREATE TABLE IF NOT EXISTS user_content_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  -- Category scores (0-1, start at 0.5)
  self_development_score FLOAT DEFAULT 0.5,
  fitness_score FLOAT DEFAULT 0.5,
  cooking_score FLOAT DEFAULT 0.5,
  productivity_score FLOAT DEFAULT 0.5,
  life_advice_score FLOAT DEFAULT 0.5,
  health_insights_score FLOAT DEFAULT 0.5,
  -- Engagement counts for weighting
  total_engagements INT DEFAULT 0,
  total_likes INT DEFAULT 0,
  total_shares INT DEFAULT 0,
  total_saves INT DEFAULT 0,
  -- Preferred delivery
  preferred_time TIME DEFAULT '08:00',
  timezone VARCHAR(50) DEFAULT 'UTC',
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint on email
  CONSTRAINT unique_user_prefs UNIQUE (user_email)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_prefs_user ON user_content_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_prefs_email ON user_content_preferences(user_email);

-- ============================================
-- Table 4: User Content History (Never Repeat)
-- ============================================
CREATE TABLE IF NOT EXISTS user_content_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT NOT NULL,
  content_id UUID NOT NULL,
  content_type VARCHAR(20) NOT NULL, -- 'wisdom' or 'health_insight'
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure we never show same content twice
  CONSTRAINT unique_user_content UNIQUE (user_email, content_id)
);

-- Index for checking history
CREATE INDEX IF NOT EXISTS idx_history_user ON user_content_history(user_email);
CREATE INDEX IF NOT EXISTS idx_history_content ON user_content_history(content_id);
CREATE INDEX IF NOT EXISTS idx_history_shown ON user_content_history(shown_at DESC);

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE wisdom_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_content_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_content_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies: wisdom_library (public read, service write)
-- ============================================
CREATE POLICY "Anyone can read active wisdom"
  ON wisdom_library
  FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Service role can manage wisdom"
  ON wisdom_library
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- RLS Policies: content_engagement
-- ============================================
CREATE POLICY "Users can read own engagement"
  ON content_engagement
  FOR SELECT
  TO authenticated
  USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can create own engagement"
  ON content_engagement
  FOR INSERT
  TO authenticated
  WITH CHECK (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Service role full access to engagement"
  ON content_engagement
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- RLS Policies: user_content_preferences
-- ============================================
CREATE POLICY "Users can read own preferences"
  ON user_content_preferences
  FOR SELECT
  TO authenticated
  USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own preferences"
  ON user_content_preferences
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Service role full access to preferences"
  ON user_content_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- RLS Policies: user_content_history
-- ============================================
CREATE POLICY "Users can read own history"
  ON user_content_history
  FOR SELECT
  TO authenticated
  USING (user_email = auth.jwt() ->> 'email');

CREATE POLICY "Service role full access to history"
  ON user_content_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Trigger: Update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_wisdom_library_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_wisdom_library_timestamp ON wisdom_library;
CREATE TRIGGER update_wisdom_library_timestamp
  BEFORE UPDATE ON wisdom_library
  FOR EACH ROW
  EXECUTE FUNCTION update_wisdom_library_updated_at();

CREATE OR REPLACE FUNCTION update_user_content_preferences_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_prefs_timestamp ON user_content_preferences;
CREATE TRIGGER update_user_prefs_timestamp
  BEFORE UPDATE ON user_content_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_content_preferences_updated_at();

-- ============================================
-- Helper Functions
-- ============================================

-- Increment times_shown counter
CREATE OR REPLACE FUNCTION increment_wisdom_shown(wisdom_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE wisdom_library
  SET times_shown = times_shown + 1
  WHERE id = wisdom_id;
END;
$$ LANGUAGE plpgsql;

-- Increment engagement counters
CREATE OR REPLACE FUNCTION increment_wisdom_engagement(
  wisdom_id UUID,
  engagement_column TEXT
)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'UPDATE wisdom_library SET %I = %I + 1 WHERE id = $1',
    engagement_column,
    engagement_column
  ) USING wisdom_id;
END;
$$ LANGUAGE plpgsql;

-- Update user preference scores based on engagement
CREATE OR REPLACE FUNCTION update_user_preference_score(
  p_email TEXT,
  p_category TEXT,
  p_signal_weight FLOAT
)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  column_name TEXT;
  current_score FLOAT;
  new_score FLOAT;
  learning_rate FLOAT := 0.1;
BEGIN
  -- Map category to column name
  column_name := p_category || '_score';

  -- Ensure user has preferences row
  INSERT INTO user_content_preferences (user_email)
  VALUES (p_email)
  ON CONFLICT (user_email) DO NOTHING;

  -- Get current score
  EXECUTE format('SELECT %I FROM user_content_preferences WHERE user_email = $1', column_name)
  INTO current_score
  USING p_email;

  IF current_score IS NULL THEN
    current_score := 0.5;
  END IF;

  -- Calculate new score (bounded 0-1)
  -- Positive signals increase, negative decrease
  new_score := LEAST(1.0, GREATEST(0.0,
    current_score + (learning_rate * p_signal_weight / 10.0)
  ));

  -- Update the score
  EXECUTE format('UPDATE user_content_preferences SET %I = $1, updated_at = NOW() WHERE user_email = $2', column_name)
  USING new_score, p_email;

  -- Update total engagements
  UPDATE user_content_preferences
  SET total_engagements = total_engagements + 1
  WHERE user_email = p_email;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Grants
-- ============================================
GRANT SELECT ON wisdom_library TO authenticated;
GRANT ALL ON wisdom_library TO service_role;

GRANT SELECT, INSERT ON content_engagement TO authenticated;
GRANT ALL ON content_engagement TO service_role;

GRANT SELECT, UPDATE ON user_content_preferences TO authenticated;
GRANT ALL ON user_content_preferences TO service_role;

GRANT SELECT ON user_content_history TO authenticated;
GRANT ALL ON user_content_history TO service_role;
