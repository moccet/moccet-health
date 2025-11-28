-- Migration: Add behavioral patterns table for Gmail/Slack pattern persistence
-- Purpose: Store analyzed behavioral patterns from communication integrations
-- Created: 2025-11-26

-- Create behavioral_patterns table
CREATE TABLE IF NOT EXISTS behavioral_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('gmail', 'slack', 'teams', 'outlook')),
    sync_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Raw pattern data
    patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example structure:
    -- {
    --   "meetingDensity": {
    --     "peakHours": ["14:00-16:00"],
    --     "avgMeetingsPerDay": 8,
    --     "backToBackPercentage": 65
    --   },
    --   "emailVolume": {
    --     "avgPerDay": 45,
    --     "peakHours": ["09:00-11:00"],
    --     "afterHoursPercentage": 15
    --   },
    --   "workHours": {
    --     "start": "08:00",
    --     "end": "18:00",
    --     "weekendActivity": true
    --   },
    --   "optimalMealWindows": ["12:30-13:00", "18:30-19:00"]
    -- }

    -- Computed metrics
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example structure:
    -- {
    --   "stressScore": 7.5,
    --   "workLifeBalance": 6.2,
    --   "focusTimeAvailability": "low",
    --   "breakFrequency": "insufficient"
    -- }

    -- Metadata
    data_period_start DATE,
    data_period_end DATE,
    data_points_analyzed INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_email ON behavioral_patterns(email);
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_source ON behavioral_patterns(source);
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_sync_date ON behavioral_patterns(sync_date DESC);
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_email_source ON behavioral_patterns(email, source);

-- GIN index for JSONB pattern queries
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_patterns_gin ON behavioral_patterns USING GIN (patterns);
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_metrics_gin ON behavioral_patterns USING GIN (metrics);

-- Create composite index for common query pattern (latest patterns by email and source)
CREATE INDEX IF NOT EXISTS idx_behavioral_patterns_latest
ON behavioral_patterns(email, source, sync_date DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_behavioral_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_behavioral_patterns_updated_at
    BEFORE UPDATE ON behavioral_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_behavioral_patterns_updated_at();

-- Add comment for documentation
COMMENT ON TABLE behavioral_patterns IS 'Stores analyzed behavioral patterns from communication integrations (Gmail, Slack, etc.) for personalized health recommendations';
COMMENT ON COLUMN behavioral_patterns.patterns IS 'Structured JSONB data containing meeting density, email patterns, work hours, and optimal meal windows';
COMMENT ON COLUMN behavioral_patterns.metrics IS 'Computed metrics like stress score, work-life balance, and focus time availability';
COMMENT ON COLUMN behavioral_patterns.data_period_start IS 'Start date of the analysis period (typically 30 days)';
COMMENT ON COLUMN behavioral_patterns.data_period_end IS 'End date of the analysis period';
COMMENT ON COLUMN behavioral_patterns.data_points_analyzed IS 'Number of messages/events analyzed to generate patterns';
