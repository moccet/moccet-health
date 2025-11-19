-- Add sage_plan column to sage_onboarding_data for easier querying
ALTER TABLE sage_onboarding_data ADD COLUMN IF NOT EXISTS sage_plan JSONB;

COMMENT ON COLUMN sage_onboarding_data.sage_plan IS 'AI-generated personalized nutrition plan';
