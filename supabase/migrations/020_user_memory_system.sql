-- User Memory System for Hyper-Personalization
-- Author: Claude Code
-- Date: 2024-12-13
-- Purpose: Enable agents to learn from users and provide personalized recommendations

-- =============================================================================
-- EPISODIC MEMORY: Conversation History
-- =============================================================================
-- Stores conversation threads with AI summaries for long-term recall

CREATE TABLE IF NOT EXISTS user_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  summary TEXT,  -- AI-generated summary for quick recall
  topic TEXT,  -- Main topic of conversation
  insights_discussed TEXT[],  -- Array of insight IDs discussed
  actions_taken TEXT[],  -- Actions completed in this conversation
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user lookups and recent conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user ON user_conversations(user_email);
CREATE INDEX IF NOT EXISTS idx_conversations_user_recent ON user_conversations(user_email, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON user_conversations(thread_id);

-- =============================================================================
-- SEMANTIC MEMORY: Learned Facts
-- =============================================================================
-- Facts learned about the user over time (preferences, allergies, goals, etc.)

CREATE TABLE IF NOT EXISTS user_learned_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'preference',      -- User preferences (e.g., prefers morning workouts)
    'allergy',         -- Allergies and intolerances
    'goal',            -- Health and fitness goals
    'constraint',      -- Constraints (e.g., works night shifts)
    'style',           -- Communication/lifestyle style
    'medical',         -- Medical conditions (disclosed by user)
    'dietary',         -- Dietary choices (vegan, keto, etc.)
    'supplement',      -- Supplement preferences
    'schedule',        -- Schedule patterns
    'other'            -- Catch-all
  )),
  fact_key TEXT NOT NULL,
  fact_value TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT,  -- How was this learned (conversation, onboarding, inferred, etc.)
  evidence JSONB,  -- Supporting evidence for this fact
  learned_at TIMESTAMPTZ DEFAULT now(),
  last_confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- Some facts may expire (e.g., temporary goals)
  UNIQUE(user_email, category, fact_key)
);

-- Indexes for fact lookups
CREATE INDEX IF NOT EXISTS idx_learned_facts_user ON user_learned_facts(user_email);
CREATE INDEX IF NOT EXISTS idx_learned_facts_category ON user_learned_facts(user_email, category);
CREATE INDEX IF NOT EXISTS idx_learned_facts_confidence ON user_learned_facts(user_email, confidence DESC);

-- =============================================================================
-- OUTCOME MEMORY: Advice Tracking
-- =============================================================================
-- Track whether advice/recommendations actually improved health metrics

CREATE TABLE IF NOT EXISTS advice_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  advice_type TEXT NOT NULL CHECK (advice_type IN (
    'supplement',
    'sleep',
    'nutrition',
    'exercise',
    'stress',
    'recovery',
    'glucose',
    'general'
  )),
  advice_given TEXT NOT NULL,
  advice_summary TEXT,  -- Short summary for agent context
  metric_name TEXT NOT NULL,  -- Which metric to track (hrv, sleep_score, glucose_avg, etc.)
  baseline_value FLOAT,
  target_value FLOAT,
  target_direction TEXT CHECK (target_direction IN ('increase', 'decrease', 'maintain')),
  current_value FLOAT,
  outcome TEXT CHECK (outcome IN ('improved', 'no_change', 'worsened', 'pending', 'unknown')),
  improvement_percentage FLOAT,
  check_after_days INT DEFAULT 14,
  checked_at TIMESTAMPTZ,
  user_confirmed_helpful BOOLEAN,
  user_feedback TEXT,
  related_task_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for outcome tracking
CREATE INDEX IF NOT EXISTS idx_advice_outcomes_user ON advice_outcomes(user_email);
CREATE INDEX IF NOT EXISTS idx_advice_outcomes_pending ON advice_outcomes(user_email, outcome) WHERE outcome = 'pending';
CREATE INDEX IF NOT EXISTS idx_advice_outcomes_type ON advice_outcomes(user_email, advice_type);
CREATE INDEX IF NOT EXISTS idx_advice_outcomes_metric ON advice_outcomes(metric_name);

-- =============================================================================
-- PREFERENCE MEMORY: Action Approvals/Rejections
-- =============================================================================
-- Learn from what actions users approve or reject

CREATE TABLE IF NOT EXISTS user_action_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'calendar_event',
    'calendar_reminder',
    'shopping_cart',
    'shopping_purchase',
    'booking_appointment',
    'spotify_playlist',
    'supplement_recommendation',
    'notification',
    'other'
  )),
  action_pattern JSONB,  -- Details of the action (time, type, etc.)
  approved BOOLEAN NOT NULL,
  rejection_reason TEXT,
  user_feedback TEXT,
  learned_preference TEXT,  -- AI-extracted preference from this decision
  confidence FLOAT DEFAULT 0.5,
  context JSONB,  -- Context at time of decision
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for preference learning
CREATE INDEX IF NOT EXISTS idx_action_preferences_user ON user_action_preferences(user_email);
CREATE INDEX IF NOT EXISTS idx_action_preferences_type ON user_action_preferences(user_email, action_type);
CREATE INDEX IF NOT EXISTS idx_action_preferences_approved ON user_action_preferences(user_email, action_type, approved);

-- =============================================================================
-- COMMUNICATION STYLE: How User Prefers to Interact
-- =============================================================================
-- Stores learned communication preferences

CREATE TABLE IF NOT EXISTS user_communication_style (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,
  verbosity TEXT DEFAULT 'medium' CHECK (verbosity IN ('brief', 'medium', 'detailed')),
  tone TEXT DEFAULT 'professional' CHECK (tone IN ('casual', 'professional', 'scientific', 'encouraging')),
  emoji_usage BOOLEAN DEFAULT false,
  prefers_lists BOOLEAN DEFAULT true,
  prefers_explanations BOOLEAN DEFAULT true,
  prefers_research_citations BOOLEAN DEFAULT false,
  prefers_action_items BOOLEAN DEFAULT true,
  preferred_time_format TEXT DEFAULT '12h' CHECK (preferred_time_format IN ('12h', '24h')),
  preferred_units TEXT DEFAULT 'imperial' CHECK (preferred_units IN ('imperial', 'metric')),
  response_length_preference TEXT DEFAULT 'medium' CHECK (response_length_preference IN ('short', 'medium', 'long')),
  -- Learning metadata
  inferred_from_interactions INT DEFAULT 0,
  last_style_update TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- MEMORY SUMMARIES: Compressed Long-term Memory
-- =============================================================================
-- Periodic summaries of user's health journey for efficient context loading

CREATE TABLE IF NOT EXISTS user_memory_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  summary_type TEXT NOT NULL CHECK (summary_type IN (
    'weekly',
    'monthly',
    'quarterly',
    'journey'  -- Overall health journey summary
  )),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  summary_text TEXT NOT NULL,
  key_events JSONB,  -- Important events during this period
  metric_changes JSONB,  -- How metrics changed
  successful_interventions JSONB,  -- What worked
  unsuccessful_interventions JSONB,  -- What didn't work
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_summaries_user ON user_memory_summaries(user_email);
CREATE INDEX IF NOT EXISTS idx_memory_summaries_type ON user_memory_summaries(user_email, summary_type);
CREATE INDEX IF NOT EXISTS idx_memory_summaries_period ON user_memory_summaries(user_email, period_end DESC);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to get user's memory context for agent
CREATE OR REPLACE FUNCTION get_user_memory_context(p_user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'facts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'category', category,
        'key', fact_key,
        'value', fact_value,
        'confidence', confidence
      )), '[]'::jsonb)
      FROM user_learned_facts
      WHERE user_email = p_user_email
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY confidence DESC
      LIMIT 50
    ),
    'style', (
      SELECT row_to_json(s)::jsonb
      FROM user_communication_style s
      WHERE user_email = p_user_email
    ),
    'recent_outcomes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'advice_type', advice_type,
        'advice_summary', advice_summary,
        'metric', metric_name,
        'outcome', outcome,
        'baseline', baseline_value,
        'current', current_value
      )), '[]'::jsonb)
      FROM advice_outcomes
      WHERE user_email = p_user_email
        AND outcome IS NOT NULL
        AND outcome != 'pending'
      ORDER BY created_at DESC
      LIMIT 10
    ),
    'action_preferences', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'action_type', action_type,
        'usually_approves', (
          SELECT COUNT(*) FILTER (WHERE approved) * 100.0 / NULLIF(COUNT(*), 0)
          FROM user_action_preferences p2
          WHERE p2.user_email = p_user_email AND p2.action_type = p.action_type
        ),
        'learned_preference', learned_preference
      )), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (action_type) action_type, learned_preference
        FROM user_action_preferences
        WHERE user_email = p_user_email AND learned_preference IS NOT NULL
        ORDER BY action_type, created_at DESC
      ) p
    ),
    'recent_summary', (
      SELECT summary_text
      FROM user_memory_summaries
      WHERE user_email = p_user_email AND summary_type = 'weekly'
      ORDER BY period_end DESC
      LIMIT 1
    )
  ) INTO result;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to upsert a learned fact
CREATE OR REPLACE FUNCTION learn_user_fact(
  p_user_email TEXT,
  p_category TEXT,
  p_key TEXT,
  p_value TEXT,
  p_source TEXT,
  p_confidence FLOAT DEFAULT 0.5
)
RETURNS UUID AS $$
DECLARE
  fact_id UUID;
BEGIN
  INSERT INTO user_learned_facts (user_email, category, fact_key, fact_value, source, confidence)
  VALUES (p_user_email, p_category, p_key, p_value, p_source, p_confidence)
  ON CONFLICT (user_email, category, fact_key)
  DO UPDATE SET
    fact_value = EXCLUDED.fact_value,
    confidence = GREATEST(user_learned_facts.confidence, EXCLUDED.confidence),
    last_confirmed_at = now()
  RETURNING id INTO fact_id;

  RETURN fact_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending outcome checks
CREATE OR REPLACE FUNCTION get_pending_outcome_checks()
RETURNS TABLE (
  id UUID,
  user_email TEXT,
  advice_type TEXT,
  metric_name TEXT,
  baseline_value FLOAT,
  target_value FLOAT,
  target_direction TEXT,
  check_after_days INT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ao.id,
    ao.user_email,
    ao.advice_type,
    ao.metric_name,
    ao.baseline_value,
    ao.target_value,
    ao.target_direction,
    ao.check_after_days,
    ao.created_at
  FROM advice_outcomes ao
  WHERE ao.outcome = 'pending'
    AND ao.created_at + (ao.check_after_days || ' days')::interval < now()
    AND ao.checked_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at on conversations
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conversation_updated
  BEFORE UPDATE ON user_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Auto-update updated_at on communication style
CREATE OR REPLACE FUNCTION update_communication_style_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_communication_style_updated
  BEFORE UPDATE ON user_communication_style
  FOR EACH ROW
  EXECUTE FUNCTION update_communication_style_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learned_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE advice_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_action_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_communication_style ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_summaries ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users to access their own data
CREATE POLICY "Users can view own conversations" ON user_conversations
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own conversations" ON user_conversations
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own conversations" ON user_conversations
  FOR UPDATE USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can view own facts" ON user_learned_facts
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can view own outcomes" ON advice_outcomes
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can view own preferences" ON user_action_preferences
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can view own style" ON user_communication_style
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can view own summaries" ON user_memory_summaries
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access to conversations" ON user_conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to facts" ON user_learned_facts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to outcomes" ON advice_outcomes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to preferences" ON user_action_preferences
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to style" ON user_communication_style
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to summaries" ON user_memory_summaries
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- INSIGHT FEEDBACK TABLES
-- =============================================================================

-- Table to store raw feedback on insights
CREATE TABLE IF NOT EXISTS insight_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  insight_id TEXT,
  insight_title TEXT,
  insight_category TEXT,
  feedback_text TEXT NOT NULL,
  extracted_facts JSONB,  -- Facts extracted by AI
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insight_feedback_user ON insight_feedback(user_email);
CREATE INDEX IF NOT EXISTS idx_insight_feedback_insight ON insight_feedback(insight_id);

-- Table to track dismissed insights (to avoid showing again)
CREATE TABLE IF NOT EXISTS user_insight_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  insight_id TEXT NOT NULL,
  reason TEXT,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email, insight_id)
);

CREATE INDEX IF NOT EXISTS idx_insight_dismissals_user ON user_insight_dismissals(user_email);

-- RLS for insight feedback tables
ALTER TABLE insight_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_insight_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to insight_feedback" ON insight_feedback
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to insight_dismissals" ON user_insight_dismissals
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own feedback" ON insight_feedback
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can view own dismissals" ON user_insight_dismissals
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);
