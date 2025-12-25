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

-- Learned facts table for MCP context (if not exists)
CREATE TABLE IF NOT EXISTS user_learned_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    fact_category TEXT NOT NULL,
    fact_key TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    confidence FLOAT DEFAULT 0.5,
    source TEXT DEFAULT 'unknown',
    last_confirmed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one fact per key per user
    CONSTRAINT unique_learned_fact UNIQUE (user_email, fact_key)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_learned_facts_user_email ON user_learned_facts(user_email);
CREATE INDEX IF NOT EXISTS idx_learned_facts_category ON user_learned_facts(fact_category);

-- Enable RLS
ALTER TABLE user_daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learned_facts ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily checkins
CREATE POLICY "Users can view own checkins" ON user_daily_checkins
    FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own checkins" ON user_daily_checkins
    FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role full access to checkins" ON user_daily_checkins
    FOR ALL USING (auth.role() = 'service_role');

-- RLS policies for learned facts
CREATE POLICY "Users can view own facts" ON user_learned_facts
    FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can manage own facts" ON user_learned_facts
    FOR ALL USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role full access to facts" ON user_learned_facts
    FOR ALL USING (auth.role() = 'service_role');
