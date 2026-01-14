-- Water & Weight Tracking Tables for Sage (moccet chef)
-- Tracks daily water intake and weight logs with goal management

-- =====================================================
-- WATER TRACKING
-- =====================================================

-- Water Logs Table
CREATE TABLE IF NOT EXISTS water_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_email TEXT NOT NULL,
    amount_ml INTEGER NOT NULL CHECK (amount_ml > 0),
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT water_valid_source CHECK (source IN ('manual', 'quick_add', 'smart_bottle', 'import'))
);

-- Indexes for water_logs
CREATE INDEX IF NOT EXISTS idx_water_logs_user_email ON water_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_water_logs_logged_at ON water_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_email, logged_at DESC);

-- Water Goals Table
CREATE TABLE IF NOT EXISTS water_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL UNIQUE,
    daily_goal_ml INTEGER NOT NULL DEFAULT 2500 CHECK (daily_goal_ml > 0),
    use_metric BOOLEAN DEFAULT true,
    reminder_enabled BOOLEAN DEFAULT false,
    reminder_interval_hours INTEGER DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_water_goals_user ON water_goals(user_email);

-- =====================================================
-- WEIGHT TRACKING
-- =====================================================

-- Weight Logs Table
CREATE TABLE IF NOT EXISTS weight_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_email TEXT NOT NULL,
    weight_kg DECIMAL(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT DEFAULT 'manual',
    notes TEXT,
    body_fat_percent DECIMAL(4,1) CHECK (body_fat_percent IS NULL OR (body_fat_percent >= 0 AND body_fat_percent <= 100)),
    muscle_mass_kg DECIMAL(5,2) CHECK (muscle_mass_kg IS NULL OR muscle_mass_kg >= 0),
    water_percent DECIMAL(4,1) CHECK (water_percent IS NULL OR (water_percent >= 0 AND water_percent <= 100)),
    bmi DECIMAL(4,1),
    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT weight_valid_source CHECK (source IN ('manual', 'smart_scale', 'apple_health', 'google_fit', 'import'))
);

-- Indexes for weight_logs
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_email ON weight_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_weight_logs_logged_at ON weight_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_email, logged_at DESC);

-- Weight Goals Table
CREATE TABLE IF NOT EXISTS weight_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL UNIQUE,
    goal_weight_kg DECIMAL(5,2) CHECK (goal_weight_kg IS NULL OR (goal_weight_kg > 0 AND goal_weight_kg < 500)),
    height_cm DECIMAL(5,1) CHECK (height_cm IS NULL OR (height_cm > 0 AND height_cm < 300)),
    use_metric BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weight_goals_user ON weight_goals(user_email);

-- =====================================================
-- VIEWS
-- =====================================================

-- Daily Water Summary View
CREATE OR REPLACE VIEW water_daily_summary AS
SELECT
    user_email,
    DATE(logged_at) as log_date,
    SUM(amount_ml) as total_ml,
    COUNT(*) as entry_count,
    MIN(logged_at) as first_entry,
    MAX(logged_at) as last_entry
FROM water_logs
GROUP BY user_email, DATE(logged_at);

-- Weight Progress View
CREATE OR REPLACE VIEW weight_progress_summary AS
SELECT
    user_email,
    COUNT(*) as total_entries,
    MIN(weight_kg) as lowest_weight,
    MAX(weight_kg) as highest_weight,
    (SELECT weight_kg FROM weight_logs w2 WHERE w2.user_email = weight_logs.user_email ORDER BY logged_at ASC LIMIT 1) as start_weight,
    (SELECT weight_kg FROM weight_logs w3 WHERE w3.user_email = weight_logs.user_email ORDER BY logged_at DESC LIMIT 1) as current_weight,
    MIN(logged_at) as first_entry,
    MAX(logged_at) as last_entry
FROM weight_logs
GROUP BY user_email;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_goals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users can view own water logs" ON water_logs;
DROP POLICY IF EXISTS "Users can insert own water logs" ON water_logs;
DROP POLICY IF EXISTS "Users can update own water logs" ON water_logs;
DROP POLICY IF EXISTS "Users can delete own water logs" ON water_logs;
DROP POLICY IF EXISTS "Service role manages water logs" ON water_logs;

DROP POLICY IF EXISTS "Users can view own water goals" ON water_goals;
DROP POLICY IF EXISTS "Users can insert own water goals" ON water_goals;
DROP POLICY IF EXISTS "Users can update own water goals" ON water_goals;
DROP POLICY IF EXISTS "Service role manages water goals" ON water_goals;

DROP POLICY IF EXISTS "Users can view own weight logs" ON weight_logs;
DROP POLICY IF EXISTS "Users can insert own weight logs" ON weight_logs;
DROP POLICY IF EXISTS "Users can update own weight logs" ON weight_logs;
DROP POLICY IF EXISTS "Users can delete own weight logs" ON weight_logs;
DROP POLICY IF EXISTS "Service role manages weight logs" ON weight_logs;

DROP POLICY IF EXISTS "Users can view own weight goals" ON weight_goals;
DROP POLICY IF EXISTS "Users can insert own weight goals" ON weight_goals;
DROP POLICY IF EXISTS "Users can update own weight goals" ON weight_goals;
DROP POLICY IF EXISTS "Service role manages weight goals" ON weight_goals;

-- Water Logs RLS Policies
CREATE POLICY "Users can view own water logs"
    ON water_logs FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own water logs"
    ON water_logs FOR INSERT
    WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own water logs"
    ON water_logs FOR UPDATE
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can delete own water logs"
    ON water_logs FOR DELETE
    USING (auth.jwt() ->> 'email' = user_email);

-- Water Goals RLS Policies
CREATE POLICY "Users can view own water goals"
    ON water_goals FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own water goals"
    ON water_goals FOR INSERT
    WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own water goals"
    ON water_goals FOR UPDATE
    USING (auth.jwt() ->> 'email' = user_email);

-- Weight Logs RLS Policies
CREATE POLICY "Users can view own weight logs"
    ON weight_logs FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own weight logs"
    ON weight_logs FOR INSERT
    WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own weight logs"
    ON weight_logs FOR UPDATE
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can delete own weight logs"
    ON weight_logs FOR DELETE
    USING (auth.jwt() ->> 'email' = user_email);

-- Weight Goals RLS Policies
CREATE POLICY "Users can view own weight goals"
    ON weight_goals FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own weight goals"
    ON weight_goals FOR INSERT
    WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own weight goals"
    ON weight_goals FOR UPDATE
    USING (auth.jwt() ->> 'email' = user_email);

-- Service role bypass policies
CREATE POLICY "Service role manages water logs"
    ON water_logs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role manages water goals"
    ON water_goals FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role manages weight logs"
    ON weight_logs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role manages weight goals"
    ON weight_goals FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get daily water total
CREATE OR REPLACE FUNCTION get_water_total_for_date(
    p_user_email TEXT,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(SUM(amount_ml), 0)::INTEGER
    FROM water_logs
    WHERE user_email = p_user_email
    AND DATE(logged_at) = p_date;
$$;

-- Get weekly water summary
CREATE OR REPLACE FUNCTION get_weekly_water_summary(p_user_email TEXT)
RETURNS TABLE (
    log_date DATE,
    total_ml INTEGER,
    entry_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        DATE(logged_at) as log_date,
        SUM(amount_ml)::INTEGER as total_ml,
        COUNT(*) as entry_count
    FROM water_logs
    WHERE user_email = p_user_email
    AND logged_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(logged_at)
    ORDER BY log_date DESC;
$$;

-- Get weight for date
CREATE OR REPLACE FUNCTION get_weight_for_date(
    p_user_email TEXT,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(5,2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT weight_kg
    FROM weight_logs
    WHERE user_email = p_user_email
    AND DATE(logged_at) = p_date
    ORDER BY logged_at DESC
    LIMIT 1;
$$;

-- Get weight trend (last N days)
CREATE OR REPLACE FUNCTION get_weight_trend(
    p_user_email TEXT,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    log_date DATE,
    weight_kg DECIMAL(5,2),
    bmi DECIMAL(4,1)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT ON (DATE(logged_at))
        DATE(logged_at) as log_date,
        weight_kg,
        bmi
    FROM weight_logs
    WHERE user_email = p_user_email
    AND logged_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    ORDER BY DATE(logged_at), logged_at DESC;
$$;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON water_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON water_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON weight_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON weight_goals TO authenticated;
GRANT SELECT ON water_daily_summary TO authenticated;
GRANT SELECT ON weight_progress_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_water_total_for_date TO authenticated;
GRANT EXECUTE ON FUNCTION get_weekly_water_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_weight_for_date TO authenticated;
GRANT EXECUTE ON FUNCTION get_weight_trend TO authenticated;
