-- ============================================================================
-- Migration: 042_weekly_summary_view.sql
-- Description: Create materialized view for weekly insight summaries
-- ============================================================================

-- ============================================================================
-- MATERIALIZED VIEW: Weekly Insight Summary
-- ============================================================================

-- Drop if exists (for idempotency)
DROP MATERIALIZED VIEW IF EXISTS mv_weekly_insight_summary;

-- Create materialized view for weekly insight aggregations
CREATE MATERIALIZED VIEW mv_weekly_insight_summary AS
SELECT
  email,
  date_trunc('week', created_at) AS week_start,
  insight_type,
  COUNT(*) AS insight_count,
  -- Severity distribution
  COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'high') AS high_count,
  COUNT(*) FILTER (WHERE severity = 'medium') AS medium_count,
  COUNT(*) FILTER (WHERE severity = 'low') AS low_count,
  COUNT(*) FILTER (WHERE severity = 'info') AS info_count,
  -- Average severity score (for sorting/comparison)
  AVG(
    CASE severity
      WHEN 'critical' THEN 5
      WHEN 'high' THEN 4
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 2
      WHEN 'info' THEN 1
      ELSE 0
    END
  ) AS avg_severity_score,
  -- User engagement metrics
  COUNT(*) FILTER (WHERE viewed_at IS NOT NULL) AS viewed_count,
  COUNT(*) FILTER (WHERE acted_on = true) AS acted_count,
  COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL) AS dismissed_count,
  -- Engagement rate (acted / total)
  ROUND(
    (COUNT(*) FILTER (WHERE acted_on = true))::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) AS action_rate_pct,
  -- View rate (viewed / total)
  ROUND(
    (COUNT(*) FILTER (WHERE viewed_at IS NOT NULL))::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) AS view_rate_pct,
  -- Notification metrics
  COUNT(*) FILTER (WHERE notification_sent = true) AS notifications_sent,
  -- Time-based metrics
  MIN(created_at) AS first_insight_at,
  MAX(created_at) AS last_insight_at
FROM real_time_insights
WHERE created_at > NOW() - INTERVAL '90 days'  -- Keep 90 days of data
GROUP BY email, date_trunc('week', created_at), insight_type;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_mv_weekly_summary_unique
ON mv_weekly_insight_summary(email, week_start, insight_type);

-- Create indexes for common query patterns
CREATE INDEX idx_mv_weekly_summary_email
ON mv_weekly_insight_summary(email);

CREATE INDEX idx_mv_weekly_summary_week
ON mv_weekly_insight_summary(week_start DESC);

CREATE INDEX idx_mv_weekly_summary_email_week
ON mv_weekly_insight_summary(email, week_start DESC);

-- ============================================================================
-- REFRESH FUNCTION
-- ============================================================================

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_weekly_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_insight_summary;
END;
$$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get weekly summary for a user
CREATE OR REPLACE FUNCTION get_user_weekly_summary(
  p_email TEXT,
  p_weeks INTEGER DEFAULT 4
)
RETURNS TABLE (
  week_start TIMESTAMPTZ,
  total_insights BIGINT,
  critical_count BIGINT,
  high_count BIGINT,
  action_rate NUMERIC,
  view_rate NUMERIC,
  top_insight_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ws.week_start,
    SUM(ws.insight_count)::BIGINT AS total_insights,
    SUM(ws.critical_count)::BIGINT AS critical_count,
    SUM(ws.high_count)::BIGINT AS high_count,
    AVG(ws.action_rate_pct) AS action_rate,
    AVG(ws.view_rate_pct) AS view_rate,
    (
      SELECT insight_type
      FROM mv_weekly_insight_summary sub
      WHERE sub.email = p_email
        AND sub.week_start = ws.week_start
      ORDER BY sub.insight_count DESC
      LIMIT 1
    ) AS top_insight_type
  FROM mv_weekly_insight_summary ws
  WHERE ws.email = p_email
    AND ws.week_start >= NOW() - (p_weeks || ' weeks')::INTERVAL
  GROUP BY ws.week_start
  ORDER BY ws.week_start DESC;
END;
$$;

-- Get insight type trends over time
CREATE OR REPLACE FUNCTION get_insight_type_trends(
  p_email TEXT,
  p_insight_type TEXT,
  p_weeks INTEGER DEFAULT 8
)
RETURNS TABLE (
  week_start TIMESTAMPTZ,
  insight_count BIGINT,
  avg_severity NUMERIC,
  action_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ws.week_start,
    ws.insight_count::BIGINT,
    ws.avg_severity_score,
    ws.action_rate_pct
  FROM mv_weekly_insight_summary ws
  WHERE ws.email = p_email
    AND ws.insight_type = p_insight_type
    AND ws.week_start >= NOW() - (p_weeks || ' weeks')::INTERVAL
  ORDER BY ws.week_start DESC;
END;
$$;

-- Get user engagement score (for gamification)
CREATE OR REPLACE FUNCTION get_user_engagement_score(
  p_email TEXT,
  p_weeks INTEGER DEFAULT 4
)
RETURNS TABLE (
  total_insights BIGINT,
  total_viewed BIGINT,
  total_acted BIGINT,
  engagement_score NUMERIC,
  trend TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_score NUMERIC;
  v_previous_score NUMERIC;
BEGIN
  -- Calculate current period score
  SELECT
    COALESCE(SUM(insight_count), 0),
    COALESCE(SUM(viewed_count), 0),
    COALESCE(SUM(acted_count), 0),
    ROUND(
      (COALESCE(SUM(viewed_count), 0) * 0.3 + COALESCE(SUM(acted_count), 0) * 0.7)::numeric /
      NULLIF(COALESCE(SUM(insight_count), 0), 0) * 100,
      2
    )
  INTO total_insights, total_viewed, total_acted, v_current_score
  FROM mv_weekly_insight_summary
  WHERE email = p_email
    AND week_start >= NOW() - (p_weeks || ' weeks')::INTERVAL;

  -- Calculate previous period score
  SELECT
    ROUND(
      (COALESCE(SUM(viewed_count), 0) * 0.3 + COALESCE(SUM(acted_count), 0) * 0.7)::numeric /
      NULLIF(COALESCE(SUM(insight_count), 0), 0) * 100,
      2
    )
  INTO v_previous_score
  FROM mv_weekly_insight_summary
  WHERE email = p_email
    AND week_start >= NOW() - (p_weeks * 2 || ' weeks')::INTERVAL
    AND week_start < NOW() - (p_weeks || ' weeks')::INTERVAL;

  -- Determine trend
  engagement_score := COALESCE(v_current_score, 0);
  trend := CASE
    WHEN v_previous_score IS NULL THEN 'new'
    WHEN v_current_score > v_previous_score + 5 THEN 'improving'
    WHEN v_current_score < v_previous_score - 5 THEN 'declining'
    ELSE 'stable'
  END;

  RETURN NEXT;
END;
$$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on the materialized view
ALTER MATERIALIZED VIEW mv_weekly_insight_summary OWNER TO postgres;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW mv_weekly_insight_summary IS
  'Aggregated weekly insight statistics per user and insight type. Refresh via refresh_weekly_summary()';

COMMENT ON FUNCTION refresh_weekly_summary IS
  'Refreshes the weekly insight summary materialized view. Call from cron job.';

COMMENT ON FUNCTION get_user_weekly_summary IS
  'Returns weekly insight summaries for a user with engagement metrics';

COMMENT ON FUNCTION get_insight_type_trends IS
  'Returns trend data for a specific insight type over time';

COMMENT ON FUNCTION get_user_engagement_score IS
  'Calculates user engagement score and trend direction';
