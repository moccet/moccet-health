-- Migration: Add ecosystem context cache table
-- Purpose: Store aggregated context from all ecosystem data sources with TTL caching
-- Created: 2025-11-26

-- Create ecosystem_context_cache table
CREATE TABLE IF NOT EXISTS ecosystem_context_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    context_type TEXT NOT NULL CHECK (context_type IN ('sage', 'forge', 'unified')),

    -- Unified profile containing aggregated data
    unified_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example structure:
    -- {
    --   "physiological": {
    --     "biomarkers": { /* blood work summary */ },
    --     "sleep": { "avgHours": 6.2, "quality": "poor", "hrvTrend": "declining" },
    --     "glucose": { "avgFasting": 95, "spikeTimes": ["13:00", "19:00"] },
    --     "recovery": { "avgScore": 58, "trend": "stable" }
    --   },
    --   "behavioral": {
    --     "workPatterns": { "peakHours": "14:00-16:00", "stressIndicators": "high" },
    --     "sleepSchedule": { "avgBedtime": "23:45", "consistency": "low" },
    --     "mealTimingWindows": ["12:30-13:00", "18:30-19:00"]
    --   },
    --   "lifestyle": {
    --     "activityLevel": "moderate",
    --     "exerciseFrequency": "3x/week",
    --     "mealPrepCapacity": "medium"
    --   },
    --   "nutritional": {
    --     "currentIntake": { /* if available */ },
    --     "adherencePatterns": { /* if available */ }
    --   }
    -- }

    -- Key insights from cross-source correlation
    key_insights JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Example structure:
    -- [
    --   {
    --     "insight": "Glucose spikes at 1pm correlate with back-to-back meetings 12-2pm",
    --     "sources": ["dexcom", "gmail"],
    --     "confidence": 0.85,
    --     "impact": "high"
    --   },
    --   {
    --     "insight": "Low Oura readiness (62/100) + high Whoop strain (14.2) indicates overtraining",
    --     "sources": ["oura", "whoop"],
    --     "confidence": 0.92,
    --     "impact": "critical"
    --   }
    -- ]

    -- Priority optimization areas ranked by data severity
    priority_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Example structure:
    -- [
    --   {
    --     "area": "Blood sugar stabilization",
    --     "severity": "high",
    --     "dataPoints": ["CGM shows post-meal spikes", "Fasting glucose 110 mg/dL"],
    --     "priority": 1
    --   },
    --   {
    --     "area": "Sleep optimization",
    --     "severity": "critical",
    --     "dataPoints": ["Oura 6.2h avg", "Readiness 62/100", "HRV declining"],
    --     "priority": 2
    --   }
    -- ]

    -- Data sources that contributed to this context
    data_sources_used JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example structure:
    -- {
    --   "bloodBiomarkers": { "available": true, "lastUpdated": "2024-11-15", "recordCount": 45 },
    --   "oura": { "available": true, "lastSync": "2024-11-26", "daysOfData": 30 },
    --   "dexcom": { "available": true, "lastSync": "2024-11-26", "readingsCount": 8640 },
    --   "gmail": { "available": true, "lastSync": "2024-11-26", "messagesAnalyzed": 100 },
    --   "slack": { "available": false },
    --   "whoop": { "available": true, "uploadDate": "2024-11-20", "daysOfData": 14 }
    -- }

    -- Data quality and completeness metrics
    data_quality JSONB DEFAULT '{}'::jsonb,
    -- Example structure:
    -- {
    --   "completeness": 0.75,
    --   "confidence": 0.82,
    --   "missingCritical": ["sleep data"],
    --   "missingOptional": ["food diary", "workout logs"]
    -- }

    -- Cache metadata
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    is_valid BOOLEAN DEFAULT TRUE,

    -- Tracking
    generation_duration_ms INTEGER,
    api_calls_made INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_ecosystem_context_email ON ecosystem_context_cache(email);
CREATE INDEX IF NOT EXISTS idx_ecosystem_context_type ON ecosystem_context_cache(context_type);
CREATE INDEX IF NOT EXISTS idx_ecosystem_context_email_type ON ecosystem_context_cache(email, context_type);

-- Index for checking cache validity (removed NOW() from predicate - not immutable)
CREATE INDEX IF NOT EXISTS idx_ecosystem_context_valid
ON ecosystem_context_cache(email, context_type, is_valid, expires_at DESC)
WHERE is_valid = TRUE;

-- Index for cleanup of expired cache
CREATE INDEX IF NOT EXISTS idx_ecosystem_context_expires
ON ecosystem_context_cache(expires_at);

-- GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_ecosystem_context_unified_profile_gin
ON ecosystem_context_cache USING GIN (unified_profile);

CREATE INDEX IF NOT EXISTS idx_ecosystem_context_insights_gin
ON ecosystem_context_cache USING GIN (key_insights);

CREATE INDEX IF NOT EXISTS idx_ecosystem_context_priority_areas_gin
ON ecosystem_context_cache USING GIN (priority_areas);

CREATE INDEX IF NOT EXISTS idx_ecosystem_context_data_sources_gin
ON ecosystem_context_cache USING GIN (data_sources_used);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_ecosystem_context_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ecosystem_context_updated_at
    BEFORE UPDATE ON ecosystem_context_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_ecosystem_context_updated_at();

-- Function to automatically invalidate expired cache
CREATE OR REPLACE FUNCTION invalidate_expired_context_cache()
RETURNS INTEGER AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    UPDATE ecosystem_context_cache
    SET is_valid = FALSE
    WHERE is_valid = TRUE
      AND expires_at <= NOW();

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RETURN rows_updated;
END;
$$ LANGUAGE plpgsql;

-- Function to get latest valid cache
CREATE OR REPLACE FUNCTION get_valid_context_cache(
    p_email TEXT,
    p_context_type TEXT
)
RETURNS TABLE (
    id UUID,
    unified_profile JSONB,
    key_insights JSONB,
    priority_areas JSONB,
    data_sources_used JSONB,
    data_quality JSONB,
    generated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.unified_profile,
        c.key_insights,
        c.priority_areas,
        c.data_sources_used,
        c.data_quality,
        c.generated_at
    FROM ecosystem_context_cache c
    WHERE c.email = p_email
      AND c.context_type = p_context_type
      AND c.is_valid = TRUE
      AND c.expires_at > NOW()
    ORDER BY c.generated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE ecosystem_context_cache IS 'Caches aggregated ecosystem context from all data sources with 24-hour TTL for optimized plan generation';
COMMENT ON COLUMN ecosystem_context_cache.unified_profile IS 'Comprehensive profile combining physiological, behavioral, lifestyle, and nutritional data';
COMMENT ON COLUMN ecosystem_context_cache.key_insights IS 'Array of cross-source correlations and insights with confidence scores';
COMMENT ON COLUMN ecosystem_context_cache.priority_areas IS 'Ranked list of optimization areas based on data severity';
COMMENT ON COLUMN ecosystem_context_cache.data_sources_used IS 'Map of all data sources that contributed to this context with metadata';
COMMENT ON COLUMN ecosystem_context_cache.data_quality IS 'Quality metrics including completeness, confidence, and missing data flags';
COMMENT ON COLUMN ecosystem_context_cache.expires_at IS 'Cache expiration timestamp (default 24 hours from generation)';
COMMENT ON COLUMN ecosystem_context_cache.is_valid IS 'Validity flag, automatically set to FALSE when expires_at is reached';

-- Create a scheduled job to clean up old expired cache (if pg_cron is available)
-- This keeps the table size manageable
COMMENT ON FUNCTION invalidate_expired_context_cache() IS 'Marks expired cache entries as invalid. Should be called periodically via cron job';
COMMENT ON FUNCTION get_valid_context_cache(TEXT, TEXT) IS 'Retrieves the latest valid cached context for a user and context type';
