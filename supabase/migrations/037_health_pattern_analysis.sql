-- Health Pattern Analysis Migration
-- Stores AI-detected health trends and correlations with life events

-- =====================================================
-- 1. HEALTH PATTERN ANALYSIS TABLE
-- Stores detected health trends from wearables
-- =====================================================
CREATE TABLE IF NOT EXISTS public.health_pattern_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,

  -- Health patterns detected
  patterns JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{type, direction, change, period, significance, summary}]

  -- Correlations with life events
  correlations JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{healthMetric, lifeEvent, correlation, confidence, insight}]

  -- Summary for AI context
  summary TEXT,

  -- Data sources used
  sources_analyzed TEXT[] DEFAULT '{}',
  -- e.g., ['oura', 'whoop', 'apple_health']

  -- Analysis metadata
  analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_days INTEGER DEFAULT 14,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One analysis per user per day
  UNIQUE(user_email, analysis_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_patterns_email ON public.health_pattern_analysis(user_email);
CREATE INDEX IF NOT EXISTS idx_health_patterns_date ON public.health_pattern_analysis(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_patterns_user_date ON public.health_pattern_analysis(user_email, analysis_date DESC);

-- Enable RLS
ALTER TABLE public.health_pattern_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on health_pattern_analysis" ON public.health_pattern_analysis
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 2. HEALTH CORRELATIONS HISTORY TABLE
-- Historical record of health-life correlations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.health_correlations_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,

  -- Correlation details
  health_metric TEXT NOT NULL, -- 'HRV', 'Sleep Efficiency', 'Recovery'
  life_event TEXT NOT NULL, -- 'NYC trip', 'Interview period'
  life_event_source TEXT, -- 'gmail', 'slack', 'calendar'

  -- Correlation analysis
  correlation_type TEXT CHECK (correlation_type IN ('positive', 'negative', 'neutral')),
  confidence DECIMAL(3,2) DEFAULT 0.7, -- 0-1
  change_percentage DECIMAL(5,2), -- e.g., -15.5

  -- Insight generated
  insight TEXT,

  -- Timing
  event_date DATE,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(user_email, health_metric, life_event, event_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_corr_email ON public.health_correlations_history(user_email);
CREATE INDEX IF NOT EXISTS idx_health_corr_date ON public.health_correlations_history(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_corr_metric ON public.health_correlations_history(health_metric);

-- Enable RLS
ALTER TABLE public.health_correlations_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on health_correlations_history" ON public.health_correlations_history
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. HELPER FUNCTIONS
-- =====================================================

-- Get latest health analysis for a user
CREATE OR REPLACE FUNCTION get_latest_health_analysis(
  p_user_email TEXT
)
RETURNS TABLE (
  patterns JSONB,
  correlations JSONB,
  summary TEXT,
  sources_analyzed TEXT[],
  analysis_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hpa.patterns,
    hpa.correlations,
    hpa.summary,
    hpa.sources_analyzed,
    hpa.analysis_date
  FROM public.health_pattern_analysis hpa
  WHERE hpa.user_email = p_user_email
  ORDER BY hpa.analysis_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Get recent correlations for a user
CREATE OR REPLACE FUNCTION get_recent_health_correlations(
  p_user_email TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  health_metric TEXT,
  life_event TEXT,
  correlation_type TEXT,
  confidence DECIMAL,
  change_percentage DECIMAL,
  insight TEXT,
  event_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hch.health_metric,
    hch.life_event,
    hch.correlation_type,
    hch.confidence,
    hch.change_percentage,
    hch.insight,
    hch.event_date
  FROM public.health_correlations_history hch
  WHERE hch.user_email = p_user_email
    AND hch.detected_at >= NOW() - (p_days || ' days')::INTERVAL
  ORDER BY hch.detected_at DESC;
END;
$$ LANGUAGE plpgsql;

