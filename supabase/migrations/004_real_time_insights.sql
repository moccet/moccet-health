-- Migration: Add real-time insights table for webhook-triggered notifications
-- Purpose: Store real-time health insights generated from Vital webhook events
-- Created: 2025-11-26

-- Create real_time_insights table
CREATE TABLE IF NOT EXISTS real_time_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,

    -- Insight classification
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'sleep_alert',
        'glucose_spike',
        'recovery_low',
        'activity_anomaly',
        'stress_indicator',
        'biomarker_trend',
        'nutrition_reminder',
        'workout_recommendation',
        'general_health'
    )),

    -- Link to source webhook event
    source_event_id UUID REFERENCES vital_webhook_events(id) ON DELETE SET NULL,
    source_provider TEXT, -- e.g., 'oura', 'dexcom', 'fitbit'
    source_data_type TEXT, -- e.g., 'sleep', 'glucose', 'activity'

    -- Insight content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),

    -- Actionable recommendation
    actionable_recommendation TEXT,
    -- Example: "Consider going to bed 30 minutes earlier tonight to improve sleep quality"

    -- Context data that led to this insight
    context_data JSONB DEFAULT '{}'::jsonb,
    -- Example structure:
    -- {
    --   "currentValue": 65,
    --   "avgValue": 78,
    --   "threshold": 70,
    --   "trend": "declining",
    --   "relatedMetrics": {
    --     "hrv": "low",
    --     "deepSleep": "insufficient"
    --   }
    -- }

    -- User interaction tracking
    viewed_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    acted_on BOOLEAN DEFAULT FALSE,
    action_taken TEXT,

    -- Notification delivery tracking
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_channel TEXT, -- e.g., 'email', 'sms', 'push', 'in_app'
    notification_sent_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_real_time_insights_email ON real_time_insights(email);
CREATE INDEX IF NOT EXISTS idx_real_time_insights_type ON real_time_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_real_time_insights_severity ON real_time_insights(severity);
CREATE INDEX IF NOT EXISTS idx_real_time_insights_created ON real_time_insights(created_at DESC);

-- Index for unread insights (for dashboard display)
CREATE INDEX IF NOT EXISTS idx_real_time_insights_unread
ON real_time_insights(email, created_at DESC)
WHERE dismissed_at IS NULL;

-- Index for insights needing notification
CREATE INDEX IF NOT EXISTS idx_real_time_insights_pending_notification
ON real_time_insights(created_at)
WHERE notification_sent = FALSE AND severity IN ('critical', 'high');

-- Index for source event linking
CREATE INDEX IF NOT EXISTS idx_real_time_insights_source_event
ON real_time_insights(source_event_id)
WHERE source_event_id IS NOT NULL;

-- Composite index for user's recent insights by type
CREATE INDEX IF NOT EXISTS idx_real_time_insights_user_type_date
ON real_time_insights(email, insight_type, created_at DESC);

-- GIN index for context_data JSONB queries
CREATE INDEX IF NOT EXISTS idx_real_time_insights_context_gin
ON real_time_insights USING GIN (context_data);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_real_time_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_real_time_insights_updated_at
    BEFORE UPDATE ON real_time_insights
    FOR EACH ROW
    EXECUTE FUNCTION update_real_time_insights_updated_at();

-- Function to get unread insights for user
CREATE OR REPLACE FUNCTION get_unread_insights(
    p_email TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    insight_type TEXT,
    title TEXT,
    message TEXT,
    severity TEXT,
    actionable_recommendation TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.insight_type,
        i.title,
        i.message,
        i.severity,
        i.actionable_recommendation,
        i.created_at
    FROM real_time_insights i
    WHERE i.email = p_email
      AND i.dismissed_at IS NULL
    ORDER BY
        CASE i.severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            WHEN 'info' THEN 5
        END,
        i.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get insights by type for trend analysis
CREATE OR REPLACE FUNCTION get_insights_by_type(
    p_email TEXT,
    p_insight_type TEXT,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    message TEXT,
    severity TEXT,
    context_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.title,
        i.message,
        i.severity,
        i.context_data,
        i.created_at
    FROM real_time_insights i
    WHERE i.email = p_email
      AND i.insight_type = p_insight_type
      AND i.created_at >= NOW() - (p_days || ' days')::INTERVAL
    ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to mark insight as viewed
CREATE OR REPLACE FUNCTION mark_insight_viewed(
    p_insight_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE real_time_insights
    SET viewed_at = NOW()
    WHERE id = p_insight_id
      AND viewed_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to dismiss insight
CREATE OR REPLACE FUNCTION dismiss_insight(
    p_insight_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE real_time_insights
    SET dismissed_at = NOW()
    WHERE id = p_insight_id
      AND dismissed_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to mark action taken on insight
CREATE OR REPLACE FUNCTION mark_insight_action(
    p_insight_id UUID,
    p_action_taken TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE real_time_insights
    SET
        acted_on = TRUE,
        action_taken = p_action_taken,
        dismissed_at = NOW()
    WHERE id = p_insight_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get insight statistics
CREATE OR REPLACE FUNCTION get_insight_stats(
    p_email TEXT,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_insights INTEGER,
    critical_count INTEGER,
    high_count INTEGER,
    dismissed_count INTEGER,
    acted_on_count INTEGER,
    avg_time_to_dismiss_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_insights,
        COUNT(*) FILTER (WHERE severity = 'critical')::INTEGER as critical_count,
        COUNT(*) FILTER (WHERE severity = 'high')::INTEGER as high_count,
        COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL)::INTEGER as dismissed_count,
        COUNT(*) FILTER (WHERE acted_on = TRUE)::INTEGER as acted_on_count,
        AVG(EXTRACT(EPOCH FROM (dismissed_at - created_at)) / 3600)::NUMERIC as avg_time_to_dismiss_hours
    FROM real_time_insights
    WHERE email = p_email
      AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE real_time_insights IS 'Stores real-time health insights generated from webhook events for user notifications and dashboard display';
COMMENT ON COLUMN real_time_insights.insight_type IS 'Classification of insight type for filtering and organization';
COMMENT ON COLUMN real_time_insights.source_event_id IS 'Reference to the Vital webhook event that triggered this insight';
COMMENT ON COLUMN real_time_insights.severity IS 'Priority level for sorting and notification urgency';
COMMENT ON COLUMN real_time_insights.actionable_recommendation IS 'Specific action the user can take based on this insight';
COMMENT ON COLUMN real_time_insights.context_data IS 'Supporting data and metrics that led to this insight';
COMMENT ON COLUMN real_time_insights.acted_on IS 'Boolean flag indicating if user took action on this insight';

COMMENT ON FUNCTION get_unread_insights(TEXT, INTEGER) IS 'Retrieves unread insights for a user, sorted by severity and date';
COMMENT ON FUNCTION get_insights_by_type(TEXT, TEXT, INTEGER) IS 'Retrieves insights of a specific type for trend analysis';
COMMENT ON FUNCTION mark_insight_viewed(UUID) IS 'Marks an insight as viewed by the user';
COMMENT ON FUNCTION dismiss_insight(UUID) IS 'Dismisses an insight';
COMMENT ON FUNCTION mark_insight_action(UUID, TEXT) IS 'Records that user took action on an insight';
COMMENT ON FUNCTION get_insight_stats(TEXT, INTEGER) IS 'Returns statistics about insights for a user';
