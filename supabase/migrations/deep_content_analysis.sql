-- Deep Content Analysis Tables
-- Stores extracted tasks, urgency scores, and interruption patterns from Gmail/Slack

-- Main deep content analysis table
CREATE TABLE IF NOT EXISTS deep_content_analysis (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('gmail', 'slack', 'combined')),
    pending_tasks JSONB DEFAULT '[]',
    urgent_messages JSONB DEFAULT '[]',
    interruption_summary JSONB DEFAULT '{}',
    key_people JSONB DEFAULT '[]',
    active_threads JSONB DEFAULT '[]',
    response_debt JSONB DEFAULT '{}',
    message_count INTEGER DEFAULT 0,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_email, source)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_deep_content_user_email ON deep_content_analysis(user_email);
CREATE INDEX IF NOT EXISTS idx_deep_content_source ON deep_content_analysis(source);
CREATE INDEX IF NOT EXISTS idx_deep_content_analyzed_at ON deep_content_analysis(analyzed_at DESC);

-- Extracted tasks table (individual tasks for tracking and completion)
CREATE TABLE IF NOT EXISTS extracted_tasks (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    description TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('gmail', 'slack')),
    source_id TEXT, -- original message ID
    requester TEXT,
    requester_role TEXT CHECK (requester_role IN ('manager', 'peer', 'direct_report', 'external', 'unknown')),
    deadline TEXT,
    urgency TEXT NOT NULL CHECK (urgency IN ('critical', 'high', 'medium', 'low')),
    urgency_score INTEGER NOT NULL DEFAULT 50 CHECK (urgency_score >= 0 AND urgency_score <= 100),
    category TEXT CHECK (category IN ('review', 'respond', 'create', 'meeting', 'decision', 'info', 'other')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'dismissed')),
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for extracted tasks
CREATE INDEX IF NOT EXISTS idx_extracted_tasks_user_email ON extracted_tasks(user_email);
CREATE INDEX IF NOT EXISTS idx_extracted_tasks_status ON extracted_tasks(status);
CREATE INDEX IF NOT EXISTS idx_extracted_tasks_urgency ON extracted_tasks(urgency_score DESC);
CREATE INDEX IF NOT EXISTS idx_extracted_tasks_user_status ON extracted_tasks(user_email, status);

-- Message urgency history (for tracking patterns over time)
CREATE TABLE IF NOT EXISTS message_urgency_history (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    message_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('gmail', 'slack')),
    urgency_score INTEGER NOT NULL CHECK (urgency_score >= 0 AND urgency_score <= 100),
    urgency_level TEXT NOT NULL CHECK (urgency_level IN ('critical', 'high', 'medium', 'low', 'fyi')),
    response_expectation TEXT CHECK (response_expectation IN ('immediate', 'same_day', 'within_week', 'no_response', 'unknown')),
    requester TEXT,
    reasoning TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_email, message_id, source)
);

-- Index for message urgency
CREATE INDEX IF NOT EXISTS idx_message_urgency_user ON message_urgency_history(user_email);
CREATE INDEX IF NOT EXISTS idx_message_urgency_score ON message_urgency_history(urgency_score DESC);

-- Interruption events table (individual interruptions)
CREATE TABLE IF NOT EXISTS interruption_events (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('gmail', 'slack')),
    timestamp TIMESTAMPTZ NOT NULL,
    channel TEXT,
    requester TEXT,
    type TEXT CHECK (type IN ('urgent_request', 'question', 'fyi', 'social', 'automated')),
    requires_response BOOLEAN DEFAULT false,
    expected_response_time TEXT,
    interruption_score INTEGER DEFAULT 0 CHECK (interruption_score >= 0 AND interruption_score <= 100),
    content_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for interruption events
CREATE INDEX IF NOT EXISTS idx_interruption_user ON interruption_events(user_email);
CREATE INDEX IF NOT EXISTS idx_interruption_timestamp ON interruption_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_interruption_type ON interruption_events(type);

-- People context table (relationship and communication patterns with key contacts)
CREATE TABLE IF NOT EXISTS people_context (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT,
    contact_slack_id TEXT,
    relationship TEXT CHECK (relationship IN ('manager', 'peer', 'direct_report', 'external', 'unknown')),
    communication_frequency TEXT CHECK (communication_frequency IN ('daily', 'weekly', 'monthly', 'rare')),
    avg_urgency_of_requests INTEGER DEFAULT 50,
    typical_response_expectation TEXT,
    last_interaction TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    source TEXT CHECK (source IN ('gmail', 'slack', 'both')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_email, contact_name)
);

-- Indexes for people context
CREATE INDEX IF NOT EXISTS idx_people_context_user ON people_context(user_email);
CREATE INDEX IF NOT EXISTS idx_people_context_relationship ON people_context(relationship);

-- Enable RLS
ALTER TABLE deep_content_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_urgency_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE interruption_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
-- Use DROP IF EXISTS to make migration idempotent
DROP POLICY IF EXISTS "Users can view own deep content analysis" ON deep_content_analysis;
CREATE POLICY "Users can view own deep content analysis"
    ON deep_content_analysis FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

DROP POLICY IF EXISTS "Users can view own extracted tasks" ON extracted_tasks;
CREATE POLICY "Users can view own extracted tasks"
    ON extracted_tasks FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

DROP POLICY IF EXISTS "Users can update own extracted tasks" ON extracted_tasks;
CREATE POLICY "Users can update own extracted tasks"
    ON extracted_tasks FOR UPDATE
    USING (auth.jwt() ->> 'email' = user_email);

DROP POLICY IF EXISTS "Users can view own message urgency" ON message_urgency_history;
CREATE POLICY "Users can view own message urgency"
    ON message_urgency_history FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

DROP POLICY IF EXISTS "Users can view own interruption events" ON interruption_events;
CREATE POLICY "Users can view own interruption events"
    ON interruption_events FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

DROP POLICY IF EXISTS "Users can view own people context" ON people_context;
CREATE POLICY "Users can view own people context"
    ON people_context FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access deep_content" ON deep_content_analysis;
CREATE POLICY "Service role full access deep_content"
    ON deep_content_analysis FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access tasks" ON extracted_tasks;
CREATE POLICY "Service role full access tasks"
    ON extracted_tasks FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access urgency" ON message_urgency_history;
CREATE POLICY "Service role full access urgency"
    ON message_urgency_history FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access interruptions" ON interruption_events;
CREATE POLICY "Service role full access interruptions"
    ON interruption_events FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access people" ON people_context;
CREATE POLICY "Service role full access people"
    ON people_context FOR ALL
    USING (auth.role() = 'service_role');
