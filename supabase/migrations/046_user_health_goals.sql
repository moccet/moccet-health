-- Migration: User Health Goals
-- Purpose: Track personal health goals with auto-progress from connected data
-- Part of Phase 3: Goals System
-- Created: 2026-01-02

-- Create user_health_goals table
CREATE TABLE IF NOT EXISTS user_health_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,

    -- Goal identification
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'SLEEP',
        'ACTIVITY',
        'RECOVERY',
        'GLUCOSE',
        'WEIGHT',
        'STRESS',
        'CUSTOM'
    )),

    -- Metric tracking (matches user_health_baselines metric_types)
    tracked_metric TEXT, -- e.g., 'sleep_score', 'daily_steps', 'hrv_ms'
    target_value NUMERIC NOT NULL,
    current_value NUMERIC,
    baseline_value NUMERIC, -- Starting point when goal was created
    unit TEXT, -- e.g., 'hours', 'steps', 'ms', 'mg/dL', '%'

    -- Progress calculation
    progress_pct NUMERIC DEFAULT 0, -- Auto-computed percentage
    direction TEXT CHECK (direction IN ('increase', 'decrease', 'maintain')) DEFAULT 'increase',

    -- Timeline
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_date DATE,

    -- Status management
    status TEXT CHECK (status IN ('active', 'completed', 'paused', 'abandoned')) DEFAULT 'active',
    completed_at TIMESTAMPTZ,

    -- Links to other entities
    linked_insight_ids UUID[], -- Insights that relate to this goal
    linked_intervention_ids UUID[], -- Interventions started for this goal

    -- AI suggestion metadata
    is_ai_suggested BOOLEAN DEFAULT FALSE,
    suggestion_reason TEXT, -- Why AI suggested this goal

    -- Custom goal settings
    custom_metric_name TEXT, -- For CUSTOM category goals
    manual_tracking BOOLEAN DEFAULT FALSE, -- If true, user updates progress manually

    -- UI customization
    icon TEXT, -- Icon name for UI
    color TEXT, -- Color hex code for UI
    priority INTEGER DEFAULT 0, -- For sorting (higher = more important)

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_health_goals_email ON user_health_goals(email);
CREATE INDEX IF NOT EXISTS idx_health_goals_email_status ON user_health_goals(email, status);
CREATE INDEX IF NOT EXISTS idx_health_goals_email_category ON user_health_goals(email, category);
CREATE INDEX IF NOT EXISTS idx_health_goals_active ON user_health_goals(email) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_health_goals_tracked_metric ON user_health_goals(tracked_metric) WHERE tracked_metric IS NOT NULL;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_health_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_health_goals_updated_at ON user_health_goals;
CREATE TRIGGER trigger_update_health_goals_updated_at
    BEFORE UPDATE ON user_health_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_health_goals_updated_at();

-- Function to compute progress percentage
CREATE OR REPLACE FUNCTION compute_goal_progress(
    p_goal_id UUID,
    p_new_current_value NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    v_goal RECORD;
    v_progress NUMERIC;
BEGIN
    SELECT * INTO v_goal
    FROM user_health_goals
    WHERE id = p_goal_id;

    IF v_goal IS NULL THEN
        RETURN NULL;
    END IF;

    -- Handle different directions
    IF v_goal.direction = 'decrease' THEN
        -- For decrease goals (e.g., reduce glucose, lose weight)
        IF v_goal.baseline_value IS NULL OR v_goal.baseline_value = v_goal.target_value THEN
            v_progress := CASE WHEN p_new_current_value <= v_goal.target_value THEN 100 ELSE 0 END;
        ELSE
            v_progress := ((v_goal.baseline_value - p_new_current_value) /
                          NULLIF(v_goal.baseline_value - v_goal.target_value, 0)) * 100;
        END IF;
    ELSIF v_goal.direction = 'maintain' THEN
        -- For maintain goals, 100% if within 5% of target
        IF v_goal.target_value = 0 THEN
            v_progress := 100;
        ELSIF ABS(p_new_current_value - v_goal.target_value) / v_goal.target_value <= 0.05 THEN
            v_progress := 100;
        ELSE
            v_progress := 100 - (ABS(p_new_current_value - v_goal.target_value) /
                                 v_goal.target_value) * 100;
        END IF;
    ELSE
        -- For increase goals (default)
        IF v_goal.baseline_value IS NULL OR v_goal.baseline_value = v_goal.target_value THEN
            v_progress := CASE WHEN p_new_current_value >= v_goal.target_value THEN 100 ELSE 0 END;
        ELSE
            v_progress := ((p_new_current_value - v_goal.baseline_value) /
                          NULLIF(v_goal.target_value - v_goal.baseline_value, 0)) * 100;
        END IF;
    END IF;

    -- Clamp between 0 and 100
    v_progress := GREATEST(0, LEAST(100, COALESCE(v_progress, 0)));

    -- Update the goal
    UPDATE user_health_goals
    SET
        current_value = p_new_current_value,
        progress_pct = v_progress,
        status = CASE
            WHEN v_progress >= 100 AND status = 'active' THEN 'completed'
            ELSE status
        END,
        completed_at = CASE
            WHEN v_progress >= 100 AND completed_at IS NULL THEN NOW()
            ELSE completed_at
        END
    WHERE id = p_goal_id;

    RETURN v_progress;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update goals from baselines
CREATE OR REPLACE FUNCTION sync_goals_from_baseline()
RETURNS TRIGGER AS $$
DECLARE
    v_goal RECORD;
BEGIN
    -- Find active goals that track this metric for this user
    FOR v_goal IN
        SELECT id
        FROM user_health_goals
        WHERE email = NEW.email
          AND tracked_metric = NEW.metric_type
          AND status = 'active'
          AND manual_tracking = FALSE
    LOOP
        PERFORM compute_goal_progress(v_goal.id, NEW.baseline_value);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync goals when baselines are updated
DROP TRIGGER IF EXISTS trigger_sync_goals_from_baseline ON user_health_baselines;
CREATE TRIGGER trigger_sync_goals_from_baseline
    AFTER INSERT OR UPDATE ON user_health_baselines
    FOR EACH ROW
    EXECUTE FUNCTION sync_goals_from_baseline();

-- Enable Row Level Security
ALTER TABLE user_health_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own goals" ON user_health_goals;
CREATE POLICY "Users can view own goals"
    ON user_health_goals FOR SELECT
    USING (
        auth.jwt() ->> 'email' = email
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "Users can insert own goals" ON user_health_goals;
CREATE POLICY "Users can insert own goals"
    ON user_health_goals FOR INSERT
    WITH CHECK (
        auth.jwt() ->> 'email' = email
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "Users can update own goals" ON user_health_goals;
CREATE POLICY "Users can update own goals"
    ON user_health_goals FOR UPDATE
    USING (
        auth.jwt() ->> 'email' = email
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "Users can delete own goals" ON user_health_goals;
CREATE POLICY "Users can delete own goals"
    ON user_health_goals FOR DELETE
    USING (
        auth.jwt() ->> 'email' = email
        OR auth.role() = 'service_role'
    );

-- Helper function to get active goals for a user
CREATE OR REPLACE FUNCTION get_active_goals(
    p_email TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    category TEXT,
    tracked_metric TEXT,
    target_value NUMERIC,
    current_value NUMERIC,
    progress_pct NUMERIC,
    direction TEXT,
    target_date DATE,
    is_ai_suggested BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        g.id,
        g.title,
        g.category,
        g.tracked_metric,
        g.target_value,
        g.current_value,
        g.progress_pct,
        g.direction,
        g.target_date,
        g.is_ai_suggested
    FROM user_health_goals g
    WHERE g.email = p_email
      AND g.status = 'active'
    ORDER BY g.priority DESC, g.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get goals relevant to an insight category
CREATE OR REPLACE FUNCTION get_goals_for_insight_category(
    p_email TEXT,
    p_insight_category TEXT
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    category TEXT,
    progress_pct NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        g.id,
        g.title,
        g.category,
        g.progress_pct
    FROM user_health_goals g
    WHERE g.email = p_email
      AND g.status = 'active'
      AND (
        -- Direct category match
        g.category = p_insight_category
        -- Or cross-domain matches
        OR (p_insight_category = 'CROSS_DOMAIN')
        OR (p_insight_category = 'BLOOD' AND g.category IN ('GLUCOSE', 'RECOVERY'))
      )
    ORDER BY g.priority DESC
    LIMIT 3;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE user_health_goals IS 'Personal health goals with auto-tracking from connected devices';
COMMENT ON COLUMN user_health_goals.tracked_metric IS 'Links to user_health_baselines metric_type for auto-updates';
COMMENT ON COLUMN user_health_goals.progress_pct IS 'Auto-computed progress toward goal target (0-100)';
COMMENT ON COLUMN user_health_goals.direction IS 'Whether goal is to increase, decrease, or maintain the metric';
COMMENT ON COLUMN user_health_goals.is_ai_suggested IS 'True if this goal was suggested by AI based on user data';
COMMENT ON COLUMN user_health_goals.manual_tracking IS 'If true, progress must be manually updated by user';
COMMENT ON FUNCTION compute_goal_progress(UUID, NUMERIC) IS 'Computes and updates goal progress based on new metric value';
COMMENT ON FUNCTION sync_goals_from_baseline() IS 'Trigger function to auto-sync goals when baselines are updated';
COMMENT ON FUNCTION get_active_goals(TEXT, INTEGER) IS 'Returns active goals for a user, sorted by priority';
COMMENT ON FUNCTION get_goals_for_insight_category(TEXT, TEXT) IS 'Returns active goals relevant to an insight category';
