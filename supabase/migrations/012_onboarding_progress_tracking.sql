-- Onboarding Progress Tracking
-- Tracks user progress through onboarding flows for analytics

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  email TEXT,
  product TEXT NOT NULL CHECK (product IN ('forge', 'sage')),
  current_screen TEXT NOT NULL,
  screen_index INTEGER NOT NULL,
  total_screens INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  dropped_off BOOLEAN DEFAULT FALSE,
  form_data_snapshot JSONB DEFAULT '{}',
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_onboarding_progress_session ON onboarding_progress(session_id);
CREATE INDEX idx_onboarding_progress_email ON onboarding_progress(email);
CREATE INDEX idx_onboarding_progress_product ON onboarding_progress(product);
CREATE INDEX idx_onboarding_progress_screen ON onboarding_progress(current_screen);
CREATE INDEX idx_onboarding_progress_started ON onboarding_progress(started_at);
CREATE INDEX idx_onboarding_progress_dropped_off ON onboarding_progress(dropped_off);

-- Table for tracking each screen visit (for detailed analytics)
CREATE TABLE IF NOT EXISTS onboarding_screen_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  email TEXT,
  product TEXT NOT NULL CHECK (product IN ('forge', 'sage')),
  screen TEXT NOT NULL,
  screen_index INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('enter', 'exit', 'skip')),
  time_on_screen_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for screen events
CREATE INDEX idx_screen_events_session ON onboarding_screen_events(session_id);
CREATE INDEX idx_screen_events_product ON onboarding_screen_events(product);
CREATE INDEX idx_screen_events_screen ON onboarding_screen_events(screen);
CREATE INDEX idx_screen_events_created ON onboarding_screen_events(created_at);

-- Enable RLS
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_screen_events ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (admin access)
CREATE POLICY "Allow all for service role" ON onboarding_progress
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON onboarding_screen_events
  FOR ALL USING (true) WITH CHECK (true);

-- Function to get drop-off statistics by screen
CREATE OR REPLACE FUNCTION get_onboarding_dropoff_stats(
  p_product TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  screen TEXT,
  screen_index INTEGER,
  total_reached INTEGER,
  total_dropped INTEGER,
  dropoff_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    op.current_screen as screen,
    op.screen_index,
    COUNT(*)::INTEGER as total_reached,
    COUNT(*) FILTER (WHERE op.dropped_off = TRUE)::INTEGER as total_dropped,
    ROUND(
      (COUNT(*) FILTER (WHERE op.dropped_off = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as dropoff_rate
  FROM onboarding_progress op
  WHERE
    (p_product IS NULL OR op.product = p_product)
    AND op.started_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY op.current_screen, op.screen_index
  ORDER BY op.screen_index;
END;
$$ LANGUAGE plpgsql;

-- Function to get funnel analysis
CREATE OR REPLACE FUNCTION get_onboarding_funnel(
  p_product TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  screen TEXT,
  screen_index INTEGER,
  users_reached BIGINT,
  conversion_from_previous NUMERIC,
  overall_conversion NUMERIC
) AS $$
DECLARE
  v_total_started BIGINT;
BEGIN
  -- Get total users who started
  SELECT COUNT(DISTINCT session_id) INTO v_total_started
  FROM onboarding_progress
  WHERE product = p_product
    AND started_at >= NOW() - (p_days || ' days')::INTERVAL;

  RETURN QUERY
  WITH screen_counts AS (
    SELECT
      op.current_screen,
      MAX(op.screen_index) as screen_idx,
      COUNT(DISTINCT op.session_id) as user_count
    FROM onboarding_progress op
    WHERE op.product = p_product
      AND op.started_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY op.current_screen
  ),
  ordered_screens AS (
    SELECT
      sc.current_screen,
      sc.screen_idx,
      sc.user_count,
      LAG(sc.user_count) OVER (ORDER BY sc.screen_idx) as prev_count
    FROM screen_counts sc
  )
  SELECT
    os.current_screen as screen,
    os.screen_idx as screen_index,
    os.user_count as users_reached,
    CASE
      WHEN os.prev_count IS NULL OR os.prev_count = 0 THEN 100.00
      ELSE ROUND((os.user_count::NUMERIC / os.prev_count) * 100, 2)
    END as conversion_from_previous,
    CASE
      WHEN v_total_started = 0 THEN 0.00
      ELSE ROUND((os.user_count::NUMERIC / v_total_started) * 100, 2)
    END as overall_conversion
  FROM ordered_screens os
  ORDER BY os.screen_idx;
END;
$$ LANGUAGE plpgsql;
