-- Migration: User Intervention Experiments
-- Purpose: Track whether insight recommendations were tried and their outcomes
-- Part of the behavioral loop: insight → user action → outcome → personalization
-- Created: 2026-01-02

-- Create the intervention experiments table
CREATE TABLE IF NOT EXISTS user_intervention_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,

    -- Link to the insight that suggested this intervention
    insight_id UUID REFERENCES real_time_insights(id) ON DELETE SET NULL,

    -- What was suggested
    intervention_type TEXT NOT NULL,  -- e.g. "evening_walk", "magnesium_glycinate", "no_caffeine_after_2pm"
    intervention_description TEXT,    -- Human-readable description

    -- Timing
    suggested_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,           -- When user tapped "I'll try this"
    ended_at TIMESTAMPTZ,             -- When intervention period ended
    duration_days INT DEFAULT 7,      -- Expected duration for the experiment

    -- What metric we're tracking
    tracked_metric TEXT NOT NULL,     -- e.g. "hrv_ms", "avg_glucose", "sleep_duration_hours", "recovery_score"

    -- Results
    baseline_value FLOAT,             -- Value before intervention (from baselines table)
    result_value FLOAT,               -- Value after intervention
    improvement_pct FLOAT,            -- (result - baseline) / baseline * 100

    -- User feedback
    user_feedback TEXT,               -- "Felt much better", "No difference", etc.
    user_rating INT CHECK (user_rating >= 1 AND user_rating <= 5),  -- 1-5 rating

    -- Status tracking
    status TEXT CHECK (status IN ('SUGGESTED', 'ONGOING', 'COMPLETED', 'ABANDONED')) DEFAULT 'SUGGESTED',

    -- Metadata
    difficulty TEXT CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')) DEFAULT 'MEDIUM',
    expected_outcome TEXT,            -- What improvement was predicted

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_intervention_experiments_email
    ON user_intervention_experiments(email);

CREATE INDEX IF NOT EXISTS idx_intervention_experiments_email_status
    ON user_intervention_experiments(email, status);

CREATE INDEX IF NOT EXISTS idx_intervention_experiments_insight_id
    ON user_intervention_experiments(insight_id);

-- Composite index for finding successful interventions to inject into prompts
CREATE INDEX IF NOT EXISTS idx_intervention_experiments_successful
    ON user_intervention_experiments(email, status, improvement_pct DESC)
    WHERE status = 'COMPLETED' AND improvement_pct > 0;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_intervention_experiments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_intervention_experiments_updated_at ON user_intervention_experiments;
CREATE TRIGGER trigger_update_intervention_experiments_updated_at
    BEFORE UPDATE ON user_intervention_experiments
    FOR EACH ROW
    EXECUTE FUNCTION update_intervention_experiments_updated_at();

-- Function to compute improvement percentage
CREATE OR REPLACE FUNCTION compute_intervention_improvement(
    p_experiment_id UUID,
    p_result_value FLOAT
)
RETURNS TABLE(improvement_pct FLOAT, status TEXT) AS $$
DECLARE
    v_baseline FLOAT;
    v_improvement FLOAT;
BEGIN
    -- Get baseline value
    SELECT baseline_value INTO v_baseline
    FROM user_intervention_experiments
    WHERE id = p_experiment_id;

    -- Compute improvement
    IF v_baseline IS NOT NULL AND v_baseline != 0 THEN
        v_improvement := ((p_result_value - v_baseline) / v_baseline) * 100;
    ELSE
        v_improvement := 0;
    END IF;

    -- Update the experiment
    UPDATE user_intervention_experiments
    SET
        result_value = p_result_value,
        improvement_pct = v_improvement,
        ended_at = NOW(),
        status = 'COMPLETED'
    WHERE id = p_experiment_id;

    RETURN QUERY SELECT v_improvement, 'COMPLETED'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE user_intervention_experiments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own interventions" ON user_intervention_experiments;
CREATE POLICY "Users can view own interventions"
    ON user_intervention_experiments FOR SELECT
    USING (
        auth.jwt() ->> 'email' = email
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "Users can insert own interventions" ON user_intervention_experiments;
CREATE POLICY "Users can insert own interventions"
    ON user_intervention_experiments FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'email' = email
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "Users can update own interventions" ON user_intervention_experiments;
CREATE POLICY "Users can update own interventions"
    ON user_intervention_experiments FOR UPDATE
    USING (
        auth.jwt() ->> 'email' = email
        OR auth.role() = 'service_role'
    );

-- Comments
COMMENT ON TABLE user_intervention_experiments IS 'Tracks whether insight recommendations were tried and their outcomes for personalization';
COMMENT ON COLUMN user_intervention_experiments.intervention_type IS 'Short identifier like evening_walk, magnesium_glycinate';
COMMENT ON COLUMN user_intervention_experiments.tracked_metric IS 'Which health metric this intervention targets: hrv_ms, avg_glucose, sleep_duration_hours, etc.';
COMMENT ON COLUMN user_intervention_experiments.improvement_pct IS 'Calculated as (result_value - baseline_value) / baseline_value * 100';
COMMENT ON COLUMN user_intervention_experiments.status IS 'SUGGESTED when created, ONGOING when user starts, COMPLETED/ABANDONED when finished';
