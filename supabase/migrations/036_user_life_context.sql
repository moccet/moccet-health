-- User Life Context Migration
-- Stores AI-detected life events and patterns from email analysis
-- Privacy-conscious: stores summaries only, not raw email content

-- =====================================================
-- 1. USER LIFE CONTEXT TABLE
-- Stores detected life events and patterns
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_life_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,

  -- Upcoming events detected from emails
  upcoming_events JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{type, summary, date, confidence, detected_at}]

  -- Active patterns/situations
  active_patterns JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{type, description, evidence_count, first_seen, last_seen}]

  -- Analysis metadata
  last_analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  emails_analyzed INTEGER DEFAULT 0,
  analysis_period_days INTEGER DEFAULT 30,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One record per user
  UNIQUE(user_email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_life_context_email ON public.user_life_context(user_email);
CREATE INDEX IF NOT EXISTS idx_life_context_updated ON public.user_life_context(updated_at DESC);

-- Enable RLS
ALTER TABLE public.user_life_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on user_life_context" ON public.user_life_context
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 2. LIFE EVENTS HISTORY TABLE
-- Historical record of detected events (for trend analysis)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.life_events_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,

  -- Event details
  event_type TEXT NOT NULL, -- 'travel', 'health', 'social', 'work', 'finance', 'recruitment'
  event_summary TEXT NOT NULL, -- "Flight to NYC", "Interview at Google"
  event_date DATE, -- When the event occurs (if detected)

  -- Detection metadata
  confidence DECIMAL(3,2) DEFAULT 0.8, -- 0-1 confidence score
  source TEXT DEFAULT 'gmail', -- 'gmail', 'calendar', 'slack'
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Status tracking
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'occurred', 'cancelled', 'unknown')),

  -- Prevent duplicates
  UNIQUE(user_email, event_type, event_summary, event_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_life_events_email ON public.life_events_history(user_email);
CREATE INDEX IF NOT EXISTS idx_life_events_date ON public.life_events_history(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_life_events_type ON public.life_events_history(event_type);
-- Partial index for upcoming events (CURRENT_DATE removed - not IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_life_events_upcoming ON public.life_events_history(user_email, event_date)
  WHERE status = 'upcoming';

-- Enable RLS
ALTER TABLE public.life_events_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on life_events_history" ON public.life_events_history
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. HELPER FUNCTIONS
-- =====================================================

-- Get upcoming events for a user
CREATE OR REPLACE FUNCTION get_upcoming_life_events(
  p_user_email TEXT,
  p_days_ahead INTEGER DEFAULT 14
)
RETURNS TABLE (
  event_type TEXT,
  event_summary TEXT,
  event_date DATE,
  confidence DECIMAL,
  days_until INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    leh.event_type,
    leh.event_summary,
    leh.event_date,
    leh.confidence,
    (leh.event_date - CURRENT_DATE)::INTEGER as days_until
  FROM public.life_events_history leh
  WHERE leh.user_email = p_user_email
    AND leh.status = 'upcoming'
    AND leh.event_date >= CURRENT_DATE
    AND leh.event_date <= CURRENT_DATE + p_days_ahead
  ORDER BY leh.event_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Get active patterns for a user
CREATE OR REPLACE FUNCTION get_active_life_patterns(
  p_user_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_patterns JSONB;
BEGIN
  SELECT active_patterns INTO v_patterns
  FROM public.user_life_context
  WHERE user_email = p_user_email;

  RETURN COALESCE(v_patterns, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Clean up old events (mark as occurred)
CREATE OR REPLACE FUNCTION cleanup_past_life_events()
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  UPDATE public.life_events_history
  SET status = 'occurred'
  WHERE status = 'upcoming'
    AND event_date < CURRENT_DATE;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

