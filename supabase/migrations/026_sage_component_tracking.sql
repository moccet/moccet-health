-- Migration: Add component status tracking for event-driven plan generation
-- Purpose: Track individual component generation status to eliminate polling and enable completion callbacks
-- Created: 2025-12-17

-- ============================================================================
-- ADD COMPONENT STATUS TRACKING COLUMNS
-- ============================================================================

-- Individual component status tracking (pending | processing | completed | failed)
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS meal_plan_status VARCHAR(20) DEFAULT 'pending';

ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS micronutrients_status VARCHAR(20) DEFAULT 'pending';

ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS lifestyle_status VARCHAR(20) DEFAULT 'pending';

-- Track completion check count to prevent infinite loops
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS completion_check_count INTEGER DEFAULT 0;

-- Track when notification email was sent (prevents duplicate emails)
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- ============================================================================
-- CREATE INDEX FOR STATUS QUERIES
-- ============================================================================

-- Index for efficient status queries during completion checks
CREATE INDEX IF NOT EXISTS idx_sage_component_statuses
ON sage_onboarding_data(email, meal_plan_status, micronutrients_status, lifestyle_status);

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON COLUMN sage_onboarding_data.meal_plan_status IS 'Status of meal plan generation: pending, processing, completed, failed';
COMMENT ON COLUMN sage_onboarding_data.micronutrients_status IS 'Status of micronutrients generation: pending, processing, completed, failed';
COMMENT ON COLUMN sage_onboarding_data.lifestyle_status IS 'Status of lifestyle integration generation: pending, processing, completed, failed';
COMMENT ON COLUMN sage_onboarding_data.completion_check_count IS 'Number of times completion has been checked (prevents infinite retry loops)';
COMMENT ON COLUMN sage_onboarding_data.email_sent_at IS 'Timestamp when plan ready notification email was sent';
