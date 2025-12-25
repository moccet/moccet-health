-- Daily Check-ins Table
-- Stores user's daily check-in responses for MCP personalization

CREATE TABLE IF NOT EXISTS user_daily_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    question TEXT NOT NULL,
    selected_option TEXT NOT NULL,
    selected_text TEXT,
    checkin_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one check-in per user per day
    CONSTRAINT unique_daily_checkin UNIQUE (user_email, checkin_date)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_email ON user_daily_checkins(user_email);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_date ON user_daily_checkins(checkin_date DESC);

-- Enable RLS
ALTER TABLE user_daily_checkins ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily checkins
CREATE POLICY "Users can view own checkins" ON user_daily_checkins
    FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own checkins" ON user_daily_checkins
    FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role full access to checkins" ON user_daily_checkins
    FOR ALL USING (auth.role() = 'service_role');

-- Note: user_learned_facts table already exists from migration 020_user_memory_system.sql
-- with column 'category' instead of 'fact_category'. Use that table directly.
