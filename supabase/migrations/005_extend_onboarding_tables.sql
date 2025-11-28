-- Migration: Extend onboarding tables with ecosystem sync tracking and plan component storage
-- Purpose: Add columns for meal plans, micronutrients, lifestyle integration, and sync status
-- Created: 2025-11-26

-- ============================================================================
-- EXTEND SAGE_ONBOARDING_DATA TABLE
-- ============================================================================

-- Add meal plan column (detailed 7-day meal plan from separate generator)
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS meal_plan JSONB DEFAULT NULL;

-- Add micronutrients column (personalized micronutrient recommendations)
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS micronutrients JSONB DEFAULT NULL;

-- Add lifestyle integration column (4-pillar lifestyle plan)
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS lifestyle_integration JSONB DEFAULT NULL;

-- Add ecosystem sync tracking
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS last_ecosystem_sync TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add per-source sync status
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS ecosystem_sync_status JSONB DEFAULT '{}'::jsonb;
-- Example structure:
-- {
--   "oura": { "lastSync": "2024-11-26T10:30:00Z", "status": "success", "recordCount": 30 },
--   "dexcom": { "lastSync": "2024-11-26T10:30:00Z", "status": "success", "recordCount": 8640 },
--   "gmail": { "lastSync": "2024-11-26T10:30:00Z", "status": "success", "messagesAnalyzed": 100 },
--   "slack": { "lastSync": null, "status": "not_connected" },
--   "vital": { "lastSync": "2024-11-26T10:30:00Z", "status": "success", "providers": ["fitbit", "dexcom"] }
-- }

-- ============================================================================
-- EXTEND FORGE_ONBOARDING_DATA TABLE
-- ============================================================================

-- Add meal plan column (nutrition guidance for fitness plan)
ALTER TABLE forge_onboarding_data
ADD COLUMN IF NOT EXISTS meal_plan JSONB DEFAULT NULL;

-- Add micronutrients column (sport-specific micronutrient recommendations)
ALTER TABLE forge_onboarding_data
ADD COLUMN IF NOT EXISTS micronutrients JSONB DEFAULT NULL;

-- Add lifestyle integration column (4-pillar lifestyle plan for athletes)
ALTER TABLE forge_onboarding_data
ADD COLUMN IF NOT EXISTS lifestyle_integration JSONB DEFAULT NULL;

-- Add ecosystem sync tracking
ALTER TABLE forge_onboarding_data
ADD COLUMN IF NOT EXISTS last_ecosystem_sync TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add per-source sync status
ALTER TABLE forge_onboarding_data
ADD COLUMN IF NOT EXISTS ecosystem_sync_status JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- CREATE INDEXES FOR NEW COLUMNS
-- ============================================================================

-- Sage indexes
CREATE INDEX IF NOT EXISTS idx_sage_onboarding_last_sync
ON sage_onboarding_data(last_ecosystem_sync DESC)
WHERE last_ecosystem_sync IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sage_onboarding_meal_plan_gin
ON sage_onboarding_data USING GIN (meal_plan)
WHERE meal_plan IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sage_onboarding_micronutrients_gin
ON sage_onboarding_data USING GIN (micronutrients)
WHERE micronutrients IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sage_onboarding_lifestyle_gin
ON sage_onboarding_data USING GIN (lifestyle_integration)
WHERE lifestyle_integration IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sage_onboarding_sync_status_gin
ON sage_onboarding_data USING GIN (ecosystem_sync_status);

-- Forge indexes
CREATE INDEX IF NOT EXISTS idx_forge_onboarding_last_sync
ON forge_onboarding_data(last_ecosystem_sync DESC)
WHERE last_ecosystem_sync IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forge_onboarding_meal_plan_gin
ON forge_onboarding_data USING GIN (meal_plan)
WHERE meal_plan IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forge_onboarding_micronutrients_gin
ON forge_onboarding_data USING GIN (micronutrients)
WHERE micronutrients IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forge_onboarding_lifestyle_gin
ON forge_onboarding_data USING GIN (lifestyle_integration)
WHERE lifestyle_integration IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forge_onboarding_sync_status_gin
ON forge_onboarding_data USING GIN (ecosystem_sync_status);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update ecosystem sync status for a specific source
CREATE OR REPLACE FUNCTION update_ecosystem_sync_status(
    p_email TEXT,
    p_table_name TEXT, -- 'sage' or 'forge'
    p_source TEXT,
    p_status TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
    current_sync_status JSONB;
    new_sync_status JSONB;
BEGIN
    -- Build the new source status
    new_sync_status := jsonb_build_object(
        'lastSync', NOW(),
        'status', p_status
    ) || p_metadata;

    -- Update the appropriate table
    IF p_table_name = 'sage' THEN
        UPDATE sage_onboarding_data
        SET
            ecosystem_sync_status = COALESCE(ecosystem_sync_status, '{}'::jsonb) || jsonb_build_object(p_source, new_sync_status),
            last_ecosystem_sync = NOW()
        WHERE email = p_email;
    ELSIF p_table_name = 'forge' THEN
        UPDATE forge_onboarding_data
        SET
            ecosystem_sync_status = COALESCE(ecosystem_sync_status, '{}'::jsonb) || jsonb_build_object(p_source, new_sync_status),
            last_ecosystem_sync = NOW()
        WHERE email = p_email;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if ecosystem data needs refresh (based on TTL)
CREATE OR REPLACE FUNCTION needs_ecosystem_refresh(
    p_email TEXT,
    p_table_name TEXT, -- 'sage' or 'forge'
    p_ttl_hours INTEGER DEFAULT 24
)
RETURNS BOOLEAN AS $$
DECLARE
    last_sync TIMESTAMP WITH TIME ZONE;
BEGIN
    IF p_table_name = 'sage' THEN
        SELECT last_ecosystem_sync INTO last_sync
        FROM sage_onboarding_data
        WHERE email = p_email;
    ELSIF p_table_name = 'forge' THEN
        SELECT last_ecosystem_sync INTO last_sync
        FROM forge_onboarding_data
        WHERE email = p_email;
    END IF;

    -- If never synced, needs refresh
    IF last_sync IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Check if last sync is older than TTL
    RETURN last_sync < (NOW() - (p_ttl_hours || ' hours')::INTERVAL);
END;
$$ LANGUAGE plpgsql;

-- Function to get sync status summary
CREATE OR REPLACE FUNCTION get_sync_status_summary(
    p_email TEXT,
    p_table_name TEXT -- 'sage' or 'forge'
)
RETURNS TABLE (
    source TEXT,
    last_sync TIMESTAMP WITH TIME ZONE,
    status TEXT,
    metadata JSONB
) AS $$
DECLARE
    sync_status JSONB;
    source_key TEXT;
BEGIN
    -- Get the ecosystem_sync_status for the user
    IF p_table_name = 'sage' THEN
        SELECT ecosystem_sync_status INTO sync_status
        FROM sage_onboarding_data
        WHERE email = p_email;
    ELSIF p_table_name = 'forge' THEN
        SELECT ecosystem_sync_status INTO sync_status
        FROM forge_onboarding_data
        WHERE email = p_email;
    END IF;

    -- If no sync status, return empty
    IF sync_status IS NULL OR sync_status = '{}'::jsonb THEN
        RETURN;
    END IF;

    -- Iterate through each source in the sync_status JSONB
    FOR source_key IN SELECT jsonb_object_keys(sync_status)
    LOOP
        RETURN QUERY
        SELECT
            source_key,
            (sync_status->source_key->>'lastSync')::TIMESTAMP WITH TIME ZONE,
            sync_status->source_key->>'status',
            sync_status->source_key - 'lastSync' - 'status' as metadata;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

-- Sage table comments
COMMENT ON COLUMN sage_onboarding_data.meal_plan IS 'Detailed 7-day meal plan generated with biomarker and ecosystem optimization';
COMMENT ON COLUMN sage_onboarding_data.micronutrients IS 'Personalized micronutrient recommendations based on biomarkers and health data';
COMMENT ON COLUMN sage_onboarding_data.lifestyle_integration IS 'Four-pillar lifestyle integration (sleep, exercise, stress, skin)';
COMMENT ON COLUMN sage_onboarding_data.last_ecosystem_sync IS 'Timestamp of last successful ecosystem data sync';
COMMENT ON COLUMN sage_onboarding_data.ecosystem_sync_status IS 'Per-source sync status with timestamps and metadata';

-- Forge table comments
COMMENT ON COLUMN forge_onboarding_data.meal_plan IS 'Nutrition guidance optimized for fitness goals and recovery data';
COMMENT ON COLUMN forge_onboarding_data.micronutrients IS 'Sport-specific micronutrient recommendations for performance and recovery';
COMMENT ON COLUMN forge_onboarding_data.lifestyle_integration IS 'Athlete-specific lifestyle integration protocols';
COMMENT ON COLUMN forge_onboarding_data.last_ecosystem_sync IS 'Timestamp of last successful ecosystem data sync';
COMMENT ON COLUMN forge_onboarding_data.ecosystem_sync_status IS 'Per-source sync status with timestamps and metadata';

-- Function comments
COMMENT ON FUNCTION update_ecosystem_sync_status(TEXT, TEXT, TEXT, TEXT, JSONB) IS 'Updates sync status for a specific data source';
COMMENT ON FUNCTION needs_ecosystem_refresh(TEXT, TEXT, INTEGER) IS 'Checks if ecosystem data needs refresh based on TTL';
COMMENT ON FUNCTION get_sync_status_summary(TEXT, TEXT) IS 'Returns summary of all source sync statuses for a user';
