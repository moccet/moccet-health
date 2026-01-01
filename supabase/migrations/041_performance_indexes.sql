-- ============================================================================
-- Migration: 041_performance_indexes.sql
-- Description: Add performance-optimized indexes for common query patterns
-- ============================================================================

-- ============================================================================
-- REAL_TIME_INSIGHTS INDEXES
-- ============================================================================

-- Composite index for insight queries with type filtering
CREATE INDEX IF NOT EXISTS idx_insights_email_created_type
ON real_time_insights(email, created_at DESC, insight_type);

-- Partial index for unread insights (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_insights_unread_by_user
ON real_time_insights(email, created_at DESC)
WHERE dismissed_at IS NULL AND viewed_at IS NULL;

-- Partial index for high-severity unread insights
CREATE INDEX IF NOT EXISTS idx_insights_high_severity_unread
ON real_time_insights(email, created_at DESC)
WHERE severity IN ('critical', 'high') AND dismissed_at IS NULL;

-- Index for acted-on insights (behavioral tracking)
CREATE INDEX IF NOT EXISTS idx_insights_acted_on
ON real_time_insights(email, created_at DESC)
WHERE acted_on = true;

-- ============================================================================
-- USER_HEALTH_BASELINES INDEXES
-- ============================================================================

-- Composite index for baseline lookups with recency
CREATE INDEX IF NOT EXISTS idx_baselines_email_metric_updated
ON user_health_baselines(email, metric_type, last_updated DESC);

-- ============================================================================
-- CONVERSATION_HISTORY INDEXES (if table exists with correct schema)
-- ============================================================================

DO $$
BEGIN
  -- Check if table and column exist before creating index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_history' AND column_name = 'user_email'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conversation_email_created
      ON conversation_history(user_email, created_at DESC)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create conversation_history index: %', SQLERRM;
END $$;

-- ============================================================================
-- USER_LEARNED_FACTS INDEXES (if table exists with correct schema)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_learned_facts' AND column_name = 'user_email'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_facts_email_category
      ON user_learned_facts(user_email, category)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create user_learned_facts index: %', SQLERRM;
END $$;

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

ANALYZE real_time_insights;
ANALYZE user_health_baselines;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_insights_email_created_type IS 'Optimizes insight queries with email + type + date filtering';
COMMENT ON INDEX idx_insights_unread_by_user IS 'Partial index for fast unread insight counts';
COMMENT ON INDEX idx_insights_high_severity_unread IS 'Partial index for critical/high severity alerts';
COMMENT ON INDEX idx_insights_acted_on IS 'Index for tracking user engagement with insights';
COMMENT ON INDEX idx_baselines_email_metric_updated IS 'Optimizes baseline lookups for anomaly detection';
