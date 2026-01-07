-- Agent Memory Tables
-- Stores debate outcomes, consensus results, and learning signals for multi-agent coordination

-- ============================================================================
-- DEBATE HISTORY
-- ============================================================================

-- Stores conflicts that were detected and debated
CREATE TABLE IF NOT EXISTS agent_debate_history (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    conflict_type TEXT NOT NULL CHECK (conflict_type IN ('contradiction', 'resource_competition', 'priority_clash', 'causal_disagreement')),
    severity TEXT NOT NULL CHECK (severity IN ('blocking', 'significant', 'minor')),

    -- Agent positions
    agent_a_name TEXT NOT NULL,
    agent_a_domain TEXT NOT NULL,
    agent_a_position TEXT NOT NULL,
    agent_a_evidence JSONB DEFAULT '[]',
    agent_a_confidence REAL,

    agent_b_name TEXT NOT NULL,
    agent_b_domain TEXT NOT NULL,
    agent_b_position TEXT NOT NULL,
    agent_b_evidence JSONB DEFAULT '[]',
    agent_b_confidence REAL,

    -- Resolution
    resolution TEXT NOT NULL,
    compromise_type TEXT CHECK (compromise_type IN ('full_merge', 'time_split', 'priority_override', 'conditional')),
    resolution_confidence REAL,
    resolution_reasoning TEXT,

    -- User feedback on resolution
    user_accepted BOOLEAN,
    user_feedback TEXT,
    user_modified_to TEXT,

    -- Metadata
    context_snapshot JSONB DEFAULT '{}', -- Snapshot of user context at time of debate
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    feedback_received_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_debate_history_user ON agent_debate_history(user_email);
CREATE INDEX IF NOT EXISTS idx_debate_history_conflict_type ON agent_debate_history(conflict_type);
CREATE INDEX IF NOT EXISTS idx_debate_history_agents ON agent_debate_history(agent_a_name, agent_b_name);
CREATE INDEX IF NOT EXISTS idx_debate_history_created ON agent_debate_history(created_at DESC);

-- ============================================================================
-- CONSENSUS HISTORY
-- ============================================================================

-- Stores consensus validation results
CREATE TABLE IF NOT EXISTS agent_consensus_history (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    insight_id TEXT NOT NULL,
    insight_title TEXT,
    insight_recommendation TEXT,
    source_coordinator TEXT NOT NULL,
    source_domain TEXT NOT NULL,

    -- Consensus results
    consensus_level TEXT NOT NULL CHECK (consensus_level IN ('strong', 'moderate', 'weak', 'contested')),
    consensus_score REAL NOT NULL,
    original_confidence REAL NOT NULL,
    adjusted_confidence REAL NOT NULL,

    -- Votes
    votes JSONB DEFAULT '[]', -- Array of {voter, domain, vote, reasoning}
    flags JSONB DEFAULT '[]', -- Array of flags raised

    -- User feedback
    user_accepted BOOLEAN,
    user_feedback TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    feedback_received_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consensus_history_user ON agent_consensus_history(user_email);
CREATE INDEX IF NOT EXISTS idx_consensus_history_insight ON agent_consensus_history(insight_id);
CREATE INDEX IF NOT EXISTS idx_consensus_history_level ON agent_consensus_history(consensus_level);
CREATE INDEX IF NOT EXISTS idx_consensus_history_created ON agent_consensus_history(created_at DESC);

-- ============================================================================
-- RECOMMENDATION OUTCOMES
-- ============================================================================

-- Tracks what happened after recommendations were given
CREATE TABLE IF NOT EXISTS recommendation_outcomes (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    insight_id TEXT NOT NULL,
    insight_title TEXT NOT NULL,
    insight_category TEXT,
    recommendation TEXT NOT NULL,

    -- Outcome
    outcome TEXT CHECK (outcome IN ('accepted', 'rejected', 'modified', 'ignored', 'partially_followed', 'pending')),
    outcome_details TEXT,
    modification_made TEXT,

    -- Follow-up data (did the recommendation work?)
    effectiveness_score REAL, -- 0-1 based on follow-up health data
    health_impact_observed TEXT,

    -- Contributing factors
    source_agents JSONB DEFAULT '[]',
    was_debated BOOLEAN DEFAULT false,
    debate_id TEXT REFERENCES agent_debate_history(id),
    consensus_level TEXT,

    -- Metadata
    recommended_at TIMESTAMPTZ NOT NULL,
    outcome_recorded_at TIMESTAMPTZ,
    effectiveness_measured_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_user ON recommendation_outcomes(user_email);
CREATE INDEX IF NOT EXISTS idx_outcomes_insight ON recommendation_outcomes(insight_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_outcome ON recommendation_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_outcomes_created ON recommendation_outcomes(created_at DESC);

-- ============================================================================
-- AGENT LEARNING PATTERNS
-- ============================================================================

-- Stores learned patterns from agent interactions
CREATE TABLE IF NOT EXISTS agent_learned_patterns (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'conflict_resolution', -- How to resolve specific conflict types
        'consensus_predictor', -- Predict which insights get high/low consensus
        'effectiveness_pattern', -- What recommendations work for this user
        'timing_preference', -- When user prefers certain types of recommendations
        'domain_priority' -- Which domains user prioritizes in conflicts
    )),

    -- Pattern details
    pattern_key TEXT NOT NULL, -- e.g., "health_vs_work", "sleep_recommendations"
    pattern_data JSONB NOT NULL, -- Flexible storage for pattern-specific data

    -- Confidence and usage
    confidence REAL NOT NULL DEFAULT 0.5,
    sample_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    success_rate REAL, -- How often using this pattern led to good outcomes

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_email, pattern_type, pattern_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_patterns_user ON agent_learned_patterns(user_email);
CREATE INDEX IF NOT EXISTS idx_agent_patterns_type ON agent_learned_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_agent_patterns_confidence ON agent_learned_patterns(confidence DESC);

-- ============================================================================
-- CROSS-DOMAIN FLAG HISTORY
-- ============================================================================

-- Tracks cross-domain flags and their outcomes
CREATE TABLE IF NOT EXISTS cross_domain_flag_history (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    from_domain TEXT NOT NULL,
    to_domains TEXT[] NOT NULL,
    flag_type TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
    context JSONB DEFAULT '{}',

    -- Did the receiving domain act on this flag?
    was_acted_on BOOLEAN,
    action_taken TEXT,

    -- Outcome
    flag_was_useful BOOLEAN, -- Determined by user feedback or outcome

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flag_history_user ON cross_domain_flag_history(user_email);
CREATE INDEX IF NOT EXISTS idx_flag_history_domains ON cross_domain_flag_history(from_domain, to_domains);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE agent_debate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_consensus_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_domain_flag_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own data
CREATE POLICY "Users view own debate history" ON agent_debate_history FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users view own consensus history" ON agent_consensus_history FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users view own outcomes" ON recommendation_outcomes FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users view own patterns" ON agent_learned_patterns FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users view own flags" ON cross_domain_flag_history FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);

-- Service role full access
CREATE POLICY "Service full access debate" ON agent_debate_history FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service full access consensus" ON agent_consensus_history FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service full access outcomes" ON recommendation_outcomes FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service full access patterns" ON agent_learned_patterns FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service full access flags" ON cross_domain_flag_history FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update learned pattern confidence based on new outcome
CREATE OR REPLACE FUNCTION update_pattern_confidence(
    p_user_email TEXT,
    p_pattern_type TEXT,
    p_pattern_key TEXT,
    p_was_successful BOOLEAN
) RETURNS VOID AS $$
DECLARE
    current_confidence REAL;
    current_count INTEGER;
    new_confidence REAL;
    learning_rate REAL := 0.1;
BEGIN
    -- Get current values
    SELECT confidence, sample_count INTO current_confidence, current_count
    FROM agent_learned_patterns
    WHERE user_email = p_user_email
      AND pattern_type = p_pattern_type
      AND pattern_key = p_pattern_key;

    IF FOUND THEN
        -- Update with exponential moving average
        IF p_was_successful THEN
            new_confidence := current_confidence + learning_rate * (1.0 - current_confidence);
        ELSE
            new_confidence := current_confidence - learning_rate * current_confidence;
        END IF;

        -- Clamp to [0.1, 0.95]
        new_confidence := GREATEST(0.1, LEAST(0.95, new_confidence));

        UPDATE agent_learned_patterns
        SET confidence = new_confidence,
            sample_count = current_count + 1,
            updated_at = NOW(),
            last_used_at = NOW()
        WHERE user_email = p_user_email
          AND pattern_type = p_pattern_type
          AND pattern_key = p_pattern_key;
    ELSE
        -- Create new pattern
        INSERT INTO agent_learned_patterns (
            user_email, pattern_type, pattern_key, pattern_data, confidence, sample_count
        ) VALUES (
            p_user_email, p_pattern_type, p_pattern_key,
            jsonb_build_object('created_from_outcome', p_was_successful),
            CASE WHEN p_was_successful THEN 0.6 ELSE 0.4 END,
            1
        );
    END IF;
END;
$$ LANGUAGE plpgsql;
