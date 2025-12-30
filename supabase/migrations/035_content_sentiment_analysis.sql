-- Content Sentiment Analysis Migration
-- Stores AI-analyzed sentiment from Slack and Gmail communications
-- Privacy-conscious: stores only scores and categories, not raw message text

-- =====================================================
-- 1. CONTENT SENTIMENT ANALYSIS TABLE
-- Stores daily sentiment analysis results
-- =====================================================
CREATE TABLE IF NOT EXISTS public.content_sentiment_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('slack', 'gmail')),
  analysis_date DATE NOT NULL,

  -- Overall sentiment
  overall_sentiment TEXT CHECK (overall_sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
  sentiment_score DECIMAL(4,3), -- -1 to 1

  -- Stress signals
  stress_score INTEGER CHECK (stress_score >= 0 AND stress_score <= 100),
  stress_signals JSONB, -- {urgentLanguage, deadlinePressure, conflictIndicators, etc.}

  -- Success signals
  success_score INTEGER CHECK (success_score >= 0 AND success_score <= 100),
  success_signals JSONB, -- {praiseReceived, congratulations, projectCompletion, etc.}

  -- Boundary violation signals
  boundary_score INTEGER CHECK (boundary_score >= 0 AND boundary_score <= 100),
  boundary_signals JSONB, -- {personalInWork, workInPersonal, afterHoursUrgency, etc.}

  -- Trigger categories (privacy-safe - categories not raw phrases)
  trigger_categories TEXT[],

  -- Metadata
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint per user/source/date
  UNIQUE(user_email, source, analysis_date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sentiment_user_email ON public.content_sentiment_analysis(user_email);
CREATE INDEX IF NOT EXISTS idx_sentiment_date ON public.content_sentiment_analysis(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_user_date ON public.content_sentiment_analysis(user_email, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_source ON public.content_sentiment_analysis(source);
CREATE INDEX IF NOT EXISTS idx_sentiment_stress_score ON public.content_sentiment_analysis(stress_score DESC) WHERE stress_score > 50;

-- Enable RLS
ALTER TABLE public.content_sentiment_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on content_sentiment_analysis" ON public.content_sentiment_analysis
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 2. SENTIMENT ANALYSIS PREFERENCES TABLE
-- User opt-in preferences for content analysis
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sentiment_analysis_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,

  -- Opt-in flags (default: opted out for privacy)
  slack_content_analysis BOOLEAN DEFAULT false,
  gmail_subject_analysis BOOLEAN DEFAULT false,
  gmail_snippet_analysis BOOLEAN DEFAULT false,

  -- Analysis settings
  analysis_frequency TEXT DEFAULT 'daily' CHECK (analysis_frequency IN ('realtime', 'daily', 'weekly')),
  retention_days INTEGER DEFAULT 30,

  -- Notification preferences
  notify_high_stress BOOLEAN DEFAULT true,
  notify_boundary_violations BOOLEAN DEFAULT true,
  notify_success_celebrations BOOLEAN DEFAULT false,

  -- Thresholds for notifications
  stress_threshold INTEGER DEFAULT 70,
  boundary_threshold INTEGER DEFAULT 60,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_prefs_email ON public.sentiment_analysis_preferences(user_email);

-- Enable RLS
ALTER TABLE public.sentiment_analysis_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on sentiment_analysis_preferences" ON public.sentiment_analysis_preferences
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. HELPER FUNCTIONS
-- =====================================================

-- Function to get aggregated sentiment for a user
CREATE OR REPLACE FUNCTION get_user_sentiment_summary(
  p_user_email TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  avg_sentiment_score DECIMAL,
  avg_stress_score DECIMAL,
  avg_success_score DECIMAL,
  avg_boundary_score DECIMAL,
  total_days INTEGER,
  stress_trend TEXT,
  most_common_triggers TEXT[]
) AS $$
DECLARE
  v_start_date DATE := CURRENT_DATE - p_days;
  v_mid_date DATE := CURRENT_DATE - (p_days / 2);
BEGIN
  RETURN QUERY
  WITH sentiment_data AS (
    SELECT
      sentiment_score,
      stress_score,
      success_score,
      boundary_score,
      trigger_categories,
      analysis_date
    FROM public.content_sentiment_analysis
    WHERE user_email = p_user_email
      AND analysis_date >= v_start_date
  ),
  first_half AS (
    SELECT AVG(stress_score) as avg_stress
    FROM sentiment_data
    WHERE analysis_date < v_mid_date
  ),
  second_half AS (
    SELECT AVG(stress_score) as avg_stress
    FROM sentiment_data
    WHERE analysis_date >= v_mid_date
  )
  SELECT
    AVG(sd.sentiment_score)::DECIMAL as avg_sentiment_score,
    AVG(sd.stress_score)::DECIMAL as avg_stress_score,
    AVG(sd.success_score)::DECIMAL as avg_success_score,
    AVG(sd.boundary_score)::DECIMAL as avg_boundary_score,
    COUNT(DISTINCT sd.analysis_date)::INTEGER as total_days,
    CASE
      WHEN sh.avg_stress > fh.avg_stress + 10 THEN 'increasing'
      WHEN sh.avg_stress < fh.avg_stress - 10 THEN 'decreasing'
      ELSE 'stable'
    END as stress_trend,
    (
      SELECT ARRAY_AGG(DISTINCT trigger)
      FROM (
        SELECT UNNEST(trigger_categories) as trigger
        FROM sentiment_data
        WHERE trigger_categories IS NOT NULL
      ) t
      LIMIT 5
    ) as most_common_triggers
  FROM sentiment_data sd
  CROSS JOIN first_half fh
  CROSS JOIN second_half sh
  GROUP BY fh.avg_stress, sh.avg_stress;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has opted into sentiment analysis
CREATE OR REPLACE FUNCTION is_sentiment_analysis_enabled(
  p_user_email TEXT,
  p_source TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN := false;
BEGIN
  SELECT
    CASE
      WHEN p_source = 'slack' THEN slack_content_analysis
      WHEN p_source = 'gmail' THEN gmail_subject_analysis OR gmail_snippet_analysis
      ELSE false
    END INTO v_enabled
  FROM public.sentiment_analysis_preferences
  WHERE user_email = p_user_email;

  RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. DATA CLEANUP (scheduled job)
-- =====================================================

-- Function to clean up old sentiment data based on user retention preferences
CREATE OR REPLACE FUNCTION cleanup_old_sentiment_data()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Delete data older than user's retention preference
  WITH to_delete AS (
    SELECT csa.id
    FROM public.content_sentiment_analysis csa
    LEFT JOIN public.sentiment_analysis_preferences sap
      ON csa.user_email = sap.user_email
    WHERE csa.analysis_date < CURRENT_DATE - COALESCE(sap.retention_days, 30)
  )
  DELETE FROM public.content_sentiment_analysis
  WHERE id IN (SELECT id FROM to_delete);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;
