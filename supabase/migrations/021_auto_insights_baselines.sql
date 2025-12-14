-- Migration: Add user health baselines for automatic insight triggering
-- Purpose: Store rolling averages of user health metrics to detect significant changes
-- Created: 2025-12-14

-- Create user_health_baselines table
CREATE TABLE IF NOT EXISTS user_health_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,

    -- Metric identification
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        -- Sleep metrics
        'sleep_score',
        'sleep_duration_hours',
        'deep_sleep_minutes',
        'rem_sleep_minutes',
        'sleep_efficiency',

        -- Recovery/HRV metrics
        'recovery_score',
        'hrv_ms',
        'resting_hr',

        -- Activity metrics
        'daily_steps',
        'active_calories',
        'strain_score',

        -- Glucose metrics
        'avg_glucose',
        'glucose_variability',
        'time_in_range_pct',

        -- Behavioral metrics
        'avg_meetings_per_day',
        'emails_after_9pm',
        'screen_time_hours'
    )),

    -- Baseline values
    baseline_value NUMERIC NOT NULL,
    baseline_std_dev NUMERIC, -- Standard deviation for detecting anomalies
    sample_count INTEGER NOT NULL DEFAULT 1,

    -- Rolling window configuration
    window_days INTEGER NOT NULL DEFAULT 14, -- Default to 2-week rolling average

    -- Timestamps
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(email, metric_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_health_baselines_email ON user_health_baselines(email);
CREATE INDEX IF NOT EXISTS idx_health_baselines_metric ON user_health_baselines(metric_type);
CREATE INDEX IF NOT EXISTS idx_health_baselines_email_metric ON user_health_baselines(email, metric_type);

-- Add additional insight types to real_time_insights table
DO $$
BEGIN
    -- Drop and recreate the constraint to add new types
    ALTER TABLE real_time_insights DROP CONSTRAINT IF EXISTS real_time_insights_insight_type_check;
    ALTER TABLE real_time_insights ADD CONSTRAINT real_time_insights_insight_type_check
        CHECK (insight_type IN (
            -- Existing types
            'sleep_alert',
            'glucose_spike',
            'recovery_low',
            'activity_anomaly',
            'stress_indicator',
            'biomarker_trend',
            'nutrition_reminder',
            'workout_recommendation',
            'general_health',
            -- New types
            'workout_completed',
            'calendar_conflict',
            'email_overload',
            'deep_focus_window',
            'energy_prediction',
            'sleep_improvement',
            'recovery_high'
        ));
EXCEPTION
    WHEN others THEN
        -- If constraint doesn't exist or any other error, try to add it
        NULL;
END $$;

-- Enable Realtime for the real_time_insights table
-- Note: This may fail if table is already in publication, which is fine
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE real_time_insights;
EXCEPTION
    WHEN duplicate_object THEN
        -- Table already in publication, ignore
        NULL;
END $$;

-- Function to update baseline with new value
CREATE OR REPLACE FUNCTION update_health_baseline(
    p_email TEXT,
    p_metric_type TEXT,
    p_new_value NUMERIC,
    p_window_days INTEGER DEFAULT 14
)
RETURNS VOID AS $$
DECLARE
    v_existing RECORD;
    v_new_baseline NUMERIC;
    v_new_sample_count INTEGER;
BEGIN
    -- Get existing baseline
    SELECT * INTO v_existing
    FROM user_health_baselines
    WHERE email = p_email AND metric_type = p_metric_type;

    IF v_existing IS NULL THEN
        -- First value, create new baseline
        INSERT INTO user_health_baselines (email, metric_type, baseline_value, sample_count, window_days)
        VALUES (p_email, p_metric_type, p_new_value, 1, p_window_days);
    ELSE
        -- Calculate new rolling average
        -- Weight new value more if we have fewer samples
        v_new_sample_count := LEAST(v_existing.sample_count + 1, p_window_days);
        v_new_baseline := (v_existing.baseline_value * (v_new_sample_count - 1) + p_new_value) / v_new_sample_count;

        UPDATE user_health_baselines
        SET
            baseline_value = v_new_baseline,
            sample_count = v_new_sample_count,
            last_updated = NOW()
        WHERE email = p_email AND metric_type = p_metric_type;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if value is significantly different from baseline
CREATE OR REPLACE FUNCTION is_significant_change(
    p_email TEXT,
    p_metric_type TEXT,
    p_new_value NUMERIC,
    p_threshold_pct NUMERIC DEFAULT 15.0 -- Default 15% change threshold
)
RETURNS TABLE (
    is_significant BOOLEAN,
    change_pct NUMERIC,
    baseline_value NUMERIC,
    direction TEXT
) AS $$
DECLARE
    v_baseline RECORD;
BEGIN
    SELECT * INTO v_baseline
    FROM user_health_baselines
    WHERE email = p_email AND metric_type = p_metric_type;

    IF v_baseline IS NULL OR v_baseline.sample_count < 3 THEN
        -- Not enough data for comparison
        RETURN QUERY SELECT
            FALSE::BOOLEAN,
            0::NUMERIC,
            NULL::NUMERIC,
            'insufficient_data'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        ABS((p_new_value - v_baseline.baseline_value) / NULLIF(v_baseline.baseline_value, 0) * 100) > p_threshold_pct,
        ROUND(((p_new_value - v_baseline.baseline_value) / NULLIF(v_baseline.baseline_value, 0) * 100)::NUMERIC, 1),
        v_baseline.baseline_value,
        CASE
            WHEN p_new_value > v_baseline.baseline_value THEN 'increase'
            WHEN p_new_value < v_baseline.baseline_value THEN 'decrease'
            ELSE 'unchanged'
        END;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE user_health_baselines IS 'Rolling averages of user health metrics for detecting significant changes';
COMMENT ON COLUMN user_health_baselines.baseline_value IS 'Rolling average of the metric over window_days';
COMMENT ON COLUMN user_health_baselines.sample_count IS 'Number of samples used in the rolling average';
COMMENT ON COLUMN user_health_baselines.window_days IS 'Number of days in the rolling window for averaging';

COMMENT ON FUNCTION update_health_baseline(TEXT, TEXT, NUMERIC, INTEGER) IS 'Updates a user health baseline with a new value using rolling average';
COMMENT ON FUNCTION is_significant_change(TEXT, TEXT, NUMERIC, NUMERIC) IS 'Checks if a new value is significantly different from baseline';
